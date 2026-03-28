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
import '#web/components/reconciliation-account-creation-dialog.js';
import '#web/components/account-reconciliation-creation-dialog.js';
import '#web/components/account-reconciliation-details-dialog.js';

const discrepancyFilterOptions = /** @type {const} */ (['All', 'Balanced', 'Overage', 'Shortage']);

/** @typedef {typeof discrepancyFilterOptions[number]} DiscrepancyFilter */

/**
 * @typedef {object} ReconciliationRow
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

export class AccountReconciliationListViewElement extends HTMLElement {
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
      rows: /** @type {ReconciliationRow[]} */ ([]),
      filteredRows: /** @type {ReconciliationRow[]} */ ([]),
      searchQuery: '',
      discrepancyFilter: /** @type {DiscrepancyFilter} */ ('All'),
      hasReconciliationAccounts: false,
      checkingAccounts: true,
    });

    useBusyStateUntil(host, function readyState() {
      return state.isLoading === false && state.checkingAccounts === false;
    });

    function filterRows(rows) {
      let filteredRows = rows;

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
            || String(row.adjustmentJournalEntryRef ?? '').includes(query)
            || String(row.note ?? '').toLowerCase().includes(query);
        });
      }

      return filteredRows;
    }

    async function checkReconciliationAccounts() {
      try {
        state.checkingAccounts = true;
        const result = await database.sql`
          SELECT COUNT(*) AS count
          FROM account_tags
          WHERE tag = 'Reconciliation - Adjustment'
        `;
        state.hasReconciliationAccounts = Number(result.rows[0]?.count ?? 0) > 0;
      }
      catch {
        state.hasReconciliationAccounts = false;
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
          WHERE type = 'STATEMENT'
          ORDER BY checkpoint_time DESC, id DESC
        `;

        state.rows = result.rows.map(function mapRow(row) {
          return /** @type {ReconciliationRow} */ ({
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
    function handleViewDetailsClick(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
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
          <p>${t('reconciliation', 'loadingReconciliationsMessage')}</p>
        </div>
      `;
    }

    function renderErrorState() {
      return html`
        <div role="alert" style="display: grid; gap: 16px; justify-items: center; padding: 48px 24px; text-align: center;">
          <material-symbols name="error"></material-symbols>
          <h2 style="margin: 0;">${t('reconciliation', 'unableToLoadReconciliationsTitle')}</h2>
          <p style="margin: 0;">${state.error?.message}</p>
          <button type="button" class="tonal" @click=${loadRows}>${t('reconciliation', 'retryButtonLabel')}</button>
        </div>
      `;
    }

    function renderMissingAccountsWarning() {
      return html`
        <div role="alert" style="display: grid; gap: 16px; justify-items: center; padding: 48px 24px; text-align: center; background: var(--md-sys-color-surface-container-low); border-radius: var(--md-sys-shape-corner-extra-large);">
          <material-symbols name="warning"></material-symbols>
          <h2 style="margin: 0;">${t('reconciliation', 'missingReconciliationAccountsTitle')}</h2>
          <p style="margin: 0; max-width: 560px;">${t('reconciliation', 'missingReconciliationAccountsMessage')}</p>
          <button type="button" class="filled" commandfor="reconciliation-account-creation-dialog" command="--open">${t('reconciliation', 'createReconciliationAccountButtonLabel')}</button>
        </div>
      `;
    }

    function renderEmptyState() {
      return html`
        <div style="display: grid; gap: 16px; justify-items: center; padding: 48px 24px; text-align: center;">
          <material-symbols name="rule"></material-symbols>
          <h2 style="margin: 0;">${t('reconciliation', 'noReconciliationsFoundTitle')}</h2>
          <p style="margin: 0; max-width: 560px; color: var(--md-sys-color-on-surface-variant);">${state.searchQuery !== '' || state.discrepancyFilter !== 'All' ? t('reconciliation', 'noReconciliationsFoundMessage') : t('reconciliation', 'noReconciliationsFoundEmptyMessage')}</p>
          ${state.searchQuery !== '' || state.discrepancyFilter !== 'All' ? nothing : html`
            <button type="button" class="filled" commandfor="account-reconciliation-creation-dialog" command="--open">${t('reconciliation', 'createReconciliationButtonLabel')}</button>
          `}
        </div>
      `;
    }

    function renderFilters() {
      return html`
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <div class="outlined-text-field" style="--md-sys-density: -4; width: 280px; min-width: 180px;">
            <div class="container">
              <material-symbols name="search" class="leading-icon"></material-symbols>
              <label for="reconciliation-search">${t('reconciliation', 'searchLabel')}</label>
              <input ${readValue(state, 'searchQuery')} id="reconciliation-search" type="text" placeholder=" " @input=${handleSearchInput} />
            </div>
          </div>
          <div class="outlined-text-field" style="--md-sys-density: -4; min-width: 180px; anchor-name: --statement-discrepancy-anchor;">
            <div class="container">
              <label for="statement-discrepancy-input">${t('reconciliation', 'discrepancyFilterLabel')}</label>
              <input id="statement-discrepancy-input" type="button" value="${t('reconciliation', state.discrepancyFilter === 'All' ? 'allDiscrepanciesLabel' : state.discrepancyFilter === 'Balanced' ? 'balancedLabel' : state.discrepancyFilter === 'Overage' ? 'overageLabel' : 'shortageLabel')}" placeholder=" " popovertarget="statement-discrepancy-menu" popovertargetaction="show" />
              <label for="statement-discrepancy-input" class="trailing-icon"><material-symbols name="arrow_drop_down"></material-symbols></label>
            </div>
          </div>
          <menu role="menu" popover id="statement-discrepancy-menu" class="dropdown" style="position-anchor: --statement-discrepancy-anchor;">
            ${repeat(discrepancyFilterOptions, (filter) => filter, function renderFilter(filter) {
              return html`
                <li>
                  <button type="button" role="menuitem" data-discrepancy="${filter}" @click=${handleDiscrepancyFilterChange} popovertarget="statement-discrepancy-menu" popovertargetaction="hide">
                    ${t('reconciliation', filter === 'All' ? 'allDiscrepanciesLabel' : filter === 'Balanced' ? 'balancedLabel' : filter === 'Overage' ? 'overageLabel' : 'shortageLabel')}
                  </button>
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
      return html`<span class="label-small" style="display: inline-flex; padding: 4px 12px; border-radius: var(--md-sys-shape-corner-full); ${tone}">${t('reconciliation', row.discrepancyType === 'balanced' ? 'balancedLabel' : row.discrepancyType === 'overage' ? 'overageLabel' : 'shortageLabel')}</span>`;
    }

    function renderRow(row) {
      return html`
        <tr>
          <td>
            <div style="display: grid; gap: 2px;">
              <span class="label-large" style="color: var(--md-sys-color-primary);">${row.accountCode}</span>
              <span>${row.accountName}</span>
            </div>
          </td>
          <td>${i18n.date.format(new Date(row.checkpointTime))}</td>
          <td class="right">${i18n.displayCurrency(row.bookBalance)}</td>
          <td class="right">${i18n.displayCurrency(row.externalBalance)}</td>
          <td class="right">${i18n.displayCurrency(row.discrepancy)}</td>
          <td>${renderDiscrepancyChip(row)}</td>
          <td>${row.adjustmentJournalEntryRef ?? '—'}</td>
          <td class="center">
            <button type="button" class="text extra-small" commandfor="account-reconciliation-details-dialog" command="--open" data-reconciliation-id="${row.id}" @click=${handleViewDetailsClick} aria-label="${t('reconciliation', 'viewReconciliationDetailsAriaLabel', row.id)}">
              <material-symbols name="visibility" size="20"></material-symbols>
            </button>
          </td>
        </tr>
      `;
    }

    function renderTable() {
      if (state.filteredRows.length === 0) return renderEmptyState();

      return html`
        <table role="table" aria-label="${t('reconciliation', 'reconciliationTableAriaLabel')}">
          <thead>
            <tr>
              <th scope="col">${t('reconciliation', 'tableHeaderAccount')}</th>
              <th scope="col">${t('reconciliation', 'tableHeaderCheckpointTime')}</th>
              <th scope="col" class="right">${t('reconciliation', 'tableHeaderBookBalance')}</th>
              <th scope="col" class="right">${t('reconciliation', 'tableHeaderExternalBalance')}</th>
              <th scope="col" class="right">${t('reconciliation', 'tableHeaderBalanceDifference')}</th>
              <th scope="col">${t('reconciliation', 'tableHeaderDiscrepancyType')}</th>
              <th scope="col">${t('reconciliation', 'tableHeaderAdjustmentEntry')}</th>
              <th scope="col" class="center">${t('reconciliation', 'tableHeaderActions')}</th>
            </tr>
          </thead>
          <tbody>
            ${repeat(state.filteredRows, (row) => row.id, renderRow)}
          </tbody>
        </table>
      `;
    }

    useEffect(host, checkReconciliationAccounts);
    useEffect(host, loadRows);

    useEffect(host, function renderView() {
      render(html`
        <div class="scrollable" style="display: flex; flex-direction: column; gap: 16px; height: 100%; padding: 12px 24px; box-sizing: border-box;">
          ${state.checkingAccounts === false && state.hasReconciliationAccounts === false ? renderMissingAccountsWarning() : html`
            <div style="display: flex; gap: 12px; justify-content: space-between; align-items: center; flex-wrap: wrap;">
              ${renderFilters()}
              <div style="display: flex; gap: 12px; align-items: center;">
                <button type="button" class="text" @click=${loadRows}>${t('reconciliation', 'refreshButtonLabel')}</button>
                <button type="button" class="filled" commandfor="account-reconciliation-creation-dialog" command="--open">${t('reconciliation', 'createReconciliationButtonLabel')}</button>
              </div>
            </div>
            ${state.isLoading ? renderLoadingState() : nothing}
            ${state.isLoading === false && state.error instanceof Error ? renderErrorState() : nothing}
            ${state.isLoading === false && state.error === null ? renderTable() : nothing}
          `}
        </div>

        <reconciliation-account-creation-dialog id="reconciliation-account-creation-dialog" @reconciliation-account-created=${function handleAccountCreated() { void checkReconciliationAccounts(); }}></reconciliation-account-creation-dialog>
        <account-reconciliation-creation-dialog id="account-reconciliation-creation-dialog" @account-reconciliation-created=${function handleCreated() { void loadRows(); }}></account-reconciliation-creation-dialog>
        <account-reconciliation-details-dialog id="account-reconciliation-details-dialog" @view-journal-entry=${handleViewJournalEntry}></account-reconciliation-details-dialog>
      `);
    });
  }
}

defineWebComponent('account-reconciliation-list-view', AccountReconciliationListViewElement);
