import { html, nothing } from 'lit-html';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { InventoryCreationDialogElement } from '#web/components/inventory-creation-dialog.js';
import { InventoryDetailsDialogElement } from '#web/components/inventory-details-dialog.js';
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
import '#web/components/inventory-creation-dialog.js';
import '#web/components/inventory-details-dialog.js';
import '#web/components/inventory-discounts-edit-dialog.js';
import '#web/components/inventory-price-update-dialog.js';

/**
 * @typedef {object} InventoryRow
 * @property {number} id
 * @property {string} name
 * @property {number} unit_price
 * @property {string | null} unit_of_measurement
 * @property {number} account_code
 * @property {string} account_name
 * @property {number} cost
 * @property {number} stock
 * @property {number} num_of_sales
 * @property {number} discount_count
 */

const stockFilterOptions = /** @type {const} */ (['All', 'In Stock', 'Low Stock', 'Out of Stock', 'Negative Stock']);

/** @typedef {typeof stockFilterOptions[number]} StockFilter */

export class InventoriesViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);

    const inventoryCreationDialog = useElement(host, InventoryCreationDialogElement);
    const inventoryDetailsDialog = useElement(host, InventoryDetailsDialogElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const pageSize = 20;

    const state = reactive({
      inventories: /** @type {InventoryRow[]} */ ([]),
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      searchQuery: '',
      stockFilter: /** @type {StockFilter} */ ('All'),
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
        const stockFilterValue = state.stockFilter;
        const offset = (state.currentPage - 1) * pageSize;

        const countResult = await database.sql`
          SELECT COUNT(*) as count
          FROM inventories i
          WHERE (${searchPattern} IS NULL OR i.name LIKE ${searchPattern})
            AND (${stockFilterValue} = 'All'
              OR (${stockFilterValue} = 'In Stock' AND i.stock > 10)
              OR (${stockFilterValue} = 'Low Stock' AND i.stock > 0 AND i.stock <= 10)
              OR (${stockFilterValue} = 'Out of Stock' AND i.stock = 0)
              OR (${stockFilterValue} = 'Negative Stock' AND i.stock < 0))
        `;
        state.totalCount = Number(countResult.rows[0].count);

        const result = await database.sql`
          SELECT
            i.id,
            i.name,
            i.unit_price,
            i.unit_of_measurement,
            i.account_code,
            a.name as account_name,
            i.cost,
            i.stock,
            i.num_of_sales,
            (SELECT COUNT(*) FROM discounts d WHERE d.inventory_id = i.id) as discount_count
          FROM inventories i
          JOIN accounts a ON a.account_code = i.account_code
          WHERE (${searchPattern} IS NULL OR i.name LIKE ${searchPattern})
            AND (${stockFilterValue} = 'All'
              OR (${stockFilterValue} = 'In Stock' AND i.stock > 10)
              OR (${stockFilterValue} = 'Low Stock' AND i.stock > 0 AND i.stock <= 10)
              OR (${stockFilterValue} = 'Out of Stock' AND i.stock = 0)
              OR (${stockFilterValue} = 'Negative Stock' AND i.stock < 0))
          ORDER BY i.name ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `;

        state.inventories = result.rows.map(function (row) {
          return /** @type {InventoryRow} */ ({
            id: Number(row.id),
            name: String(row.name),
            unit_price: Number(row.unit_price),
            unit_of_measurement: row.unit_of_measurement ? String(row.unit_of_measurement) : null,
            account_code: Number(row.account_code),
            account_name: String(row.account_name),
            cost: Number(row.cost),
            stock: Number(row.stock),
            num_of_sales: Number(row.num_of_sales),
            discount_count: Number(row.discount_count),
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
      assertInstanceOf(HTMLInputElement, event.target);
      state.searchQuery = event.target.value;
      state.currentPage = 1;
      loadInventories();
    }

    /** @param {Event} event */
    function handleStockFilterChange(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      state.stockFilter = /** @type {StockFilter} */ (event.currentTarget.dataset.stockFilter);
      state.currentPage = 1;
      loadInventories();
    }

    useEffect(host, loadInventories);

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label="${t('inventory', 'loadingInventoriesViewAriaLabel')}"
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
          <p>${t('inventory', 'loadingInventoriesViewMessage')}</p>
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
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('inventory', 'unableToLoadInventoriesViewTitle')}</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadInventories}>
            <material-symbols name="refresh"></material-symbols>
            ${t('inventory', 'retryButtonLabel')}
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
              <label for="inventory-search-input">${t('inventory', 'searchLabel')}</label>
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

          <!-- Stock Filter -->
          <div class="outlined-text-field" style="--md-sys-density: -4; min-width: 160px; anchor-name: --stock-filter-menu-anchor;">
            <div class="container">
              <label for="stock-filter-input">${t('inventory', 'stockFilterLabel')}</label>
              <input
                id="stock-filter-input"
                type="button"
                value="${state.stockFilter}"
                popovertarget="stock-filter-menu"
                popovertargetaction="show"
                placeholder=" "
              />
              <label for="stock-filter-input" class="trailing-icon">
                <material-symbols name="arrow_drop_down"></material-symbols>
              </label>
            </div>
          </div>
          <menu role="menu" popover id="stock-filter-menu" class="dropdown" style="position-anchor: --stock-filter-menu-anchor;">
            ${stockFilterOptions.map(function (option) {
              const filterLabelMap = {
                'All': t('inventory', 'filterAll'),
                'In Stock': t('inventory', 'filterInStock'),
                'Low Stock': t('inventory', 'filterLowStock'),
                'Out of Stock': t('inventory', 'filterOutOfStock'),
                'Negative Stock': t('inventory', 'filterNegativeStock'),
              };
              return html`
                <li>
                  <button
                    role="menuitem"
                    data-stock-filter="${option}"
                    @click=${handleStockFilterChange}
                    popovertarget="stock-filter-menu"
                    popovertargetaction="hide"
                    aria-selected=${option === state.stockFilter ? 'true' : 'false'}
                  >
                    ${option === state.stockFilter ? html`<material-symbols name="check"></material-symbols>` : ''}
                    ${filterLabelMap[option] || option}
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
          <material-symbols name="inventory_2" size="64"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('inventory', 'noInventoriesFoundTitle')}</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            ${state.searchQuery || state.stockFilter !== 'All'
              ? t('inventory', 'adjustSearchOrFiltersMessage')
              : t('inventory', 'addFirstInventoryMessage')}
          </p>
          ${!state.searchQuery && state.stockFilter === 'All' ? html`
            <button
              role="button"
              type="button"
              class="tonal"
              commandfor="inventory-creation-dialog"
              command="--open"
            >
              <material-symbols name="add"></material-symbols>
              ${t('inventory', 'addInventoryButtonLabel')}
            </button>
          ` : nothing}
        </div>
      `;
    }

    /**
     * @param {number} stock
     */
    function getStockStatusStyle(stock) {
      if (stock < 0) return 'background-color: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container);';
      if (stock === 0) return 'background-color: var(--md-sys-color-surface-container-highest); color: var(--md-sys-color-on-surface-variant);';
      if (stock <= 10) return 'background-color: #FFF3E0; color: #E65100;';
      return 'background-color: #E8F5E9; color: #1B5E20;';
    }

    /**
     * @param {number} stock
     */
    function getStockStatusText(stock) {
      if (stock < 0) return t('inventory', 'stockStatusNegativeStock');
      if (stock === 0) return t('inventory', 'stockStatusOutOfStock');
      if (stock <= 10) return t('inventory', 'stockStatusLowStock');
      return t('inventory', 'stockStatusInStock');
    }

    /**
     * @param {InventoryRow} inventory
     */
    function renderInventoryRow(inventory) {
      const avgCostPerUnit = inventory.stock > 0 ? Math.round(inventory.cost / inventory.stock) : 0;

      return html`
        <tr>
          <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <span style="font-weight: 500;">
              <button
                role="button"
                type="button"
                class="text extra-small"
                style="--md-sys-density: -4;"
                commandfor="inventory-details-dialog"
                command="--open"
                data-inventory-id="${inventory.id}"
              >${inventory.name}</button>
            </span>
          </td>
          <td class="numeric">
            <div style="display: inline-flex; align-items: center; gap: 4px;">
              ${i18n.displayCurrency(inventory.unit_price)}
              <button
                role="button"
                type="button"
                class="text extra-small"
                style="--md-sys-density: -4;"
                commandfor="inventory-price-update-dialog"
                command="--open"
                data-inventory-id="${inventory.id}"
                aria-label="${t('inventory', 'updatePriceAriaLabel', inventory.name)}"
              >
                <material-symbols name="edit" size="18"></material-symbols>
              </button>
            </div>
          </td>
          <td class="numeric" style="color: ${inventory.stock < 0 ? 'var(--md-sys-color-error)' : 'inherit'}; white-space: nowrap;">
            ${inventory.stock} ${inventory.unit_of_measurement ? html`
              <span style="color: var(--md-sys-color-on-surface-variant); font-size: 0.875rem;">${inventory.unit_of_measurement}</span>
            ` : nothing}
          </td>
          <td class="center">
            <span
              class="label-small"
              style="
                display: inline-flex;
                padding: 4px 8px;
                border-radius: var(--md-sys-shape-corner-small);
                ${getStockStatusStyle(inventory.stock)}
              "
            >${getStockStatusText(inventory.stock)}</span>
          </td>
          <td class="numeric">${i18n.displayCurrency(inventory.cost)}</td>
          <td class="numeric">${inventory.stock > 0 ? i18n.displayCurrency(avgCostPerUnit) : '—'}</td>
          <td class="numeric">${inventory.num_of_sales}</td>
          <td class="center">
            <div style="display: inline-flex; align-items: center; gap: 4px;">
              ${inventory.discount_count}
              <button
                role="button"
                type="button"
                class="text extra-small"
                style="--md-sys-density: -4;"
                commandfor="inventory-discounts-edit-dialog"
                command="--open"
                data-inventory-id="${inventory.id}"
                aria-label="${t('inventory', 'editDiscountsAriaLabel', inventory.name)}"
              >
                <material-symbols name="edit" size="18"></material-symbols>
              </button>
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
            ${t('inventory', 'paginationInfo', startItem, endItem, state.totalCount)}
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
              aria-label="${t('inventory', 'previousPageAriaLabel')}"
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
              aria-label="${t('inventory', 'nextPageAriaLabel')}"
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

    function renderInventoriesTable() {
      if (state.inventories.length === 0) return renderEmptyState();

      return html`
        <div>
          <table aria-label="${t('inventory', 'inventoriesListAriaLabel')}" style="--md-sys-density: -3;">
            <thead>
              <tr>
                <th scope="col">${t('inventory', 'tableHeaderName')}</th>
                <th scope="col" class="numeric" style="width: 120px;">${t('inventory', 'tableHeaderUnitPrice')}</th>
                <th scope="col" class="numeric" style="width: 80px;">${t('inventory', 'tableHeaderStock')}</th>
                <th scope="col" class="center" style="width: 100px;">${t('inventory', 'tableHeaderStatus')}</th>
                <th scope="col" class="numeric" style="width: 120px;">${t('inventory', 'tableHeaderTotalCost')}</th>
                <th scope="col" class="numeric" style="width: 120px;">${t('inventory', 'tableHeaderAvgCost')}</th>
                <th scope="col" class="numeric" style="width: 80px;">${t('inventory', 'tableHeaderSales')}</th>
                <th scope="col" class="center" style="width: 120px;">${t('inventory', 'tableHeaderDiscounts')}</th>
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

    useEffect(host, function renderInventoriesView() {
      render(html`
        <div style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 12px 24px; height: 100%; overflow-y: scroll;">
          <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; justify-content: space-between;">
            ${renderFilterControls()}
            <div>
              <button role="button" class="text" @click=${loadInventories} aria-label="${t('inventory', 'refreshAriaLabel')}">
                <material-symbols name="refresh"></material-symbols>
                ${t('inventory', 'refreshButtonLabel')}
              </button>
              <button role="button" type="button" class="tonal" commandfor="inventory-creation-dialog" command="--open">
                <material-symbols name="add"></material-symbols>
                ${t('inventory', 'addInventoryButtonLabel')}
              </button>
            </div>
          </div>

          ${state.isLoading ? renderLoadingIndicator() : nothing}
          ${state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
          ${state.isLoading === false && state.error === null ? renderInventoriesTable() : nothing}
        </div>

        <inventory-creation-dialog
          ${inventoryCreationDialog}
          id="inventory-creation-dialog"
          @inventory-created=${loadInventories}
        ></inventory-creation-dialog>

        <inventory-details-dialog
          ${inventoryDetailsDialog}
          id="inventory-details-dialog"
          inventory-id=${state.selectedInventoryId}
          @inventory-updated=${loadInventories}
        ></inventory-details-dialog>

        <inventory-price-update-dialog
          id="inventory-price-update-dialog"
          @inventory-price-updated=${loadInventories}
        ></inventory-price-update-dialog>

        <inventory-discounts-edit-dialog
          id="inventory-discounts-edit-dialog"
          @inventory-discounts-updated=${loadInventories}
        ></inventory-discounts-edit-dialog>
      `);
    });
  }
}

defineWebComponent('inventories-view', InventoriesViewElement);
