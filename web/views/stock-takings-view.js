import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';

import '#web/components/material-symbols.js';
import '#web/components/router-link.js';

/**
 * @typedef {object} StockTakingRow
 * @property {number} id
 * @property {number} inventory_id
 * @property {string} inventory_name
 * @property {number} audit_time
 * @property {number} expected_stock
 * @property {number} actual_stock
 * @property {number} expected_cost
 * @property {number} actual_cost
 * @property {number} variance_stock
 * @property {number} variance_cost
 */

const varianceFilterOptions = /** @type {const} */ (['All', 'Gains Only', 'Losses Only', 'No Change']);

/** @typedef {typeof varianceFilterOptions[number]} VarianceFilter */

export class StockTakingsViewElement extends HTMLElement {
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
      stockTakings: /** @type {StockTakingRow[]} */ ([]),
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      varianceFilter: /** @type {VarianceFilter} */ ('All'),
      currentPage: 1,
      totalCount: 0,
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false;
    });

    /**
     * @param {VarianceFilter} filter
     */
    function translateVarianceFilter(filter) {
      switch (filter) {
        case 'All': return t('stock', 'varianceFilterAll');
        case 'Gains Only': return t('stock', 'varianceFilterGainsOnly');
        case 'Losses Only': return t('stock', 'varianceFilterLossesOnly');
        case 'No Change': return t('stock', 'varianceFilterNoChange');
        default: return filter;
      }
    }

    function getTotalPages() {
      return Math.max(1, Math.ceil(state.totalCount / pageSize));
    }

    async function loadStockTakings() {
      try {
        state.isLoading = true;
        state.error = null;

        const varianceFilterValue = state.varianceFilter;
        const offset = (state.currentPage - 1) * pageSize;

        const countResult = await database.sql`
          SELECT COUNT(*) as count
          FROM stock_takings st
          WHERE (${varianceFilterValue} = 'All'
            OR (${varianceFilterValue} = 'Gains Only' AND st.actual_cost > st.expected_cost)
            OR (${varianceFilterValue} = 'Losses Only' AND st.actual_cost < st.expected_cost)
            OR (${varianceFilterValue} = 'No Change' AND st.actual_cost = st.expected_cost))
        `;
        state.totalCount = Number(countResult.rows[0].count);

        const result = await database.sql`
          SELECT
            st.id,
            st.inventory_id,
            i.name as inventory_name,
            st.audit_time,
            st.expected_stock,
            st.actual_stock,
            st.expected_cost,
            st.actual_cost,
            (st.actual_stock - st.expected_stock) as variance_stock,
            (st.actual_cost - st.expected_cost) as variance_cost
          FROM stock_takings st
          JOIN inventories i ON i.id = st.inventory_id
          WHERE (${varianceFilterValue} = 'All'
            OR (${varianceFilterValue} = 'Gains Only' AND st.actual_cost > st.expected_cost)
            OR (${varianceFilterValue} = 'Losses Only' AND st.actual_cost < st.expected_cost)
            OR (${varianceFilterValue} = 'No Change' AND st.actual_cost = st.expected_cost))
          ORDER BY st.audit_time DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `;

        state.stockTakings = result.rows.map(function rowToStockTaking(row) {
          return /** @type {StockTakingRow} */ ({
            id: Number(row.id),
            inventory_id: Number(row.inventory_id),
            inventory_name: String(row.inventory_name),
            audit_time: Number(row.audit_time),
            expected_stock: Number(row.expected_stock),
            actual_stock: Number(row.actual_stock),
            expected_cost: Number(row.expected_cost),
            actual_cost: Number(row.actual_cost),
            variance_stock: Number(row.variance_stock),
            variance_cost: Number(row.variance_cost),
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
      loadStockTakings();
    }

    /** @param {Event} event */
    function handlePageChange(event) {
      if (!(event.currentTarget instanceof HTMLElement)) return;
      const page = Number(event.currentTarget.dataset.page);
      goToPage(page);
    }

    /** @param {Event} event */
    function handleVarianceFilterChange(event) {
      if (!(event.currentTarget instanceof HTMLButtonElement)) return;
      state.varianceFilter = /** @type {VarianceFilter} */ (event.currentTarget.dataset.varianceFilter);
      state.currentPage = 1;
      loadStockTakings();
    }

    useEffect(host, loadStockTakings);

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label="${t('stock', 'loadingStockTakingsAriaLabel')}"
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
          <p>${t('stock', 'loadingStockTakingsMessage')}</p>
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
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('stock', 'unableToLoadStockTakingsTitle')}</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadStockTakings}>
            <material-symbols name="refresh"></material-symbols>
            ${t('stock', 'retryButtonLabel')}
          </button>
        </div>
      `;
    }

    function renderFilterControls() {
      return html`
        <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; flex-wrap: wrap;">
          <!-- Variance Filter -->
          <div class="outlined-text-field" style="--md-sys-density: -4; min-width: 160px; anchor-name: --variance-filter-menu-anchor;">
            <div class="container">
              <label for="variance-filter-input">${t('stock', 'varianceFilterLabel')}</label>
              <input
                id="variance-filter-input"
                type="button"
                value="${translateVarianceFilter(state.varianceFilter)}"
                popovertarget="variance-filter-menu"
                popovertargetaction="show"
                placeholder=" "
              />
              <label for="variance-filter-input" class="trailing-icon">
                <material-symbols name="arrow_drop_down"></material-symbols>
              </label>
            </div>
          </div>
          <menu role="menu" popover id="variance-filter-menu" class="dropdown" style="position-anchor: --variance-filter-menu-anchor;">
            ${repeat(varianceFilterOptions, (option) => option, (option) => html`
              <li>
                <button
                  role="menuitem"
                  data-variance-filter="${option}"
                  @click=${handleVarianceFilterChange}
                  popovertarget="variance-filter-menu"
                  popovertargetaction="hide"
                  aria-selected=${option === state.varianceFilter ? 'true' : 'false'}
                >
                  ${option === state.varianceFilter ? html`<material-symbols name="check"></material-symbols>` : ''}
                  ${translateVarianceFilter(option)}
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
          <material-symbols name="fact_check" size="64"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('stock', 'noStockTakingsFoundTitle')}</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            ${state.varianceFilter !== 'All'
              ? t('stock', 'adjustFilterMessage')
              : t('stock', 'performStockTakingMessage')}
          </p>
          ${state.varianceFilter === 'All' ? html`
            <a
              is="router-link"
              role="button"
              class="tonal"
              href="/stock/stock-taking-creation"
            >
              <material-symbols name="add"></material-symbols>
              ${t('stock', 'newStockTakingButtonLabel')}
            </a>
          ` : nothing}
        </div>
      `;
    }

    /**
     * @param {number} variance
     */
    function getVarianceStyle(variance) {
      if (variance > 0) return 'color: #1B5E20;';
      if (variance < 0) return 'color: var(--md-sys-color-error);';
      return 'color: var(--md-sys-color-on-surface-variant);';
    }

    /**
     * @param {number} variance
     */
    function getVarianceStatusStyle(variance) {
      if (variance > 0) return 'background-color: #E8F5E9; color: #1B5E20;';
      if (variance < 0) return 'background-color: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container);';
      return 'background-color: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface-variant);';
    }

    /**
     * @param {number} variance
     */
    function getVarianceStatusText(variance) {
      if (variance > 0) return t('stock', 'statusGain');
      if (variance < 0) return t('stock', 'statusLoss');
      return t('stock', 'statusNoChange');
    }

    /**
     * @param {StockTakingRow} stockTaking
     */
    function renderStockTakingRow(stockTaking) {
      return html`
        <tr aria-label="${t('stock', 'stockTakingRowAriaLabel', stockTaking.id, stockTaking.inventory_name)}">
          <td class="label-large" style="color: var(--md-sys-color-primary);">#${stockTaking.id}</td>
          <td style="white-space: nowrap;">${i18n.date.format(stockTaking.audit_time)}</td>
          <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;">
            ${stockTaking.inventory_name}
          </td>
          <td class="numeric">${stockTaking.expected_stock}</td>
          <td class="numeric">${stockTaking.actual_stock}</td>
          <td class="numeric" style="${getVarianceStyle(stockTaking.variance_stock)}">
            ${stockTaking.variance_stock > 0 ? '+' : ''}${stockTaking.variance_stock}
          </td>
          <td class="numeric" style="${getVarianceStyle(stockTaking.variance_cost)}">
            ${stockTaking.variance_cost > 0 ? '+' : ''}${i18n.displayCurrency(stockTaking.variance_cost)}
          </td>
          <td class="center">
            <span
              class="label-small"
              style="
                display: inline-flex;
                padding: 4px 8px;
                border-radius: var(--md-sys-shape-corner-small);
                ${getVarianceStatusStyle(stockTaking.variance_cost)}
              "
            >${getVarianceStatusText(stockTaking.variance_cost)}</span>
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
            ${t('stock', 'paginationInfo', startItem, endItem, state.totalCount)}
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
              ${t('stock', 'pageInfo', state.currentPage, totalPages)}
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

    function renderStockTakingsTable() {
      if (state.stockTakings.length === 0) return renderEmptyState();

      return html`
        <div>
          <table aria-label="Stock takings list" style="--md-sys-density: -3;">
            <thead>
              <tr>
                <th scope="col" style="width: 60px;">${t('stock', 'tableHeaderId')}</th>
                <th scope="col" style="width: 120px;">${t('stock', 'tableHeaderDate')}</th>
                <th scope="col">${t('stock', 'tableHeaderInventory')}</th>
                <th scope="col" class="numeric" style="width: 100px;">${t('stock', 'tableHeaderExpected')}</th>
                <th scope="col" class="numeric" style="width: 100px;">${t('stock', 'tableHeaderActual')}</th>
                <th scope="col" class="numeric" style="width: 100px;">${t('stock', 'tableHeaderQtyVar')}</th>
                <th scope="col" class="numeric" style="width: 120px;">${t('stock', 'tableHeaderCostVar')}</th>
                <th scope="col" class="center" style="width: 100px;">${t('stock', 'tableHeaderStatus')}</th>
              </tr>
            </thead>
            <tbody>
              ${state.stockTakings.map(renderStockTakingRow)}
            </tbody>
          </table>
          ${renderPaginationControls()}
        </div>
      `;
    }

    useEffect(host, function renderStockTakingsView() {
      render(html`
        <div class="scrollable" style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 12px 24px; height: 100%; overflow-y: scroll;">
          <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; justify-content: space-between;">
            ${renderFilterControls()}
            <div>
              <button role="button" class="text" @click=${loadStockTakings} aria-label="${t('stock', 'refreshAriaLabel')}">
                <material-symbols name="refresh"></material-symbols>
                ${t('stock', 'refreshButtonLabel')}
              </button>
              <a is="router-link" role="button" class="tonal" href="/stock/stock-taking-creation">
                <material-symbols name="add"></material-symbols>
                ${t('stock', 'newStockTakingButtonLabel')}
              </a>
            </div>
          </div>

          ${state.isLoading ? renderLoadingIndicator() : nothing}
          ${state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
          ${state.isLoading === false && state.error === null ? renderStockTakingsTable() : nothing}
        </div>
      `);
    });
  }
}

defineWebComponent('stock-takings-view', StockTakingsViewElement);
