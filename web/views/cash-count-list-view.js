import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';

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
import '#web/components/account-reconciliation-details-dialog.js';

const discrepancyFilterOptions = /** @type {const} */ (['All', 'Balanced', 'Overage', 'Shortage']);

/** @typedef {typeof discrepancyFilterOptions[number]} DiscrepancyFilter */
/** @typedef {'All' | number} AccountFilter */

/**
 * @typedef {object} CashCountRow
 * @property {number} id
 * @property {number} accountCode
 * @property {string} accountName
 * @property {number} checkpointTime
 * @property {number} bookBalance
 * @property {number} externalBalance
 * @property {number} discrepancy
 * @property {'balanced' | 'overage' | 'shortage'} discrepancyType
 * @property {number | null} adjustmentJournalEntryRef
 * @property {string | null} note
 */

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
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      rows: /** @type {CashCountRow[]} */ ([]),
      filteredRows: /** @type {CashCountRow[]} */ ([]),
      searchQuery: '',
      discrepancyFilter: /** @type {DiscrepancyFilter} */ ('All'),
      accountFilter: /** @type {AccountFilter} */ ('All'),
      hasCashAccounts: false,
      checkingAccounts: true,
    });

    useBusyStateUntil(host, function readyState() {
      return state.isLoading === false && state.checkingAccounts === false;
    });

    function getAccountOptions() {
      const options = [{ value: 'All', label: t('reconciliation', 'allAccountsLabel') }];
      const seen = new Set();
      for (const row of state.rows) {
        if (seen.has(row.accountCode)) continue;
        seen.add(row.accountCode);
        options.push({ value: String(row.accountCode), label: `${row.accountCode} - ${row.accountName}` });
      }
      return options;
    }

    function filterRows(rows) {
      let filteredRows = rows;

      if (state.accountFilter !== 'All') {
        filteredRows = filteredRows.filter(function filterByAccount(row) {
          return row.accountCode === state.accountFilter;
        });
      }

      if (state.discrepancyFilter === 'Balanced') {
        filteredRows = filteredRows.filter(function filterBalanced(row) {
          return row.discrepancyType === 'balanced';
        });
      }
      else if (state.discrepancyFilter === 'Overage') {
        filteredRows = filteredRows.filter(function filterOverage(row) {
          return row.discrepancyType === 'overage';
        });
      }
      else if (state.discrepancyFilter === 'Shortage') {
        filteredRows = filteredRows.filter(function filterShortage(row) {
          return row.discrepancyType === 'shortage';
        });
      }

      const query = state.searchQuery.trim().toLowerCase();
      if (query !== '') {
        filteredRows = filteredRows.filter(function filterByQuery(row) {
          return row.accountName.toLowerCase().includes(query)
            || String(row.accountCode).includes(query)
            || String(row.note ?? '').toLowerCase().includes(query)
            || String(row.adjustmentJournalEntryRef ?? '').includes(query);
        });
      }

      return filteredRows;
    }

    async function checkCashAccounts() {
      try {
        state.checkingAccounts = true;
        const result = await database.sql`
          SELECT COUNT(*) AS count
          FROM account_tags
          WHERE tag = 'Cash Flow - Cash Equivalents'
        `;
        state.hasCashAccounts = Number(result.rows[0]?.count ?? 0) > 0;
      }
      catch {
        state.hasCashAccounts = false;
      }
      finally {
        state.checkingAccounts = false;
      }
    }

    async function loadRows() {
      try {
        state.isLoading = true;
        state.error = null;

        const result = await database.sql`
          SELECT
            id,
            account_code,
            account_name,
            checkpoint_time,
            book_balance,
            external_balance,
            discrepancy,
            discrepancy_type,
            adjustment_journal_entry_ref,
            note
          FROM reconciliation_history
          WHERE type = 'PHYSICAL'
          ORDER BY checkpoint_time DESC, id DESC
        `;

        state.rows = result.rows.map(function mapRow(row) {
          return /** @type {CashCountRow} */ ({
            id: Number(row.id),
            accountCode: Number(row.account_code),
            accountName: String(row.account_name),
            checkpointTime: Number(row.checkpoint_time),
            bookBalance: Number(row.book_balance),
            externalBalance: Number(row.external_balance),
            discrepancy: Number(row.discrepancy),
            discrepancyType: /** @type {'balanced' | 'overage' | 'shortage'} */ (String(row.discrepancy_type)),
            adjustmentJournalEntryRef: row.adjustment_journal_entry_ref === null ? null : Number(row.adjustment_journal_entry_ref),
            note: row.note === null ? null : String(row.note),
          });
        });

        state.filteredRows = filterRows(state.rows);
      }
      catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
      }
      finally {
        state.isLoading = false;
      }
    }

    /** @param {Event} event */
    function handleSearchInput(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      state.searchQuery = event.currentTarget.value;
      state.filteredRows = filterRows(state.rows);
    }

    /** @param {Event} event */
    function handleDiscrepancyFilterChange(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      state.discrepancyFilter = /** @type {DiscrepancyFilter} */ (event.currentTarget.dataset.discrepancy);
      state.filteredRows = filterRows(state.rows);
    }

    /** @param {Event} event */
    function handleAccountFilterChange(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      const accountCode = event.currentTarget.dataset.accountCode;
      state.accountFilter = accountCode === 'All' ? 'All' : Number(accountCode);
      state.filteredRows = filterRows(state.rows);
    }

    /** @param {CustomEvent} event */
    function handleViewJournalEntry(event) {
      host.dispatchEvent(new CustomEvent('view-journal-entry', {
        detail: event.detail,
        bubbles: true,
        composed: true,
      }));
    }

    function renderLoadingState() {
      return html`
        <div role="status" style="display: grid; gap: 16px; justify-items: center; padding: 48px 24px;">
          <div role="progressbar" class="linear indeterminate" style="width: 240px;">
            <div class="track"><div class="indicator"></div></div>
          </div>
          <p>${t('reconciliation', 'loadingCashCountsMessage')}</p>
        </div>
      `;
    }

    function renderErrorState() {
      return html`
        <div role="alert" style="display: grid; gap: 16px; justify-items: center; padding: 48px 24px; text-align: center;">
          <material-symbols name="error"></material-symbols>
          <h2 style="margin: 0;">${t('reconciliation', 'unableToLoadCashCountsTitle')}</h2>
          <p style="margin: 0;">${state.error?.message}</p>
          <button type="button" class="tonal" @click=${loadRows}>${t('reconciliation', 'retryButtonLabel')}</button>
        </div>
      `;
    }

    function renderMissingAccountsWarning() {
      return html`
        <div role="alert" style="display: grid; gap: 16px; justify-items: center; padding: 48px 24px; text-align: center; background: var(--md-sys-color-surface-container-low); border-radius: var(--md-sys-shape-corner-extra-large);">
          <material-symbols name="warning"></material-symbols>
          <h2 style="margin: 0;">${t('reconciliation', 'missingCashAccountsTitle')}</h2>
          <p style="margin: 0; max-width: 560px;">${t('reconciliation', 'missingCashAccountsMessage')}</p>
        </div>
      `;
    }

    function renderEmptyState() {
      return html`
        <div style="display: grid; gap: 16px; justify-items: center; padding: 48px 24px; text-align: center;">
          <material-symbols name="payments"></material-symbols>
          <h2 style="margin: 0;">${t('reconciliation', 'noCashCountsFoundTitle')}</h2>
          <p style="margin: 0; max-width: 560px; color: var(--md-sys-color-on-surface-variant);">${state.searchQuery !== '' || state.discrepancyFilter !== 'All' || state.accountFilter !== 'All' ? t('reconciliation', 'noCashCountsFoundMessage') : t('reconciliation', 'noCashCountsFoundEmptyMessage')}</p>
          ${state.searchQuery !== '' || state.discrepancyFilter !== 'All' || state.accountFilter !== 'All' ? nothing : html`
            <button type="button" class="filled" commandfor="cash-count-creation-dialog" command="--open">${t('reconciliation', 'createCashCountButtonLabel')}</button>
          `}
        </div>
      `;
    }

    function renderFilters() {
      const accountOptions = getAccountOptions();
      const selectedAccountLabel = state.accountFilter === 'All'
        ? t('reconciliation', 'allAccountsLabel')
        : accountOptions.find(function findOption(option) {
            return Number(option.value) === state.accountFilter;
          })?.label ?? String(state.accountFilter);

      return html`
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <div class="outlined-text-field" style="--md-sys-density: -4; width: 280px; min-width: 180px;">
            <div class="container">
              <material-symbols name="search" class="leading-icon"></material-symbols>
              <label for="cash-count-search">${t('reconciliation', 'searchLabel')}</label>
              <input ${readValue(state, 'searchQuery')} id="cash-count-search" type="text" placeholder=" " @input=${handleSearchInput} />
            </div>
          </div>
          <div class="outlined-text-field" style="--md-sys-density: -4; min-width: 200px; anchor-name: --cash-account-filter-anchor;">
            <div class="container">
              <label for="cash-account-filter-input">${t('reconciliation', 'accountFilterLabel')}</label>
              <input id="cash-account-filter-input" type="button" value="${selectedAccountLabel}" placeholder=" " popovertarget="cash-account-filter-menu" popovertargetaction="show" />
              <label for="cash-account-filter-input" class="trailing-icon"><material-symbols name="arrow_drop_down"></material-symbols></label>
            </div>
          </div>
          <menu role="menu" popover id="cash-account-filter-menu" class="dropdown" style="position-anchor: --cash-account-filter-anchor;">
            ${repeat(accountOptions, (option) => option.value, function renderAccountOption(option) {
              return html`
                <li>
                  <button type="button" role="menuitem" data-account-code="${option.value}" @click=${handleAccountFilterChange} popovertarget="cash-account-filter-menu" popovertargetaction="hide">${option.label}</button>
                </li>
              `;
            })}
          </menu>
          <div class="outlined-text-field" style="--md-sys-density: -4; min-width: 180px; anchor-name: --cash-discrepancy-filter-anchor;">
            <div class="container">
              <label for="cash-discrepancy-input">${t('reconciliation', 'discrepancyFilterLabel')}</label>
              <input id="cash-discrepancy-input" type="button" value="${t('reconciliation', state.discrepancyFilter === 'All' ? 'allDiscrepanciesLabel' : state.discrepancyFilter === 'Balanced' ? 'balancedLabel' : state.discrepancyFilter === 'Overage' ? 'overageLabel' : 'shortageLabel')}" placeholder=" " popovertarget="cash-discrepancy-menu" popovertargetaction="show" />
              <label for="cash-discrepancy-input" class="trailing-icon"><material-symbols name="arrow_drop_down"></material-symbols></label>
            </div>
          </div>
          <menu role="menu" popover id="cash-discrepancy-menu" class="dropdown" style="position-anchor: --cash-discrepancy-filter-anchor;">
            ${repeat(discrepancyFilterOptions, (filter) => filter, function renderFilter(filter) {
              return html`
                <li>
                  <button type="button" role="menuitem" data-discrepancy="${filter}" @click=${handleDiscrepancyFilterChange} popovertarget="cash-discrepancy-menu" popovertargetaction="hide">${t('reconciliation', filter === 'All' ? 'allDiscrepanciesLabel' : filter === 'Balanced' ? 'balancedLabel' : filter === 'Overage' ? 'overageLabel' : 'shortageLabel')}</button>
                </li>
              `;
            })}
          </menu>
        </div>
      `;
    }

    function renderDiscrepancyChip(row) {
      const tone = row.discrepancyType === 'balanced'
        ? 'background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container);'
        : row.discrepancyType === 'overage'
          ? 'background: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container);'
          : 'background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container);';
      const label = row.discrepancyType === 'balanced'
        ? t('reconciliation', 'balancedLabel')
        : row.discrepancyType === 'overage'
          ? t('reconciliation', 'overageLabel')
          : t('reconciliation', 'shortageLabel');
      return html`<span class="label-small" style="display: inline-flex; padding: 4px 12px; border-radius: var(--md-sys-shape-corner-full); ${tone}">${label}</span>`;
    }

    function renderRow(row) {
      return html`
        <tr>
          <td>${i18n.date.format(new Date(row.checkpointTime))}</td>
          <td>
            <div style="display: grid; gap: 2px;">
              <span class="label-large" style="color: var(--md-sys-color-primary);">${row.accountCode}</span>
              <span>${row.accountName}</span>
            </div>
          </td>
          <td class="right">${i18n.displayCurrency(row.bookBalance)}</td>
          <td class="right">${i18n.displayCurrency(row.externalBalance)}</td>
          <td class="right">${i18n.displayCurrency(row.discrepancy)}</td>
          <td>${renderDiscrepancyChip(row)}</td>
          <td>${row.adjustmentJournalEntryRef ?? '—'}</td>
          <td>${row.note ?? '—'}</td>
          <td class="center">
            <button type="button" class="text extra-small" commandfor="account-reconciliation-details-dialog" command="--open" data-reconciliation-id="${row.id}" aria-label="${t('reconciliation', 'viewCashCountDetailsAriaLabel', row.id)}">
              <material-symbols name="visibility" size="20"></material-symbols>
            </button>
          </td>
        </tr>
      `;
    }

    function renderTable() {
      if (state.filteredRows.length === 0) return renderEmptyState();

      return html`
        <table role="table" aria-label="${t('reconciliation', 'cashCountTableAriaLabel')}">
          <thead>
            <tr>
              <th scope="col">${t('reconciliation', 'tableHeaderCountTime')}</th>
              <th scope="col">${t('reconciliation', 'tableHeaderAccount')}</th>
              <th scope="col" class="right">${t('reconciliation', 'tableHeaderSystemBalance')}</th>
              <th scope="col" class="right">${t('reconciliation', 'tableHeaderCountedAmount')}</th>
              <th scope="col" class="right">${t('reconciliation', 'tableHeaderDiscrepancy')}</th>
              <th scope="col">${t('reconciliation', 'tableHeaderDiscrepancyType')}</th>
              <th scope="col">${t('reconciliation', 'tableHeaderAdjustmentEntry')}</th>
              <th scope="col">${t('reconciliation', 'tableHeaderNote')}</th>
              <th scope="col" class="center">${t('reconciliation', 'tableHeaderActions')}</th>
            </tr>
          </thead>
          <tbody>
            ${repeat(state.filteredRows, (row) => row.id, renderRow)}
          </tbody>
        </table>
      `;
    }

    useEffect(host, checkCashAccounts);
    useEffect(host, loadRows);

    useEffect(host, function renderView() {
      render(html`
        <div class="scrollable" style="display: flex; flex-direction: column; gap: 16px; height: 100%; padding: 12px 24px; box-sizing: border-box;">
          ${state.checkingAccounts === false && state.hasCashAccounts === false ? renderMissingAccountsWarning() : html`
            <div style="display: flex; gap: 12px; justify-content: space-between; align-items: center; flex-wrap: wrap;">
              ${renderFilters()}
              <div style="display: flex; gap: 12px; align-items: center;">
                <button type="button" class="text" @click=${loadRows}>${t('reconciliation', 'refreshButtonLabel')}</button>
                <button type="button" class="filled" commandfor="cash-count-creation-dialog" command="--open">${t('reconciliation', 'createCashCountButtonLabel')}</button>
              </div>
            </div>
            ${state.isLoading ? renderLoadingState() : nothing}
            ${state.isLoading === false && state.error instanceof Error ? renderErrorState() : nothing}
            ${state.isLoading === false && state.error === null ? renderTable() : nothing}
          `}
        </div>

        <cash-count-creation-dialog id="cash-count-creation-dialog" @cash-count-created=${function handleCreated() { void loadRows(); }}></cash-count-creation-dialog>
        <account-reconciliation-details-dialog id="account-reconciliation-details-dialog" @view-journal-entry=${handleViewJournalEntry}></account-reconciliation-details-dialog>
      `);
    });
  }
}

defineWebComponent('cash-count-list-view', CashCountListViewElement);
