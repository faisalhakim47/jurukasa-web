import { html, nothing } from 'lit-html';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { StockTakingDialogElement } from '#web/components/stock-taking-dialog.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { readValue } from '#web/directives/read-value.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

import '#web/components/material-symbols.js';
import '#web/components/stock-taking-dialog.js';

/**
 * @typedef {object} InventoryRow
 * @property {number} id
 * @property {string} name
 * @property {number} unit_price
 * @property {string | null} unit_of_measurement
 * @property {number} cost
 * @property {number} stock
 * @property {number | null} latest_stock_taking_time
 */

export class StockTakingCreationViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);

    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const pageSize = 20;

    const state = reactive({
      inventories: /** @type {InventoryRow[]} */ ([]),
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      searchQuery: '',
      currentPage: 1,
      totalCount: 0,
      selectedInventoryId: /** @type {number | null} */ (null),
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false;
    });

    function getTotalPages() {
      return Math.max(1, Math.ceil(state.totalCount / pageSize));
    }

    async function loadInventories() {
      try {
        state.isLoading = true;
        state.error = null;

        const searchQueryValue = state.searchQuery.trim() || null;
        const searchPattern = searchQueryValue ? `%${searchQueryValue}%` : null;
        const offset = (state.currentPage - 1) * pageSize;

        const countResult = await database.sql`
          SELECT COUNT(*) as count
          FROM inventories i
          WHERE (${searchPattern} IS NULL OR i.name LIKE ${searchPattern})
        `;
        state.totalCount = Number(countResult.rows[0].count);

        // Order by latest_stock_taking_time ASC (NULL first = never audited)
        // Then by name ASC for consistent ordering
        const result = await database.sql`
          SELECT
            i.id,
            i.name,
            i.unit_price,
            i.unit_of_measurement,
            i.cost,
            i.stock,
            i.latest_stock_taking_time
          FROM inventories i
          WHERE (${searchPattern} IS NULL OR i.name LIKE ${searchPattern})
          ORDER BY 
            CASE WHEN i.latest_stock_taking_time IS NULL THEN 0 ELSE 1 END ASC,
            i.latest_stock_taking_time ASC,
            i.name ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `;

        state.inventories = result.rows.map(function rowToInventory(row) {
          return /** @type {InventoryRow} */ ({
            id: Number(row.id),
            name: String(row.name),
            unit_price: Number(row.unit_price),
            unit_of_measurement: row.unit_of_measurement ? String(row.unit_of_measurement) : null,
            cost: Number(row.cost),
            stock: Number(row.stock),
            latest_stock_taking_time: row.latest_stock_taking_time ? Number(row.latest_stock_taking_time) : null,
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
      loadInventories();
    }

    /** @param {Event} event */
    function handlePageChange(event) {
      if (!(event.currentTarget instanceof HTMLElement)) return;
      const page = Number(event.currentTarget.dataset.page);
      goToPage(page);
    }

    /** @param {Event} event */
    function handleSearchInput(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      state.searchQuery = event.currentTarget.value;
      state.currentPage = 1;
      loadInventories();
    }

    function handleStockTakingCreated() {
      loadInventories();
    }

    useEffect(host, loadInventories);

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label="${t('stock', 'loadingInventoriesCreationAriaLabel')}"
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
          <p>${t('stock', 'loadingInventoriesCreationMessage')}</p>
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
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('stock', 'unableToLoadInventoriesCreationTitle')}</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadInventories}>
            <material-symbols name="refresh"></material-symbols>
            ${t('stock', 'retryButtonLabel')}
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
              <label for="inventory-search-input">${t('stock', 'searchLabel')}</label>
              <input
                ${readValue(state, 'searchQuery')}
                id="inventory-search-input"
                type="text"
                placeholder=" "
                autocomplete="off"
                @input=${handleSearchInput}
              />
            </div>
          </div>
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
          <material-symbols name="inventory_2" size="64"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('stock', 'noInventoriesFoundCreationTitle')}</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            ${state.searchQuery
              ? t('stock', 'adjustSearchQueryMessage')
              : t('stock', 'addInventoryFirstMessage')}
          </p>
        </div>
      `;
    }

    /**
     * @param {number | null} latestStockTakingTime
     */
    function getAuditStatusStyle(latestStockTakingTime) {
      if (latestStockTakingTime === null) return 'background-color: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container);';
      const daysSinceAudit = Math.floor((Date.now() - latestStockTakingTime) / (1000 * 60 * 60 * 24));
      if (daysSinceAudit > 30) return 'background-color: #FFF3E0; color: #E65100;';
      if (daysSinceAudit > 7) return 'background-color: #FFFDE7; color: #F57F17;';
      return 'background-color: #E8F5E9; color: #1B5E20;';
    }

    /**
     * @param {number | null} latestStockTakingTime
     */
    function getAuditStatusText(latestStockTakingTime) {
      if (latestStockTakingTime === null) return t('stock', 'auditStatusNever');
      const daysSinceAudit = Math.floor((Date.now() - latestStockTakingTime) / (1000 * 60 * 60 * 24));
      if (daysSinceAudit > 30) return t('stock', 'auditStatusOverdue');
      if (daysSinceAudit > 7) return t('stock', 'auditStatusDueSoon');
      return t('stock', 'auditStatusRecent');
    }

    /**
     * @param {InventoryRow} inventory
     */
    function renderInventoryRow(inventory) {
      return html`
        <tr data-inventory-id="${inventory.id}">
          <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <span style="font-weight: 500;">${inventory.name}</span>
          </td>
          <td class="right numeric" style="color: ${inventory.stock < 0 ? 'var(--md-sys-color-error)' : 'inherit'};">
            <span style="display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
              <span>${inventory.stock}</span>
              ${inventory.unit_of_measurement ? html`
                <span style="color: var(--md-sys-color-on-surface-variant); font-size: 0.875rem;"> / ${inventory.unit_of_measurement}</span>
              ` : nothing}
              <button
                role="button"
                type="button"
                class="text extra-small"
                style="--md-sys-density: -4;"
                commandfor="stock-taking-dialog"
                command="--open"
                data-inventory-id="${inventory.id}"
              >
                <material-symbols name="fact_check"></material-symbols>
                ${t('stock', 'auditButtonLabel')}
              </button>
            </span>
          </td>
          <td class="numeric">${i18n.displayCurrency(inventory.cost)}</td>
          <td style="white-space: nowrap;">
            ${inventory.latest_stock_taking_time !== null
              ? i18n.date.format(inventory.latest_stock_taking_time)
              : html`<span style="color: var(--md-sys-color-on-surface-variant);">—</span>`}
          </td>
          <td class="center">
            <span
              class="label-small"
              style="
                display: inline-flex;
                padding: 4px 8px;
                border-radius: var(--md-sys-shape-corner-small);
                ${getAuditStatusStyle(inventory.latest_stock_taking_time)}
              "
            >${getAuditStatusText(inventory.latest_stock_taking_time)}</span>
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
            ${t('stock', 'showingPaginationInfo', startItem, endItem, state.totalCount)}
          </span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button
              role="button"
              class="text"
              data-page="1"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === 1}
              aria-label="${t('stock', 'firstPageAriaLabel')}"
            >
              <material-symbols name="first_page"></material-symbols>
            </button>
            <button
              role="button"
              class="text"
              data-page="${state.currentPage - 1}"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === 1}
              aria-label="${t('stock', 'previousPageAriaLabel')}"
            >
              <material-symbols name="chevron_left"></material-symbols>
            </button>
            <span class="body-medium" style="min-width: 80px; text-align: center;">
              ${t('stock', 'pageOfPageInfo', state.currentPage, totalPages)}
            </span>
            <button
              role="button"
              class="text"
              data-page="${state.currentPage + 1}"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === totalPages}
              aria-label="${t('stock', 'nextPageAriaLabel')}"
            >
              <material-symbols name="chevron_right"></material-symbols>
            </button>
            <button
              role="button"
              class="text"
              data-page="${totalPages}"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === totalPages}
              aria-label="${t('stock', 'lastPageAriaLabel')}"
            >
              <material-symbols name="last_page"></material-symbols>
            </button>
          </div>
        </nav>
      `;
    }

    function renderInventoriesTable() {
      if (state.inventories.length === 0) return renderEmptyState();

      return html`
        <div>
          <table aria-label="${t('stock', 'inventoriesTableAriaLabel')}" style="--md-sys-density: -3;">
            <thead>
              <tr>
                <th scope="col">${t('stock', 'tableHeaderName')}</th>
                <th scope="col" class="center numeric" style="width: 80px;">${t('stock', 'tableHeaderStock')}</th>
                <th scope="col" style="width: 140px;">${t('stock', 'tableHeaderLastAudit')}</th>
                <th scope="col" class="numeric" style="width: 120px;">${t('stock', 'tableHeaderCost')}</th>
                <th scope="col" class="center" style="width: 120px;">${t('stock', 'tableHeaderStatus')}</th>
              </tr>
            </thead>
            <tbody>
              ${state.inventories.map(renderInventoryRow)}
            </tbody>
          </table>
          ${renderPaginationControls()}
        </div>
      `;
    }

    useEffect(host, function renderStockTakingCreationView() {
      render(html`
        <div style="display: flex; flex-direction: column; height: 100%;">
          <header class="app-bar" style="max-width: 1280px; margin: 0 auto; width: 100%; flex-shrink: 0;">
            <hgroup>
              <h1>${t('stock', 'newStockTakingTitle')}</h1>
              <p>${t('stock', 'newStockTakingDescription')}</p>
            </hgroup>
          </header>
          
          <div style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 12px 24px; flex: 1; overflow-y: scroll; max-width: 1280px; margin: 0 auto; width: 100%;">
            <div style="
              background-color: var(--md-sys-color-secondary-container);
              color: var(--md-sys-color-on-secondary-container);
              padding: 16px;
              border-radius: var(--md-sys-shape-corner-medium);
              margin-bottom: 8px;
            ">
              <div style="display: flex; align-items: center; gap: 12px;">
                <material-symbols name="info" size="24"></material-symbols>
                <div>
                  <p class="body-medium" style="margin: 0;">
                    ${t('stock', 'stockTakingInfoMessage')}
                  </p>
                </div>
              </div>
            </div>

            <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; justify-content: space-between;">
              ${renderFilterControls()}
              <div>
                <button role="button" class="text" @click=${loadInventories} aria-label="${t('stock', 'refreshAriaLabel')}">
                  <material-symbols name="refresh"></material-symbols>
                  ${t('stock', 'refreshButtonLabel')}
                </button>
              </div>
            </div>

            ${state.isLoading ? renderLoadingIndicator() : nothing}
            ${state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
            ${state.isLoading === false && state.error === null ? renderInventoriesTable() : nothing}
          </div>
        </div>

        <stock-taking-dialog
          id="stock-taking-dialog"
          @stock-taking-created=${handleStockTakingCreated}
        ></stock-taking-dialog>
      `);
    });
  }
}

defineWebComponent('stock-taking-creation-view', StockTakingCreationViewElement);
