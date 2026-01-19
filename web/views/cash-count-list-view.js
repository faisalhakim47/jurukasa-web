import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { readValue } from '#web/directives/read-value.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

import '#web/components/material-symbols.js';
import '#web/components/cash-count-creation-dialog.js';

/**
 * @typedef {object} CashCountRow
 * @property {number} count_time
 * @property {number} account_code
 * @property {string} account_name
 * @property {number} counted_amount
 * @property {number} system_balance
 * @property {number} discrepancy
 * @property {'overage'|'shortage'|'balanced'} discrepancy_type
 * @property {number | null} reconciliation_session_id
 * @property {number | null} reconciliation_complete_time
 * @property {number | null} adjustment_journal_entry_ref
 * @property {string | null} note
 */

const accountFilterOptions = /** @type {const} */ (['All']);
const discrepancyFilterOptions = /** @type {const} */ (['All', 'Balanced', 'Overage', 'Shortage']);

/** @typedef {typeof accountFilterOptions[number] | number} AccountFilter */
/** @typedef {typeof discrepancyFilterOptions[number]} DiscrepancyFilter */

export class CashCountListViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      cashCounts: /** @type {CashCountRow[]} */ ([]),
      filteredCashCounts: /** @type {CashCountRow[]} */ ([]),
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      accountFilter: /** @type {AccountFilter} */ ('All'),
      discrepancyFilter: /** @type {DiscrepancyFilter} */ ('All'),
      searchQuery: '',
      hasCashAccounts: false,
      checkingAccounts: true,
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false && state.checkingAccounts === false;
    });

    /**
     * Filter cash counts based on account, discrepancy type, and search query
     * @param {CashCountRow[]} cashCounts
     * @returns {CashCountRow[]}
     */
    function filterCashCounts(cashCounts) {
      let filtered = cashCounts;

      // Filter by account
      if (state.accountFilter !== 'All') {
        filtered = filtered.filter(function (cc) {
          return cc.account_code === state.accountFilter;
        });
      }

      // Filter by discrepancy type
      if (state.discrepancyFilter === 'Balanced') {
        filtered = filtered.filter(function (cc) {
          return cc.discrepancy_type === 'balanced';
        });
      }
      else if (state.discrepancyFilter === 'Overage') {
        filtered = filtered.filter(function (cc) {
          return cc.discrepancy_type === 'overage';
        });
      }
      else if (state.discrepancyFilter === 'Shortage') {
        filtered = filtered.filter(function (cc) {
          return cc.discrepancy_type === 'shortage';
        });
      }

      // Filter by search query
      if (state.searchQuery.trim()) {
        const query = state.searchQuery.toLowerCase();
        filtered = filtered.filter(function (cc) {
          const matchesAccount = cc.account_name.toLowerCase().includes(query)
            || String(cc.account_code).includes(query);
          const matchesNote = cc.note?.toLowerCase().includes(query);
          return matchesAccount || matchesNote;
        });
      }

      return filtered;
    }

    async function checkCashAccounts() {
      try {
        state.checkingAccounts = true;
        const result = await database.sql`
          SELECT COUNT(*) as count
          FROM account_tags
          WHERE tag = 'Cash Flow - Cash Equivalents'
        `;
        const count = Number(result.rows[0]?.count ?? 0);
        state.hasCashAccounts = count > 0;
      }
      catch (error) {
        console.error('Error checking cash accounts:', error);
        state.hasCashAccounts = false;
      }
      finally {
        state.checkingAccounts = false;
      }
    }

    async function loadCashCounts() {
      try {
        state.isLoading = true;
        state.error = null;

        const result = await database.sql`
          SELECT
            count_time,
            account_code,
            account_name,
            counted_amount,
            system_balance,
            discrepancy,
            discrepancy_type,
            reconciliation_session_id,
            reconciliation_complete_time,
            adjustment_journal_entry_ref,
            note
          FROM cash_count_history
          ORDER BY count_time DESC
        `;

        state.cashCounts = result.rows.map(function rowToCashCount(row) {
          return /** @type {CashCountRow} */ ({
            count_time: Number(row.count_time),
            account_code: Number(row.account_code),
            account_name: String(row.account_name),
            counted_amount: Number(row.counted_amount),
            system_balance: Number(row.system_balance),
            discrepancy: Number(row.discrepancy),
            discrepancy_type: String(row.discrepancy_type),
            reconciliation_session_id: row.reconciliation_session_id !== null ? Number(row.reconciliation_session_id) : null,
            reconciliation_complete_time: row.reconciliation_complete_time !== null ? Number(row.reconciliation_complete_time) : null,
            adjustment_journal_entry_ref: row.adjustment_journal_entry_ref !== null ? Number(row.adjustment_journal_entry_ref) : null,
            note: row.note !== null ? String(row.note) : null,
          });
        });

        state.filteredCashCounts = filterCashCounts(state.cashCounts);
        state.isLoading = false;
      }
      catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
        state.isLoading = false;
      }
    }

    useEffect(host, checkCashAccounts);

    useEffect(host, loadCashCounts);

    /** @param {Event} event */
    function handleAccountFilterChange(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      const value = event.currentTarget.dataset.account;
      state.accountFilter = value === 'All' ? 'All' : Number(value);
      state.filteredCashCounts = filterCashCounts(state.cashCounts);
    }

    /** @param {Event} event */
    function handleDiscrepancyFilterChange(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      state.discrepancyFilter = /** @type {DiscrepancyFilter} */ (event.currentTarget.dataset.discrepancy);
      state.filteredCashCounts = filterCashCounts(state.cashCounts);
    }

    /** @param {Event} event */
    function handleSearchInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.searchQuery = event.target.value;
      state.filteredCashCounts = filterCashCounts(state.cashCounts);
    }

    /** @param {Event} event */
    function handleCashCountCreated(event) {
      loadCashCounts();

    }

    /** @param {number} countTime */
    function handleViewCashCountClick(countTime) {
      return function (event) {
        // TODO: Open cash count details view/dialog or navigate to reconciliation
        alert(t('reconciliation', 'todoViewCashCountMessage'));
      };
    }

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label="${t('reconciliation', 'loadingCashCountsAriaLabel')}"
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
          <p>${t('reconciliation', 'loadingCashCountsMessage')}</p>
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
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('reconciliation', 'unableToLoadCashCountsTitle')}</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadCashCounts}>
            <material-symbols name="refresh"></material-symbols>
            ${t('reconciliation', 'retryButtonLabel')}
          </button>
        </div>
      `;
    }

    function renderMissingAccountsWarning() {
      return html`
        <div
          role="alert"
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            min-height: 300px;
            text-align: center;
            padding: 48px;
            background-color: var(--md-sys-color-surface-container-low);
            border-radius: 12px;
            margin: 24px;
          "
        >
          <material-symbols name="warning" size="64" style="color: var(--md-sys-color-tertiary);"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">
            ${t('reconciliation', 'missingCashAccountsTitle')}
          </h2>
          <p style="max-width: 500px; color: var(--md-sys-color-on-surface-variant);">
            ${t('reconciliation', 'missingCashAccountsMessage')}
          </p>
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
          <material-symbols name="payments" size="64"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('reconciliation', 'noCashCountsFoundTitle')}</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            ${state.searchQuery || state.accountFilter !== 'All' || state.discrepancyFilter !== 'All'
          ? t('reconciliation', 'noCashCountsFoundMessage')
          : t('reconciliation', 'noCashCountsFoundEmptyMessage')}
          </p>
          ${state.searchQuery || state.accountFilter !== 'All' || state.discrepancyFilter !== 'All' ? nothing : html`
            <button
              role="button"
              class="filled"
              commandfor="cash-count-creation-dialog"
              command="--open"
            >
              <material-symbols name="add"></material-symbols>
              ${t('reconciliation', 'createCashCountButtonLabel')}
            </button>
          `}
        </div>
      `;
    }

    function renderFilterControls() {
      const accountOptions = [
        { value: 'All', label: t('reconciliation', 'allAccountsLabel') },
      ];

      return html`
        <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; flex-wrap: wrap;">
          <!-- Search Field -->
          <div class="outlined-text-field" style="--md-sys-density: -4; width: 250px; min-width: 160px;">
            <div class="container">
              <material-symbols name="search" class="leading-icon" aria-hidden="true"></material-symbols>
              <label for="cash-count-search-input">${t('reconciliation', 'searchLabel')}</label>
              <input
                ${readValue(state, 'searchQuery')}
                id="cash-count-search-input"
                type="text"
                placeholder=" "
                autocomplete="off"
                @input=${handleSearchInput}
              />
            </div>
          </div>

          <!-- Account Filter -->
          <div class="outlined-text-field" style="--md-sys-density: -4; min-width: 180px; anchor-name: --account-menu-anchor;">
            <div class="container">
              <label for="account-filter-input">${t('reconciliation', 'accountFilterLabel')}</label>
              <input
                id="account-filter-input"
                type="button"
                value="${state.accountFilter === 'All' ? t('reconciliation', 'allAccountsLabel') : state.accountFilter}"
                popovertarget="account-filter-menu"
                popovertargetaction="show"
                placeholder=" "
              />
              <label for="account-filter-input" class="trailing-icon">
                <material-symbols name="arrow_drop_down"></material-symbols>
              </label>
            </div>
          </div>
          <menu role="menu" popover id="account-filter-menu" aria-label="${t('reconciliation', 'accountFilterAriaLabel')}" class="dropdown" style="position-anchor: --account-menu-anchor;">
            ${repeat(accountOptions, (opt) => opt.value, (opt) => html`
              <li>
                <button
                  role="menuitem"
                  data-account="${opt.value}"
                  @click=${handleAccountFilterChange}
                  popovertarget="account-filter-menu"
                  popovertargetaction="hide"
                  aria-selected=${(opt.value === 'All' && state.accountFilter === 'All') || (opt.value !== 'All' && Number(opt.value) === state.accountFilter) ? 'true' : 'false'}
                >
                  ${(opt.value === 'All' && state.accountFilter === 'All') || (opt.value !== 'All' && Number(opt.value) === state.accountFilter) ? html`<material-symbols name="check"></material-symbols>` : ''}
                  ${opt.label}
                </button>
              </li>
            `)}
          </menu>

          <!-- Discrepancy Filter -->
          <div class="outlined-text-field" style="--md-sys-density: -4; min-width: 140px; anchor-name: --discrepancy-menu-anchor;">
            <div class="container">
              <label for="discrepancy-filter-input">${t('reconciliation', 'discrepancyFilterLabel')}</label>
              <input
                id="discrepancy-filter-input"
                type="button"
                value="${state.discrepancyFilter}"
                popovertarget="discrepancy-filter-menu"
                popovertargetaction="show"
                placeholder=" "
              />
              <label for="discrepancy-filter-input" class="trailing-icon">
                <material-symbols name="arrow_drop_down"></material-symbols>
              </label>
            </div>
          </div>
          <menu role="menu" popover id="discrepancy-filter-menu" aria-label="${t('reconciliation', 'discrepancyFilterAriaLabel')}" class="dropdown" style="position-anchor: --discrepancy-menu-anchor;">
            ${repeat(discrepancyFilterOptions, (type) => type, (type) => html`
              <li>
                <button
                  role="menuitem"
                  data-discrepancy="${type}"
                  @click=${handleDiscrepancyFilterChange}
                  popovertarget="discrepancy-filter-menu"
                  popovertargetaction="hide"
                  aria-selected=${type === state.discrepancyFilter ? 'true' : 'false'}
                >
                  ${type === state.discrepancyFilter ? html`<material-symbols name="check"></material-symbols>` : ''}
                  ${t('reconciliation', type === 'All' ? 'allDiscrepanciesLabel' : type === 'Balanced' ? 'balancedLabel' : type === 'Overage' ? 'overageLabel' : 'shortageLabel')}
                </button>
              </li>
            `)}
          </menu>
        </div>
      `;
    }

    /**
     * @param {CashCountRow} cashCount
     */
    function renderCashCountRow(cashCount) {
      const discrepancyStyle = cashCount.discrepancy_type === 'overage'
        ? 'color: var(--md-sys-color-tertiary);'
        : cashCount.discrepancy_type === 'shortage'
          ? 'color: var(--md-sys-color-error);'
          : '';

      const discrepancyBadgeStyle = cashCount.discrepancy_type === 'overage'
        ? 'background-color: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container);'
        : cashCount.discrepancy_type === 'shortage'
          ? 'background-color: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container);'
          : 'background-color: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface-variant);';

      return html`
        <tr
          tabindex="0"
          aria-label="${t('reconciliation', 'cashCountRowAriaLabel', cashCount.account_name)}"
          style="cursor: pointer;"
          @click=${handleViewCashCountClick(cashCount.count_time)}
        >
          <td>
            <span class="body-small">${i18n.date.format(new Date(cashCount.count_time))}</span>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span class="label-large" style="color: var(--md-sys-color-primary);">${cashCount.account_code}</span>
              <span class="body-medium">${cashCount.account_name}</span>
            </div>
          </td>
          <td class="right">
            <span class="label-medium">${i18n.displayCurrency(cashCount.system_balance)}</span>
          </td>
          <td class="right">
            <span class="label-medium">${i18n.displayCurrency(cashCount.counted_amount)}</span>
          </td>
          <td class="right">
            <span class="label-medium" style="${discrepancyStyle}">
              ${i18n.displayCurrency(cashCount.discrepancy)}
            </span>
          </td>
          <td>
            <span
              class="label-small"
              style="
                display: inline-flex;
                padding: 4px 12px;
                border-radius: var(--md-sys-shape-corner-full);
                ${discrepancyBadgeStyle}
              "
            >${t('reconciliation', cashCount.discrepancy_type === 'balanced' ? 'balancedLabel' : cashCount.discrepancy_type === 'overage' ? 'overageLabel' : 'shortageLabel')}</span>
          </td>
          <td>
            <span class="body-small">${cashCount.note || '—'}</span>
          </td>
          <td class="center">
            <button
              role="button"
              class="text extra-small"
              title="${t('reconciliation', 'viewCashCountDetailsTitle')}"
              aria-label="${t('reconciliation', 'viewCashCountDetailsAriaLabel', cashCount.count_time)}"
              @click=${handleViewCashCountClick(cashCount.count_time)}
            >
              <material-symbols name="visibility" size="20"></material-symbols>
            </button>
          </td>
        </tr>
      `;
    }

    function renderCashCountsTable() {
      if (state.filteredCashCounts.length === 0) return renderEmptyState();

      return html`
        <div>
          <table role="table" aria-label="${t('reconciliation', 'cashCountTableAriaLabel')}" style="--md-sys-density: -4;">
            <thead>
              <tr>
                <th scope="col">${t('reconciliation', 'tableHeaderCountTime')}</th>
                <th scope="col">${t('reconciliation', 'tableHeaderAccount')}</th>
                <th scope="col" class="right">${t('reconciliation', 'tableHeaderSystemBalance')}</th>
                <th scope="col" class="right">${t('reconciliation', 'tableHeaderCountedAmount')}</th>
                <th scope="col" class="right">${t('reconciliation', 'tableHeaderDiscrepancy')}</th>
                <th scope="col">${t('reconciliation', 'tableHeaderDiscrepancyType')}</th>
                <th scope="col">${t('reconciliation', 'tableHeaderNote')}</th>
                <th scope="col" class="center" style="width: 80px;">${t('reconciliation', 'tableHeaderActions')}</th>
              </tr>
            </thead>
            <tbody>
              ${repeat(state.filteredCashCounts, (cc) => cc.count_time, renderCashCountRow)}
            </tbody>
          </table>
        </div>
      `;
    }

    useEffect(host, function renderCashCountListView() {
      render(html`
        <div class="scrollable" style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 12px 24px; height: 100%; overflow-y: scroll;">
          ${state.checkingAccounts === false && state.hasCashAccounts === false ? renderMissingAccountsWarning() : html`
            <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; justify-content: space-between;">
              ${renderFilterControls()}
              <div>
                <button role="button" class="text" @click=${loadCashCounts} aria-label="${t('reconciliation', 'refreshCashCountsAriaLabel')}">
                  <material-symbols name="refresh"></material-symbols>
                  ${t('reconciliation', 'refreshButtonLabel')}
                </button>
                <button
                  role="button"
                  class="filled"
                  commandfor="cash-count-creation-dialog"
                  command="--open"
                >
                  <material-symbols name="add"></material-symbols>
                  ${t('reconciliation', 'createCashCountButtonLabel')}
                </button>
              </div>
            </div>
            ${state.isLoading ? renderLoadingIndicator() : nothing}
            ${state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
            ${state.isLoading === false && state.error === null ? renderCashCountsTable() : nothing}
          `}
        </div>

        <cash-count-creation-dialog
          id="cash-count-creation-dialog"
          @cash-count-created=${handleCashCountCreated}
        ></cash-count-creation-dialog>
      `);
    });
  }
}

defineWebComponent('cash-count-list-view', CashCountListViewElement);
