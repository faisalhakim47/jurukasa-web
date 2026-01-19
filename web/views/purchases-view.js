import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { PurchaseDetailsDialogElement } from '#web/components/purchase-details-dialog.js';
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
import '#web/components/purchase-details-dialog.js';

/**
 * @typedef {object} PurchaseRow
 * @property {number} id
 * @property {number} supplier_id
 * @property {string} supplier_name
 * @property {number} purchase_time
 * @property {number | null} post_time
 * @property {number} total_amount
 * @property {number} line_count
 */

const statusFilterOptions = /** @type {const} */ (['All', 'Posted', 'Draft']);

/** @typedef {typeof statusFilterOptions[number]} StatusFilter */

export class PurchasesViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const router = useContext(host, RouterContextElement);
    const t = useTranslator(host);

    const purchaseDetailsDialog = useElement(host, PurchaseDetailsDialogElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const pageSize = 20;

    const state = reactive({
      purchases: /** @type {PurchaseRow[]} */ ([]),
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      searchQuery: '',
      statusFilter: /** @type {StatusFilter} */ ('All'),
      currentPage: 1,
      totalCount: 0,
      selectedPurchaseId: /** @type {number | null} */ (null),
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false;
    });

    function getTotalPages() {
      return Math.max(1, Math.ceil(state.totalCount / pageSize));
    }

    async function loadPurchases() {
      try {
        state.isLoading = true;
        state.error = null;

        const searchQueryValue = state.searchQuery.trim() || null;
        const searchPattern = searchQueryValue ? `%${searchQueryValue}%` : null;
        const statusFilterValue = state.statusFilter;
        const offset = (state.currentPage - 1) * pageSize;

        const countResult = await database.sql`
          SELECT COUNT(*) as count
          FROM purchases p
          JOIN suppliers s ON s.id = p.supplier_id
          WHERE (${searchPattern} IS NULL OR s.name LIKE ${searchPattern})
            AND (${statusFilterValue} = 'All'
              OR (${statusFilterValue} = 'Posted' AND p.post_time IS NOT NULL)
              OR (${statusFilterValue} = 'Draft' AND p.post_time IS NULL))
        `;
        state.totalCount = Number(countResult.rows[0].count);

        const result = await database.sql`
          SELECT
            p.id,
            p.supplier_id,
            s.name as supplier_name,
            p.purchase_time,
            p.post_time,
            COALESCE(SUM(pl.price), 0) as total_amount,
            COUNT(pl.line_number) as line_count
          FROM purchases p
          JOIN suppliers s ON s.id = p.supplier_id
          LEFT JOIN purchase_lines pl ON pl.purchase_id = p.id
          WHERE (${searchPattern} IS NULL OR s.name LIKE ${searchPattern})
            AND (${statusFilterValue} = 'All'
              OR (${statusFilterValue} = 'Posted' AND p.post_time IS NOT NULL)
              OR (${statusFilterValue} = 'Draft' AND p.post_time IS NULL))
          GROUP BY p.id
          ORDER BY p.purchase_time DESC, p.id DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `;

        state.purchases = result.rows.map(function rowToPurchase(row) {
          return /** @type {PurchaseRow} */ ({
            id: Number(row.id),
            supplier_id: Number(row.supplier_id),
            supplier_name: String(row.supplier_name),
            purchase_time: Number(row.purchase_time),
            post_time: row.post_time ? Number(row.post_time) : null,
            total_amount: Number(row.total_amount),
            line_count: Number(row.line_count),
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
      loadPurchases();
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
      loadPurchases();
    }

    /** @param {Event} event */
    function handleStatusFilterChange(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      state.statusFilter = /** @type {StatusFilter} */ (event.currentTarget.dataset.statusFilter);
      state.currentPage = 1;
      loadPurchases();
    }

    useEffect(host, loadPurchases);

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label=${t('purchase', 'loadingPurchasesAriaLabel')}
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
          <p>${t('purchase', 'loadingPurchasesMessage')}</p>
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
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('purchase', 'unableToLoadPurchasesTitle')}</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadPurchases}>
            <material-symbols name="refresh"></material-symbols>
            ${t('purchase', 'retryButtonLabel')}
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
              <label for="purchase-search-input">${t('purchase', 'searchLabel')}</label>
              <input
                ${readValue(state, 'searchQuery')}
                id="purchase-search-input"
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
              <label for="status-filter-input">${t('purchase', 'statusFilterLabel')}</label>
              <input
                id="status-filter-input"
                type="button"
                value="${state.statusFilter === 'All' ? t('purchase', 'filterAll') : state.statusFilter === 'Posted' ? t('purchase', 'filterPosted') : t('purchase', 'filterDraft')}"
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
              const optionLabel = option === 'All' ? t('purchase', 'filterAll')
                : option === 'Posted' ? t('purchase', 'filterPosted')
                : t('purchase', 'filterDraft');
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
                    ${optionLabel}
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
          <material-symbols name="shopping_cart" size="64"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('purchase', 'noPurchasesFoundTitle')}</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            ${state.searchQuery || state.statusFilter !== 'All'
              ? t('purchase', 'adjustSearchOrFiltersMessage')
              : t('purchase', 'startRecordingFirstPurchaseMessage')}
          </p>
          ${!state.searchQuery && state.statusFilter === 'All' ? html`
            <router-link
              role="button"
              class="tonal"
              href="/procurement/purchase-creation"
            >
              <material-symbols name="add"></material-symbols>
              ${t('purchase', 'newPurchaseButtonLabel')}
            </router-link>
          ` : nothing}
        </div>
      `;
    }

    /**
     * @param {PurchaseRow} purchase
     */
    function renderPurchaseRow(purchase) {
      const isPosted = purchase.post_time !== null;
      const statusText = isPosted ? t('purchase', 'statusPosted') : t('purchase', 'statusDraft');
      return html`
        <tr>
          <td class="label-large" style="color: var(--md-sys-color-primary);">
            <button
              role="button"
              type="button"
              class="text extra-small"
              style="--md-sys-density: -4;"
              commandfor="purchase-details-dialog"
              command="--open"
              data-purchase-id="${purchase.id}"
            >#${purchase.id}</button>
          </td>
          <td style="white-space: nowrap;">${i18n.date.format(purchase.purchase_time)}</td>
          <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;">
            ${purchase.supplier_name}
          </td>
          <td class="numeric">
            <span
              class="label-small"
              style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 24px;
                height: 24px;
                padding: 0 8px;
                border-radius: var(--md-sys-shape-corner-full);
                background-color: ${purchase.line_count > 0 ? 'var(--md-sys-color-secondary-container)' : 'var(--md-sys-color-surface-container-high)'};
                color: ${purchase.line_count > 0 ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface-variant)'};
              "
            >${purchase.line_count}</span>
          </td>
          <td class="numeric">${i18n.displayCurrency(purchase.total_amount)}</td>
          <td class="center">
            <span
              class="label-small"
              style="
                display: inline-flex;
                padding: 4px 8px;
                border-radius: var(--md-sys-shape-corner-small);
                ${isPosted ? 'background-color: #E8F5E9;' : nothing}
                ${isPosted ? 'color: #1B5E20;' : nothing}
                ${!isPosted ? 'background-color: #FFF3E0;' : nothing}
                ${!isPosted ? 'color: #E65100;' : nothing}
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
          aria-label=${t('purchase', 'paginationAriaLabel')}
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            border-top: 1px solid var(--md-sys-color-outline-variant);
          "
        >
          <span class="body-small" style="color: var(--md-sys-color-on-surface-variant);">
            ${t('purchase', 'showingItemsInfo', startItem, endItem, state.totalCount)}
          </span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button
              role="button"
              class="text"
              data-page="1"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === 1}
              aria-label=${t('purchase', 'firstPageAriaLabel')}
            >
              <material-symbols name="first_page"></material-symbols>
            </button>
            <button
              role="button"
              class="text"
              data-page="${state.currentPage - 1}"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === 1}
              aria-label=${t('purchase', 'previousPageAriaLabel')}
            >
              <material-symbols name="chevron_left"></material-symbols>
            </button>
            <span class="body-medium" style="min-width: 80px; text-align: center;">
              ${t('purchase', 'pageInfo', state.currentPage, totalPages)}
            </span>
            <button
              role="button"
              class="text"
              data-page="${state.currentPage + 1}"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === totalPages}
              aria-label=${t('purchase', 'nextPageAriaLabel')}
            >
              <material-symbols name="chevron_right"></material-symbols>
            </button>
            <button
              role="button"
              class="text"
              data-page="${totalPages}"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === totalPages}
              aria-label=${t('purchase', 'lastPageAriaLabel')}
            >
              <material-symbols name="last_page"></material-symbols>
            </button>
          </div>
        </nav>
      `;
    }

    function renderPurchasesTable() {
      if (state.purchases.length === 0) return renderEmptyState();

      return html`
        <div>
          <table aria-label=${t('purchase', 'purchasesListAriaLabel')} style="--md-sys-density: -3;">
            <thead>
              <tr>
                <th scope="col" style="width: 60px;">${t('purchase', 'tableHeaderId')}</th>
                <th scope="col" style="width: 120px;">${t('purchase', 'tableHeaderDate')}</th>
                <th scope="col">${t('purchase', 'tableHeaderSupplier')}</th>
                <th scope="col" class="numeric" style="width: 80px;">${t('purchase', 'tableHeaderItems')}</th>
                <th scope="col" class="numeric" style="width: 140px;">${t('purchase', 'tableHeaderTotal')}</th>
                <th scope="col" class="center" style="width: 100px;">${t('purchase', 'tableHeaderStatus')}</th>
              </tr>
            </thead>
            <tbody>
              ${state.purchases.map(renderPurchaseRow)}
            </tbody>
          </table>
          ${renderPaginationControls()}
        </div>
      `;
    }

    useEffect(host, function renderPurchasesView() {
      render(html`
        <div class="scrollable" style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 12px 24px; height: 100%; overflow-y: scroll;">
          <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; justify-content: space-between;">
            ${renderFilterControls()}
            <div>
              <button role="button" class="text" @click=${loadPurchases} aria-label=${t('purchase', 'refreshAriaLabel')}>
                <material-symbols name="refresh"></material-symbols>
                ${t('purchase', 'refreshButtonLabel')}
              </button>
              <router-link
                role="button"
                class="text"
                href="/procurement/purchase-creation"
              >
                <material-symbols name="add"></material-symbols>
                ${t('purchase', 'newPurchaseButtonLabel')}
              </router-link>
            </div>
          </div>

          ${state.isLoading ? renderLoadingIndicator() : nothing}
          ${state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
          ${state.isLoading === false && state.error === null ? renderPurchasesTable() : nothing}
        </div>

        <purchase-details-dialog
          ${purchaseDetailsDialog}
          id="purchase-details-dialog"
          purchase-id=${state.selectedPurchaseId}
          @purchase-posted=${loadPurchases}
          @purchase-discarded=${loadPurchases}
        ></purchase-details-dialog>
      `);
    });
  }
}

defineWebComponent('purchases-view', PurchasesViewElement);
