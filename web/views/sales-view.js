import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { SaleDetailsDialogElement } from '#web/components/sale-details-dialog.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
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
import '#web/components/router-link.js';
import '#web/components/sale-details-dialog.js';

/**
 * @typedef {object} SaleRow
 * @property {number} id
 * @property {string | null} customer_name
 * @property {number} sale_time
 * @property {number | null} post_time
 * @property {number} gross_amount
 * @property {number} discount_amount
 * @property {number} invoice_amount
 * @property {number} line_count
 * @property {string} items_summary
 */

const statusFilterOptions = /** @type {const} */ (['All', 'Posted', 'Draft']);

/** @typedef {typeof statusFilterOptions[number]} StatusFilter */

export class SalesViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const router = useContext(host, RouterContextElement);
    const t = useTranslator(host);

    const saleDetailsDialog = useElement(host, SaleDetailsDialogElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const pageSize = 10;

    const state = reactive({
      sales: /** @type {SaleRow[]} */ ([]),
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      searchQuery: '',
      statusFilter: /** @type {StatusFilter} */ ('All'),
      currentPage: 1,
      totalCount: 0,
      selectedSaleId: /** @type {number | null} */ (null),
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false;
    });

    function getTotalPages() {
      return Math.max(1, Math.ceil(state.totalCount / pageSize));
    }

    async function loadSales() {
      try {
        state.isLoading = true;
        state.error = null;

        const searchQueryValue = state.searchQuery.trim() || null;
        const searchPattern = searchQueryValue ? `%${searchQueryValue}%` : null;
        const statusFilterValue = state.statusFilter;
        const offset = (state.currentPage - 1) * pageSize;

        const countResult = await database.sql`
          SELECT COUNT(*) as count
          FROM sales s
          WHERE (${searchPattern} IS NULL OR s.customer_name LIKE ${searchPattern})
            AND (${statusFilterValue} = 'All'
              OR (${statusFilterValue} = 'Posted' AND s.post_time IS NOT NULL)
              OR (${statusFilterValue} = 'Draft' AND s.post_time IS NULL))
        `;
        state.totalCount = Number(countResult.rows[0].count);

        const result = await database.sql`
          SELECT
            s.id,
            s.customer_name,
            s.sale_time,
            s.post_time,
            COALESCE(s.gross_amount, (SELECT COALESCE(SUM(price), 0) FROM sale_lines WHERE sale_id = s.id)) as gross_amount,
            COALESCE(s.discount_amount, (SELECT COALESCE(SUM(amount), 0) FROM sale_discounts WHERE sale_id = s.id)) as discount_amount,
            COALESCE(s.invoice_amount, COALESCE(s.gross_amount, (SELECT COALESCE(SUM(price), 0) FROM sale_lines WHERE sale_id = s.id)) - COALESCE(s.discount_amount, (SELECT COALESCE(SUM(amount), 0) FROM sale_discounts WHERE sale_id = s.id))) as invoice_amount,
            (SELECT COUNT(*) FROM sale_lines WHERE sale_id = s.id) as line_count,
            (SELECT GROUP_CONCAT(i.name, ', ')
             FROM sale_lines sl
             JOIN inventories i ON i.id = sl.inventory_id
             WHERE sl.sale_id = s.id
             ORDER BY sl.line_number
             LIMIT 3) as items_summary
          FROM sales s
          WHERE (${searchPattern} IS NULL OR s.customer_name LIKE ${searchPattern})
            AND (${statusFilterValue} = 'All'
              OR (${statusFilterValue} = 'Posted' AND s.post_time IS NOT NULL)
              OR (${statusFilterValue} = 'Draft' AND s.post_time IS NULL))
          ORDER BY s.sale_time DESC, s.id DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `;

        state.sales = result.rows.map(function rowToSale(row) {
          return /** @type {SaleRow} */ ({
            id: Number(row.id),
            customer_name: row.customer_name ? String(row.customer_name) : null,
            sale_time: Number(row.sale_time),
            post_time: row.post_time ? Number(row.post_time) : null,
            gross_amount: Number(row.gross_amount),
            discount_amount: Number(row.discount_amount),
            invoice_amount: Number(row.invoice_amount),
            line_count: Number(row.line_count),
            items_summary: row.items_summary ? String(row.items_summary) : '',
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
      loadSales();
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
      loadSales();
    }

    /** @param {Event} event */
    function handleStatusFilterChange(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      state.statusFilter = /** @type {StatusFilter} */ (event.currentTarget.dataset.statusFilter);
      state.currentPage = 1;
      loadSales();
    }

    useEffect(host, loadSales);

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label="${t('sale', 'loadingSalesAriaLabel')}"
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
          <p>${t('sale', 'loadingSalesMessage')}</p>
        </div>
      `;
    }

    /** @param {Error} error */
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
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('sale', 'unableToLoadSalesTitle')}</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadSales}>
            <material-symbols name="refresh"></material-symbols>
            ${t('sale', 'retryButtonLabel')}
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
              <label for="sale-search-input">${t('sale', 'searchLabel')}</label>
              <input
                ${readValue(state, 'searchQuery')}
                id="sale-search-input"
                type="text"
                placeholder=" "
                autocomplete="off"
                @input=${handleSearchInput}
              />
            </div>
          </div>

          <!-- Status Filter -->
          <div class="outlined-text-field" style="--md-sys-density: -4; min-width: 160px; anchor-name: --status-filter-menu-anchor;">
            <div class="container">
              <label for="status-filter-input">${t('sale', 'statusFilterLabel')}</label>
              <input
                id="status-filter-input"
                type="button"
                value="${state.statusFilter}"
                popovertarget="status-filter-menu"
                popovertargetaction="show"
                placeholder=" "
              />
              <label for="status-filter-input" class="trailing-icon">
                <material-symbols name="arrow_drop_down"></material-symbols>
              </label>
            </div>
          </div>
          <menu role="menu" popover id="status-filter-menu" class="dropdown" style="position-anchor: --status-filter-menu-anchor;">
            ${repeat(statusFilterOptions, (option) => option, (option) => {
              const optionText = option === 'All' ? t('sale', 'filterAll') : option === 'Posted' ? t('sale', 'filterPosted') : t('sale', 'filterDraft');
              return html`
                <li>
                  <button
                    role="menuitem"
                    data-status-filter="${option}"
                    @click=${handleStatusFilterChange}
                    popovertarget="status-filter-menu"
                    popovertargetaction="hide"
                    aria-selected=${option === state.statusFilter ? 'true' : 'false'}
                  >
                    ${option === state.statusFilter ? html`<material-symbols name="check"></material-symbols>` : ''}
                    ${optionText}
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
          <material-symbols name="receipt_long" size="64"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('sale', 'noSalesFoundTitle')}</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            ${state.searchQuery || state.statusFilter !== 'All'
              ? t('sale', 'adjustSearchOrFiltersMessage')
              : t('sale', 'startCreatingFirstSaleMessage')}
          </p>
          ${!state.searchQuery && state.statusFilter === 'All' ? html`
            <a
              is="router-link"
              role="button"
              class="tonal"
              href="/sale/point-of-sales"
            >
              <material-symbols name="point_of_sale"></material-symbols>
              ${t('sale', 'goToPointOfSaleButtonLabel')}
            </a>
          ` : nothing}
        </div>
      `;
    }

    /**
     * @param {SaleRow} sale
     */
    function renderSaleRow(sale) {
      const isPosted = sale.post_time !== null;
      const statusText = isPosted ? t('sale', 'statusPosted') : t('sale', 'statusDraft');
      const itemsSummary = sale.items_summary || '—';
      const truncatedSummary = itemsSummary.length > 40 ? itemsSummary.substring(0, 40) + '...' : itemsSummary;

      return html`
        <tr>
          <td class="label-large" style="color: var(--md-sys-color-primary);">
            <button
              role="button"
              type="button"
              class="text extra-small"
              style="--md-sys-density: -4;"
              commandfor="sale-details-dialog"
              command="--open"
              data-sale-id="${sale.id}"
            >#${sale.id}</button>
          </td>
          <td style="white-space: nowrap;">${i18n.date.format(sale.sale_time)}</td>
          <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${itemsSummary}">
            ${truncatedSummary}
            ${sale.line_count > 3 ? html`<span style="color: var(--md-sys-color-on-surface-variant);"> ${t('sale', 'moreItemsIndicator', sale.line_count - 3)}</span>` : nothing}
          </td>
          <td class="numeric">${i18n.displayCurrency(sale.gross_amount)}</td>
          <td class="numeric" style="color: ${sale.discount_amount > 0 ? 'var(--md-sys-color-tertiary)' : 'inherit'};">
            ${sale.discount_amount > 0 ? `-${i18n.displayCurrency(sale.discount_amount)}` : '—'}
          </td>
          <td class="numeric" style="font-weight: 500;">${i18n.displayCurrency(sale.invoice_amount)}</td>
          <td class="center">
            <span
              class="label-small"
              style="
                display: inline-flex;
                padding: 4px 8px;
                border-radius: var(--md-sys-shape-corner-small);
                ${statusText === 'Posted' ? 'background-color: #E8F5E9;' : nothing}
                ${statusText === 'Posted' ? 'color: #1B5E20;' : nothing}
                ${statusText === 'Draft' ? 'background-color: #FFF3E0;' : nothing}
                ${statusText === 'Draft' ? 'color: #E65100;' : nothing}
              "
            >${statusText}</span>
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
          aria-label="${t('sale', 'paginationAriaLabel')}"
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            border-top: 1px solid var(--md-sys-color-outline-variant);
          "
        >
          <span class="body-small" style="color: var(--md-sys-color-on-surface-variant);">
            ${t('sale', 'showingItemsInfo', startItem, endItem, state.totalCount)}
          </span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button
              role="button"
              class="text"
              data-page="1"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === 1}
              aria-label="${t('sale', 'firstPageAriaLabel')}"
            >
              <material-symbols name="first_page"></material-symbols>
            </button>
            <button
              role="button"
              class="text"
              data-page="${state.currentPage - 1}"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === 1}
              aria-label="${t('sale', 'previousPageAriaLabel')}"
            >
              <material-symbols name="chevron_left"></material-symbols>
            </button>
            <span class="body-medium" style="min-width: 80px; text-align: center;">
              ${t('sale', 'pageInfo', state.currentPage, totalPages)}
            </span>
            <button
              role="button"
              class="text"
              data-page="${state.currentPage + 1}"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === totalPages}
              aria-label="${t('sale', 'nextPageAriaLabel')}"
            >
              <material-symbols name="chevron_right"></material-symbols>
            </button>
            <button
              role="button"
              class="text"
              data-page="${totalPages}"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === totalPages}
              aria-label="${t('sale', 'lastPageAriaLabel')}"
            >
              <material-symbols name="last_page"></material-symbols>
            </button>
          </div>
        </nav>
      `;
    }

    function renderSalesTable() {
      if (state.sales.length === 0) return renderEmptyState();

      return html`
        <div>
          <table aria-label="${t('sale', 'salesListAriaLabel')}" style="--md-sys-density: -3;">
            <thead>
              <tr>
                <th scope="col" style="width: 60px;">${t('sale', 'tableHeaderId')}</th>
                <th scope="col" style="width: 120px;">${t('sale', 'tableHeaderDate')}</th>
                <th scope="col">${t('sale', 'tableHeaderItemsSummary')}</th>
                <th scope="col" class="numeric" style="width: 120px;">${t('sale', 'tableHeaderSubtotal')}</th>
                <th scope="col" class="numeric" style="width: 100px;">${t('sale', 'tableHeaderDiscounts')}</th>
                <th scope="col" class="numeric" style="width: 120px;">${t('sale', 'tableHeaderTotal')}</th>
                <th scope="col" class="center" style="width: 100px;">${t('sale', 'tableHeaderStatus')}</th>
              </tr>
            </thead>
            <tbody>
              ${state.sales.map(renderSaleRow)}
            </tbody>
          </table>
          ${renderPaginationControls()}
        </div>
      `;
    }

    useEffect(host, function renderSalesView() {
      render(html`
        <div style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 12px 24px; height: 100%;">
          <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; justify-content: space-between;">
            ${renderFilterControls()}
            <div>
              <button role="button" class="text" @click=${loadSales} aria-label="${t('sale', 'refreshSalesAriaLabel')}">
                <material-symbols name="refresh"></material-symbols>
                ${t('sale', 'refreshButtonLabel')}
              </button>
              <a
                is="router-link"
                role="button"
                class="text"
                href="/sale/point-of-sales"
              >
                <material-symbols name="point_of_sale"></material-symbols>
                ${t('sale', 'pointOfSaleButtonLabel')}
              </a>
            </div>
          </div>

          ${state.isLoading ? renderLoadingIndicator() : nothing}
          ${state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
          ${state.isLoading === false && state.error === null ? renderSalesTable() : nothing}
        </div>

        <sale-details-dialog
          ${saleDetailsDialog}
          id="sale-details-dialog"
          sale-id=${state.selectedSaleId}
          @sale-posted=${loadSales}
          @sale-discarded=${loadSales}
        ></sale-details-dialog>
      `);
    });
  }
}

defineWebComponent('sales-view', SalesViewElement);
