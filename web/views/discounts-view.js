import { html, nothing } from 'lit-html';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { DiscountCreationDialogElement } from '#web/components/discount-creation-dialog.js';
import { DiscountDetailsDialogElement } from '#web/components/discount-details-dialog.js';
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
import '#web/components/discount-creation-dialog.js';
import '#web/components/discount-details-dialog.js';

/**
 * @typedef {object} DiscountRow
 * @property {number} id
 * @property {string} name
 * @property {number | null} inventory_id
 * @property {string | null} inventory_name
 * @property {number} multiple_of_quantity
 * @property {number} amount
 */

const typeFilterOptions = /** @type {const} */ (['All', 'Global', 'Inventory-specific']);

/** @typedef {typeof typeFilterOptions[number]} TypeFilter */

export class DiscountsViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);

    const discountCreationDialog = useElement(host, DiscountCreationDialogElement);
    const discountDetailsDialog = useElement(host, DiscountDetailsDialogElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const pageSize = 20;

    const state = reactive({
      discounts: /** @type {DiscountRow[]} */ ([]),
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      searchQuery: '',
      typeFilter: /** @type {TypeFilter} */ ('All'),
      currentPage: 1,
      totalCount: 0,
      selectedDiscountId: /** @type {number | null} */ (null),
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false;
    });

    function getTotalPages() {
      return Math.max(1, Math.ceil(state.totalCount / pageSize));
    }

    async function loadDiscounts() {
      try {
        state.isLoading = true;
        state.error = null;

        const searchQueryValue = state.searchQuery.trim() || null;
        const searchPattern = searchQueryValue ? `%${searchQueryValue}%` : null;
        const typeFilterValue = state.typeFilter;
        const offset = (state.currentPage - 1) * pageSize;

        const countResult = await database.sql`
          SELECT COUNT(*) as count
          FROM discounts d
          LEFT JOIN inventories i ON i.id = d.inventory_id
          WHERE (${searchPattern} IS NULL OR d.name LIKE ${searchPattern} OR i.name LIKE ${searchPattern})
            AND (${typeFilterValue} = 'All'
              OR (${typeFilterValue} = 'Global' AND d.inventory_id IS NULL)
              OR (${typeFilterValue} = 'Inventory-specific' AND d.inventory_id IS NOT NULL))
        `;
        state.totalCount = Number(countResult.rows[0].count);

        const result = await database.sql`
          SELECT
            d.id,
            d.name,
            d.inventory_id,
            i.name as inventory_name,
            d.multiple_of_quantity,
            d.amount
          FROM discounts d
          LEFT JOIN inventories i ON i.id = d.inventory_id
          WHERE (${searchPattern} IS NULL OR d.name LIKE ${searchPattern} OR i.name LIKE ${searchPattern})
            AND (${typeFilterValue} = 'All'
              OR (${typeFilterValue} = 'Global' AND d.inventory_id IS NULL)
              OR (${typeFilterValue} = 'Inventory-specific' AND d.inventory_id IS NOT NULL))
          ORDER BY d.name ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `;

        state.discounts = result.rows.map(function (row) {
          return /** @type {DiscountRow} */ ({
            id: Number(row.id),
            name: String(row.name),
            inventory_id: row.inventory_id ? Number(row.inventory_id) : null,
            inventory_name: row.inventory_name ? String(row.inventory_name) : null,
            multiple_of_quantity: Number(row.multiple_of_quantity),
            amount: Number(row.amount),
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
      loadDiscounts();
    }

    function handleFirstPage() {
      goToPage(1);
    }

    function handlePreviousPage() {
      goToPage(state.currentPage - 1);
    }

    function handleNextPage() {
      goToPage(state.currentPage + 1);
    }

    function handleLastPage() {
      goToPage(getTotalPages());
    }

    /** @param {Event} event */
    function handleSearchInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.searchQuery = event.target.value;
      state.currentPage = 1;
      loadDiscounts();
    }

    /** @param {Event} event */
    function handleTypeFilterChange(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      state.typeFilter = /** @type {TypeFilter} */ (event.currentTarget.dataset.typeFilter);
      state.currentPage = 1;
      loadDiscounts();
    }

    useEffect(host, loadDiscounts);

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label="Loading discounts"
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
          <p>Loading discounts...</p>
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
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">Unable to load discounts</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadDiscounts}>
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
          <div class="outlined-text-field" style="--md-sys-density: -4; width: 250px; min-width: 160px;">
            <div class="container">
              <material-symbols name="search" class="leading-icon" aria-hidden="true"></material-symbols>
              <label for="discount-search-input">Search</label>
              <input
                ${readValue(state, 'searchQuery')}
                id="discount-search-input"
                type="text"
                placeholder=" "
                autocomplete="off"
                @input=${handleSearchInput}
              />
            </div>
          </div>

          <!-- Type Filter -->
          <div class="outlined-text-field" style="--md-sys-density: -4; min-width: 180px; anchor-name: --type-filter-menu-anchor;">
            <div class="container">
              <label for="type-filter-input">Type</label>
              <input
                id="type-filter-input"
                type="button"
                value="${state.typeFilter}"
                popovertarget="type-filter-menu"
                popovertargetaction="show"
                placeholder=" "
              />
              <label for="type-filter-input" class="trailing-icon">
                <material-symbols name="arrow_drop_down"></material-symbols>
              </label>
            </div>
          </div>
          <menu role="menu" popover id="type-filter-menu" class="dropdown" style="position-anchor: --type-filter-menu-anchor;">
            ${typeFilterOptions.map((option) => html`
              <li>
                <button
                  role="menuitem"
                  data-type-filter="${option}"
                  @click=${handleTypeFilterChange}
                  popovertarget="type-filter-menu"
                  popovertargetaction="hide"
                  aria-selected=${option === state.typeFilter ? 'true' : 'false'}
                >
                  ${option === state.typeFilter ? html`<material-symbols name="check"></material-symbols>` : ''}
                  ${option}
                </button>
              </li>
            `)}
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
          <material-symbols name="percent" size="64"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">No discounts found</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            ${state.searchQuery || state.typeFilter !== 'All'
          ? 'Try adjusting your search or filters.'
          : 'Create your first discount to offer promotions and savings to your customers.'}
          </p>
          ${!state.searchQuery && state.typeFilter === 'All' ? html`
            <button
              role="button"
              type="button"
              class="tonal"
              commandfor="discount-creation-dialog"
              command="--open"
            >
              <material-symbols name="add"></material-symbols>
              Create Discount
            </button>
          ` : nothing}
        </div>
      `;
    }

    /** @param {DiscountRow} discount */
    function renderDiscountRow(discount) {
      const isGlobal = discount.inventory_id === null;
      const typeLabel = isGlobal ? 'Global' : 'Inventory-specific';
      return html`
        <tr>
          <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <button
              role="button"
              type="button"
              class="text extra-small"
              style="--md-sys-density: -4;"
              commandfor="discount-details-dialog"
              command="--open"
              data-discount-id="${discount.id}"
            >${discount.name}</span>
          </td>
          <td style="color: var(--md-sys-color-on-surface-variant);">
            ${discount.inventory_name || '—'}
          </td>
          <td class="center">
            <span
              class="label-small"
              style="
                display: inline-flex;
                padding: 4px 8px;
                border-radius: var(--md-sys-shape-corner-small);
                background-color: ${isGlobal ? 'var(--md-sys-color-tertiary-container)' : 'var(--md-sys-color-secondary-container)'};
                color: ${isGlobal ? 'var(--md-sys-color-on-tertiary-container)' : 'var(--md-sys-color-on-secondary-container)'};
              "
            >${typeLabel}</span>
          </td>
          <td class="numeric">
            ${discount.multiple_of_quantity}x
          </td>
          <td class="numeric" style="color: var(--md-sys-color-primary); font-weight: 500;">
            ${i18n.displayCurrency(discount.amount)}
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
              @click=${handleFirstPage}
              ?disabled=${state.currentPage === 1}
              aria-label="First page"
            >
              <material-symbols name="first_page"></material-symbols>
            </button>
            <button
              role="button"
              class="text"
              @click=${handlePreviousPage}
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
              @click=${handleNextPage}
              ?disabled=${state.currentPage === totalPages}
              aria-label="Next page"
            >
              <material-symbols name="chevron_right"></material-symbols>
            </button>
            <button
              role="button"
              class="text"
              @click=${handleLastPage}
              ?disabled=${state.currentPage === totalPages}
              aria-label="Last page"
            >
              <material-symbols name="last_page"></material-symbols>
            </button>
          </div>
        </nav>
      `;
    }

    function renderDiscountsTable() {
      if (state.discounts.length === 0) return renderEmptyState();
      return html`
        <div>
          <table aria-label="Discounts list" style="--md-sys-density: -3;">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" style="width: 200px;">Inventory</th>
                <th scope="col" class="center" style="width: 140px;">Type</th>
                <th scope="col" class="numeric" style="width: 100px;">Every</th>
                <th scope="col" class="numeric" style="width: 120px;">Discount</th>
              </tr>
            </thead>
            <tbody>
              ${state.discounts.map(renderDiscountRow)}
            </tbody>
          </table>
          ${renderPaginationControls()}
        </div>
      `;
    }

    useEffect(host, function renderDiscountsView() {
      render(html`
        <div style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 12px 24px; height: 100%; overflow-y: scroll;">
          <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; justify-content: space-between;">
            ${renderFilterControls()}
            <div>
              <button role="button" class="text" @click=${loadDiscounts} aria-label="Refresh discounts">
                <material-symbols name="refresh"></material-symbols>
                Refresh
              </button>
              <button role="button" type="button" class="tonal" commandfor="discount-creation-dialog" command="--open">
                <material-symbols name="add"></material-symbols>
                Create Discount
              </button>
            </div>
          </div>

          ${state.isLoading ? renderLoadingIndicator() : nothing}
          ${state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
          ${state.isLoading === false && state.error === null ? renderDiscountsTable() : nothing}
        </div>

        <discount-creation-dialog
          ${discountCreationDialog}
          id="discount-creation-dialog"
          @discount-created=${loadDiscounts}
        ></discount-creation-dialog>

        <discount-details-dialog
          ${discountDetailsDialog}
          id="discount-details-dialog"
          discount-id=${state.selectedDiscountId}
          @discount-updated=${loadDiscounts}
          @discount-deleted=${loadDiscounts}
        ></discount-details-dialog>
      `);
    });
  }
}

defineWebComponent('discounts-view', DiscountsViewElement);
