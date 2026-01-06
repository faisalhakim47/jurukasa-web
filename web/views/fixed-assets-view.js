import { html, nothing } from 'lit-html';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { readValue } from '#web/directives/read-value.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { useRender } from '#web/hooks/use-render.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

import '#web/components/material-symbols.js';
import '#web/components/fixed-asset-creation-dialog.js';
import '#web/components/fixed-asset-details-dialog.js';

/**
 * @typedef {object} FixedAssetRow
 * @property {number} id
 * @property {string} name
 * @property {string | null} description
 * @property {number} acquisition_time
 * @property {number} acquisition_cost
 * @property {number} useful_life_years
 * @property {number} salvage_value
 * @property {number} accumulated_depreciation
 * @property {number} is_fully_depreciated
 * @property {number} asset_account_code
 * @property {string} asset_account_name
 */

const depreciationFilterOptions = /** @type {const} */ (['All', 'Active', 'Fully Depreciated']);

/** @typedef {typeof depreciationFilterOptions[number]} DepreciationFilter */

export class FixedAssetsViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);

    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const pageSize = 20;

    const state = reactive({
      fixedAssets: /** @type {FixedAssetRow[]} */ ([]),
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      searchQuery: '',
      depreciationFilter: /** @type {DepreciationFilter} */ ('All'),
      currentPage: 1,
      totalCount: 0,
      selectedAssetId: /** @type {number | null} */ (null),
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false;
    });

    function getTotalPages() {
      return Math.max(1, Math.ceil(state.totalCount / pageSize));
    }

    async function loadFixedAssets() {
      try {
        state.isLoading = true;
        state.error = null;

        const searchQueryValue = state.searchQuery.trim() || null;
        const searchPattern = searchQueryValue ? `%${searchQueryValue}%` : null;
        const depreciationFilterValue = state.depreciationFilter;
        const offset = (state.currentPage - 1) * pageSize;

        const countResult = await database.sql`
          SELECT COUNT(*) as count
          FROM fixed_assets fa
          WHERE (${searchPattern} IS NULL OR fa.name LIKE ${searchPattern})
            AND (${depreciationFilterValue} = 'All'
              OR (${depreciationFilterValue} = 'Active' AND fa.is_fully_depreciated = 0)
              OR (${depreciationFilterValue} = 'Fully Depreciated' AND fa.is_fully_depreciated = 1))
        `;
        state.totalCount = Number(countResult.rows[0].count);

        const result = await database.sql`
          SELECT
            fa.id,
            fa.name,
            fa.description,
            fa.acquisition_time,
            fa.acquisition_cost,
            fa.useful_life_years,
            fa.salvage_value,
            fa.accumulated_depreciation,
            fa.is_fully_depreciated,
            fa.asset_account_code,
            a.name as asset_account_name
          FROM fixed_assets fa
          JOIN accounts a ON a.account_code = fa.asset_account_code
          WHERE (${searchPattern} IS NULL OR fa.name LIKE ${searchPattern})
            AND (${depreciationFilterValue} = 'All'
              OR (${depreciationFilterValue} = 'Active' AND fa.is_fully_depreciated = 0)
              OR (${depreciationFilterValue} = 'Fully Depreciated' AND fa.is_fully_depreciated = 1))
          ORDER BY fa.acquisition_time DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `;

        state.fixedAssets = result.rows.map(function (row) {
          return /** @type {FixedAssetRow} */ ({
            id: Number(row.id),
            name: String(row.name),
            description: row.description ? String(row.description) : null,
            acquisition_time: Number(row.acquisition_time),
            acquisition_cost: Number(row.acquisition_cost),
            useful_life_years: Number(row.useful_life_years),
            salvage_value: Number(row.salvage_value),
            accumulated_depreciation: Number(row.accumulated_depreciation),
            is_fully_depreciated: Number(row.is_fully_depreciated),
            asset_account_code: Number(row.asset_account_code),
            asset_account_name: String(row.asset_account_name),
          });
        });

        state.isLoading = false;
      }
      catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
        state.isLoading = false;
      }
    }

    function goToPage(/** @type {number} */ page) {
      const totalPages = getTotalPages();
      if (page < 1 || page > totalPages) return;
      state.currentPage = page;
      loadFixedAssets();
    }

    /** @param {Event} event */
    function handlePageChange(event) {
      if (!(event.currentTarget instanceof HTMLElement)) return;
      const page = Number(event.currentTarget.dataset.page);
      goToPage(page);
    }

    /** @param {Event} event */
    function handleSearchInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.searchQuery = event.target.value;
      state.currentPage = 1;
      loadFixedAssets();
    }

    /** @param {Event} event */
    function handleDepreciationFilterChange(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      state.depreciationFilter = /** @type {DepreciationFilter} */ (event.currentTarget.dataset.depreciationFilter);
      state.currentPage = 1;
      loadFixedAssets();
    }

    useEffect(host, loadFixedAssets);

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label="Loading fixed assets"
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            min-height: 200px;
            color: var(--md-sys-color-on-surface-variant);
          "
        >
          <div role="progressbar" class="linear indeterminate" style="width: 200px;">
            <div class="track">
              <div class="indicator"></div>
            </div>
          </div>
          <p>Loading fixed assets...</p>
        </div>
      `;
    }

    /**
     * @param {Error} error
     */
    function renderErrorNotice(error) {
      return html`
        <div
          role="alert"
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            min-height: 200px;
            text-align: center;
            padding: 24px;
          "
        >
          <material-symbols name="error" size="48"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">Unable to load fixed assets</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadFixedAssets}>
            <material-symbols name="refresh"></material-symbols>
            Retry
          </button>
        </div>
      `;
    }

    function renderFilterControls() {
      return html`
        <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; flex-wrap: wrap;">
          <!-- Search Field -->
          <div class="outlined-text-field" style="--md-sys-density: -4; width: 200px; min-width: 160px;">
            <div class="container">
              <material-symbols name="search" class="leading-icon" aria-hidden="true"></material-symbols>
              <label for="fixed-asset-search-input">Search</label>
              <input
                ${readValue(state, 'searchQuery')}
                id="fixed-asset-search-input"
                type="text"
                placeholder=" "
                autocomplete="off"
                @input=${handleSearchInput}
              />
            </div>
          </div>

          <!-- Depreciation Filter -->
          <div class="outlined-text-field" style="--md-sys-density: -4; min-width: 180px; anchor-name: --depreciation-filter-menu-anchor;">
            <div class="container">
              <label for="depreciation-filter-input">Status</label>
              <input
                id="depreciation-filter-input"
                type="button"
                value="${state.depreciationFilter}"
                popovertarget="depreciation-filter-menu"
                popovertargetaction="show"
                placeholder=" "
              />
              <label for="depreciation-filter-input" class="trailing-icon">
                <material-symbols name="arrow_drop_down"></material-symbols>
              </label>
            </div>
          </div>
          <menu role="menu" popover id="depreciation-filter-menu" class="dropdown" style="position-anchor: --depreciation-filter-menu-anchor;">
            ${depreciationFilterOptions.map(function (option) {
              return html`
                <li>
                  <button
                    role="menuitem"
                    data-depreciation-filter="${option}"
                    @click=${handleDepreciationFilterChange}
                    popovertarget="depreciation-filter-menu"
                    popovertargetaction="hide"
                    aria-selected=${option === state.depreciationFilter ? 'true' : 'false'}
                  >
                    ${option === state.depreciationFilter ? html`<material-symbols name="check"></material-symbols>` : ''}
                    ${option}
                  </button>
                </li>
              `;
            })}
          </menu>
        </div>
      `;
    }

    function renderEmptyState() {
      return html`
        <div
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            min-height: 300px;
            text-align: center;
            padding: 48px;
          "
        >
          <material-symbols name="real_estate_agent" size="64"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">No fixed assets found</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            ${state.searchQuery || state.depreciationFilter !== 'All'
              ? 'Try adjusting your search or filters.'
              : 'Start by recording your first fixed asset to track depreciation.'}
          </p>
        </div>
      `;
    }

    /**
     * @param {number} isFullyDepreciated
     */
    function getDepreciationStatusStyle(isFullyDepreciated) {
      if (isFullyDepreciated === 1) {
        return 'background-color: var(--md-sys-color-surface-container-highest); color: var(--md-sys-color-on-surface-variant);';
      }
      return 'background-color: #E8F5E9; color: #1B5E20;';
    }

    /**
     * @param {number} isFullyDepreciated
     */
    function getDepreciationStatusText(isFullyDepreciated) {
      return isFullyDepreciated === 1 ? 'Fully Depreciated' : 'Active';
    }

    /**
     * @param {FixedAssetRow} asset
     */
    function renderFixedAssetRow(asset) {
      const bookValue = asset.acquisition_cost - asset.accumulated_depreciation;
      const depreciableAmount = asset.acquisition_cost - asset.salvage_value;
      const depreciationPercentage = depreciableAmount > 0
        ? Math.round((asset.accumulated_depreciation / depreciableAmount) * 100)
        : 100;

      return html`
        <tr>
          <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <span style="font-weight: 500;">
              <button
                role="button"
                type="button"
                class="text extra-small"
                style="--md-sys-density: -4;"
                commandfor="fixed-asset-details-dialog"
                command="--open"
                data-asset-id="${asset.id}"
              >${asset.name}</button>
            </span>
          </td>
          <td style="white-space: nowrap;">
            ${i18n.date.format(new Date(asset.acquisition_time))}
          </td>
          <td class="numeric">${i18n.displayCurrency(asset.acquisition_cost)}</td>
          <td class="numeric">${asset.useful_life_years} years</td>
          <td class="numeric">${i18n.displayCurrency(asset.accumulated_depreciation)}</td>
          <td class="numeric">${i18n.displayCurrency(bookValue)}</td>
          <td class="center">
            <span
              class="label-small"
              style="
                display: inline-flex;
                padding: 4px 8px;
                border-radius: var(--md-sys-shape-corner-small);
                ${getDepreciationStatusStyle(asset.is_fully_depreciated)}
              "
            >${getDepreciationStatusText(asset.is_fully_depreciated)}</span>
          </td>
          <td class="center">
            <div
              style="
                display: inline-flex;
                align-items: center;
                gap: 8px;
                min-width: 80px;
              "
            >
              <div
                style="
                  flex: 1;
                  height: 8px;
                  background-color: var(--md-sys-color-surface-container-highest);
                  border-radius: 4px;
                  overflow: hidden;
                "
              >
                <div
                  style="
                    width: ${depreciationPercentage}%;
                    height: 100%;
                    background-color: ${asset.is_fully_depreciated === 1
                      ? 'var(--md-sys-color-outline)'
                      : 'var(--md-sys-color-primary)'};
                    transition: width 0.3s ease;
                  "
                ></div>
              </div>
              <span class="label-small" style="min-width: 36px; text-align: right;">${depreciationPercentage}%</span>
            </div>
          </td>
        </tr>
      `;
    }

    function renderPaginationControls() {
      const totalPages = getTotalPages();
      if (totalPages <= 1) return nothing;

      const startItem = (state.currentPage - 1) * pageSize + 1;
      const endItem = Math.min(state.currentPage * pageSize, state.totalCount);

      return html`
        <nav
          role="navigation"
          aria-label="Pagination"
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            border-top: 1px solid var(--md-sys-color-outline-variant);
          "
        >
          <span class="body-small" style="color: var(--md-sys-color-on-surface-variant);">
            Showing ${startItem}–${endItem} of ${state.totalCount}
          </span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button
              role="button"
              class="text"
              data-page="1"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === 1}
              aria-label="First page"
            >
              <material-symbols name="first_page"></material-symbols>
            </button>
            <button
              role="button"
              class="text"
              data-page="${state.currentPage - 1}"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === 1}
              aria-label="Previous page"
            >
              <material-symbols name="chevron_left"></material-symbols>
            </button>
            <span class="body-medium" style="min-width: 80px; text-align: center;">
              Page ${state.currentPage} of ${totalPages}
            </span>
            <button
              role="button"
              class="text"
              data-page="${state.currentPage + 1}"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === totalPages}
              aria-label="Next page"
            >
              <material-symbols name="chevron_right"></material-symbols>
            </button>
            <button
              role="button"
              class="text"
              data-page="${totalPages}"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === totalPages}
              aria-label="Last page"
            >
              <material-symbols name="last_page"></material-symbols>
            </button>
          </div>
        </nav>
      `;
    }

    function renderFixedAssetsTable() {
      if (state.fixedAssets.length === 0) return renderEmptyState();

      return html`
        <div>
          <table aria-label="Fixed assets list" style="--md-sys-density: -3;">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" style="width: 120px;">Acquisition Date</th>
                <th scope="col" class="numeric" style="width: 140px;">Acquisition Cost</th>
                <th scope="col" class="numeric" style="width: 100px;">Useful Life</th>
                <th scope="col" class="numeric" style="width: 140px;">Accum. Depr.</th>
                <th scope="col" class="numeric" style="width: 120px;">Book Value</th>
                <th scope="col" class="center" style="width: 130px;">Status</th>
                <th scope="col" class="center" style="width: 140px;">Progress</th>
              </tr>
            </thead>
            <tbody>
              ${state.fixedAssets.map(renderFixedAssetRow)}
            </tbody>
          </table>
          ${renderPaginationControls()}
        </div>
      `;
    }

    useEffect(host, function renderFixedAssetsView() {
      render(html`
        <div style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 12px 24px; height: 100%; overflow-y: scroll;">
          <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; justify-content: space-between;">
            ${renderFilterControls()}
            <div>
              <button role="button" class="text" @click=${loadFixedAssets} aria-label="Refresh fixed assets">
                <material-symbols name="refresh"></material-symbols>
                Refresh
              </button>
              <button role="button" type="button" class="tonal" commandfor="fixed-asset-creation-dialog" command="--open">
                <material-symbols name="add"></material-symbols>
                Add Fixed Asset
              </button>
            </div>
          </div>

          ${state.isLoading ? renderLoadingIndicator() : nothing}
          ${state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
          ${state.isLoading === false && state.error === null ? renderFixedAssetsTable() : nothing}
        </div>

        <fixed-asset-creation-dialog
          id="fixed-asset-creation-dialog"
          @fixed-asset-created=${loadFixedAssets}
        ></fixed-asset-creation-dialog>

        <fixed-asset-details-dialog
          id="fixed-asset-details-dialog"
          @fixed-asset-updated=${loadFixedAssets}
          @fixed-asset-deleted=${loadFixedAssets}
        ></fixed-asset-details-dialog>
      `);
    });
  }
}

defineWebComponent('fixed-assets-view', FixedAssetsViewElement);
