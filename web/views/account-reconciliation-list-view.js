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
import { useElement } from '#web/hooks/use-element.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

import '#web/components/material-symbols.js';
import '#web/components/reconciliation-account-creation-dialog.js';
import '#web/components/account-reconciliation-creation-dialog.js';
import '#web/components/account-reconciliation-details-dialog.js';
import { AccountReconciliationDetailsDialogElement } from '#web/components/account-reconciliation-details-dialog.js';

/**
 * @typedef {object} ReconciliationSessionRow
 * @property {number} id
 * @property {number} account_code
 * @property {string} account_name
 * @property {number} reconciliation_time
 * @property {number} statement_begin_time
 * @property {number} statement_end_time
 * @property {string | null} statement_reference
 * @property {number | null} complete_time
 * @property {number} balance_difference
 * @property {number} total_statement_items
 * @property {number} unmatched_items
 * @property {number} total_discrepancies
 */

const statusFilterOptions = /** @type {const} */ (['All', 'Draft', 'Completed']);

/** @typedef {typeof statusFilterOptions[number]} StatusFilter */

export class AccountReconciliationListViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);
    const render = useRender(host);
    const detailsDialog = useElement(host, AccountReconciliationDetailsDialogElement);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      reconciliations: /** @type {ReconciliationSessionRow[]} */ ([]),
      filteredReconciliations: /** @type {ReconciliationSessionRow[]} */ ([]),
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      statusFilter: /** @type {StatusFilter} */ ('All'),
      searchQuery: '',
      hasReconciliationAccounts: false,
      checkingAccounts: true,
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false && state.checkingAccounts === false;
    });

    /**
     * Filter reconciliations based on status and search query
     * @param {ReconciliationSessionRow[]} reconciliations
     * @returns {ReconciliationSessionRow[]}
     */
    function filterReconciliations(reconciliations) {
      let filtered = reconciliations;

      if (state.statusFilter === 'Draft') {
        filtered = filtered.filter(function (r) {
          return r.complete_time === null;
        });
      }
      else if (state.statusFilter === 'Completed') {
        filtered = filtered.filter(function (r) {
          return r.complete_time !== null;
        });
      }

      if (state.searchQuery.trim()) {
        const query = state.searchQuery.toLowerCase();
        filtered = filtered.filter(function (r) {
          const matchesAccount = r.account_name.toLowerCase().includes(query)
            || String(r.account_code).includes(query);
          const matchesReference = r.statement_reference?.toLowerCase().includes(query);
          return matchesAccount || matchesReference;
        });
      }

      return filtered;
    }

    async function checkReconciliationAccounts() {
      try {
        state.checkingAccounts = true;
        const result = await database.sql`
          SELECT COUNT(*) as count
          FROM account_tags
          WHERE tag IN ('Reconciliation - Adjustment', 'Reconciliation - Cash Over/Short')
        `;
        const count = Number(result.rows[0]?.count ?? 0);
        state.hasReconciliationAccounts = count > 0;
      }
      catch (error) {
        console.error('Error checking reconciliation accounts:', error);
        state.hasReconciliationAccounts = false;
      }
      finally {
        state.checkingAccounts = false;
      }
    }

    async function loadReconciliations() {
      try {
        state.isLoading = true;
        state.error = null;

        const result = await database.sql`
          SELECT
            rs.id,
            rs.account_code,
            a.name as account_name,
            rs.reconciliation_time,
            rs.statement_begin_time,
            rs.statement_end_time,
            rs.statement_reference,
            rs.complete_time,
            (rs.statement_closing_balance - rs.internal_closing_balance) AS balance_difference,
            (SELECT COUNT(*) FROM reconciliation_statement_items WHERE reconciliation_session_id = rs.id) AS total_statement_items,
            (SELECT COUNT(*) FROM reconciliation_statement_items WHERE reconciliation_session_id = rs.id AND is_matched = 0) AS unmatched_items,
            (SELECT COUNT(*) FROM reconciliation_discrepancies WHERE reconciliation_session_id = rs.id) AS total_discrepancies
          FROM reconciliation_sessions rs
          JOIN accounts a ON a.account_code = rs.account_code
          ORDER BY rs.reconciliation_time DESC, rs.id DESC
        `;

        state.reconciliations = result.rows.map(function rowToReconciliationSession(row) {
          return /** @type {ReconciliationSessionRow} */ ({
            id: Number(row.id),
            account_code: Number(row.account_code),
            account_name: String(row.account_name),
            reconciliation_time: Number(row.reconciliation_time),
            statement_begin_time: Number(row.statement_begin_time),
            statement_end_time: Number(row.statement_end_time),
            statement_reference: row.statement_reference !== null ? String(row.statement_reference) : null,
            complete_time: row.complete_time !== null ? Number(row.complete_time) : null,
            balance_difference: Number(row.balance_difference),
            total_statement_items: Number(row.total_statement_items),
            unmatched_items: Number(row.unmatched_items),
            total_discrepancies: Number(row.total_discrepancies),
          });
        });

        state.filteredReconciliations = filterReconciliations(state.reconciliations);
        state.isLoading = false;
      }
      catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
        state.isLoading = false;
      }
    }

    useEffect(host, checkReconciliationAccounts);

    useEffect(host, loadReconciliations);

    /** @param {Event} event */
    function handleStatusFilterChange(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      state.statusFilter = /** @type {StatusFilter} */ (event.currentTarget.dataset.status);
      state.filteredReconciliations = filterReconciliations(state.reconciliations);
    }

    /** @param {Event} event */
    function handleSearchInput(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      state.searchQuery = event.currentTarget.value;
      state.filteredReconciliations = filterReconciliations(state.reconciliations);
    }

/** @param {Event} event */
    function handleAccountCreated(event) {
      checkReconciliationAccounts();
    }

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label="${t('reconciliation', 'loadingReconciliationsAriaLabel')}"
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
          <p>${t('reconciliation', 'loadingReconciliationsMessage')}</p>
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
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('reconciliation', 'unableToLoadReconciliationsTitle')}</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadReconciliations}>
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
            ${t('reconciliation', 'missingReconciliationAccountsTitle')}
          </h2>
          <p style="max-width: 500px; color: var(--md-sys-color-on-surface-variant);">
            ${t('reconciliation', 'missingReconciliationAccountsMessage')}
          </p>
          <button
            role="button"
            class="filled"
            commandfor="reconciliation-account-creation-dialog"
            command="--open"
          >
            <material-symbols name="add"></material-symbols>
            ${t('reconciliation', 'createReconciliationAccountButtonLabel')}
          </button>
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
          <material-symbols name="rule" size="64"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('reconciliation', 'noReconciliationsFoundTitle')}</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            ${state.searchQuery || state.statusFilter !== 'All'
          ? t('reconciliation', 'noReconciliationsFoundMessage')
          : t('reconciliation', 'noReconciliationsFoundEmptyMessage')}
          </p>
          ${state.searchQuery || state.statusFilter !== 'All' ? nothing : html`
            <button
              role="button"
              class="filled"
              commandfor="account-reconciliation-creation-dialog"
              command="--open"
            >
              <material-symbols name="add"></material-symbols>
              ${t('reconciliation', 'createReconciliationButtonLabel')}
            </button>
          `}
        </div>
      `;
    }

    function renderFilterControls() {
      return html`
        <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; flex-wrap: wrap;">
          <div class="outlined-text-field" style="--md-sys-density: -4; width: 250px; min-width: 160px;">
            <div class="container">
              <material-symbols name="search" class="leading-icon" aria-hidden="true"></material-symbols>
              <label for="reconciliation-search-input">${t('reconciliation', 'searchLabel')}</label>
              <input
                ${readValue(state, 'searchQuery')}
                id="reconciliation-search-input"
                type="text"
                placeholder=" "
                autocomplete="off"
                @input=${handleSearchInput}
              />
            </div>
          </div>

          <div class="outlined-text-field" style="--md-sys-density: -4; min-width: 140px; anchor-name: --status-menu-anchor;">
            <div class="container">
              <label for="status-filter-input">${t('reconciliation', 'statusFilterLabel')}</label>
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
          <menu role="menu" popover id="status-filter-menu" aria-label="${t('reconciliation', 'statusFilterAriaLabel')}" class="dropdown" style="position-anchor: --status-menu-anchor;">
            ${repeat(statusFilterOptions, (status) => status, (status) => html`
              <li>
                <button
                  role="menuitem"
                  data-status="${status}"
                  @click=${handleStatusFilterChange}
                  popovertarget="status-filter-menu"
                  popovertargetaction="hide"
                  aria-selected=${status === state.statusFilter ? 'true' : 'false'}
                >
                  ${status === state.statusFilter ? html`<material-symbols name="check"></material-symbols>` : ''}
                  ${t('reconciliation', status === 'All' ? 'allStatusLabel' : status === 'Draft' ? 'draftStatusLabel' : 'completedStatusLabel')}
                </button>
              </li>
            `)}
          </menu>
        </div>
      `;
    }

    /**
     * @param {ReconciliationSessionRow} reconciliation
     */
    function renderReconciliationRow(reconciliation) {
      const isDraft = reconciliation.complete_time === null;
      const statusBadgeStyle = isDraft
        ? 'background-color: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container);'
        : 'background-color: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container);';

      return html`
        <tr
          tabindex="0"
          aria-label="${t('reconciliation', 'reconciliationSessionAriaLabel', reconciliation.account_name)}"
        >
          <td>
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span class="label-large" style="color: var(--md-sys-color-primary);">${reconciliation.account_code}</span>
              <span class="body-medium">${reconciliation.account_name}</span>
            </div>
          </td>
          <td>
            <span class="body-small">${i18n.date.format(new Date(reconciliation.reconciliation_time))}</span>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span class="body-small">${i18n.date.format(new Date(reconciliation.statement_begin_time))}</span>
              <span class="body-small" style="color: var(--md-sys-color-on-surface-variant);">to</span>
              <span class="body-small">${i18n.date.format(new Date(reconciliation.statement_end_time))}</span>
            </div>
          </td>
          <td>
            <span class="body-small">${reconciliation.statement_reference || '—'}</span>
          </td>
          <td>
            <span
              class="label-small"
              style="
                display: inline-flex;
                padding: 4px 12px;
                border-radius: var(--md-sys-shape-corner-full);
                ${statusBadgeStyle}
              "
            >${t('reconciliation', isDraft ? 'statusDraft' : 'statusCompleted')}</span>
          </td>
          <td class="right">
            <span
              class="label-medium"
              style="color: ${reconciliation.balance_difference === 0 ? 'var(--md-sys-color-on-surface)' : 'var(--md-sys-color-error)'};"
            >${i18n.displayCurrency(reconciliation.balance_difference)}</span>
          </td>
          <td class="center">
            <button
              role="button"
              class="text extra-small"
              title="${t('reconciliation', 'viewReconciliationDetailsTitle')}"
              aria-label="${t('reconciliation', 'viewReconciliationDetailsAriaLabel', reconciliation.statement_reference || reconciliation.id)}"
              commandfor="account-reconciliation-details-dialog"
              command="--open"
              data-reconciliation-id="${reconciliation.id}"
            >
              <material-symbols name="visibility" size="20"></material-symbols>
            </button>
          </td>
        </tr>
      `;
    }

    function renderReconciliationsTable() {
      if (state.filteredReconciliations.length === 0) return renderEmptyState();
      return html`
        <table role="table" aria-label="${t('reconciliation', 'reconciliationTableAriaLabel')}" style="--md-sys-density: -4;">
          <thead>
            <tr>
              <th scope="col">${t('reconciliation', 'tableHeaderAccount')}</th>
              <th scope="col">${t('reconciliation', 'tableHeaderReconciliationTime')}</th>
              <th scope="col">${t('reconciliation', 'tableHeaderStatementPeriod')}</th>
              <th scope="col">${t('reconciliation', 'tableHeaderStatementReference')}</th>
              <th scope="col">${t('reconciliation', 'tableHeaderStatus')}</th>
              <th scope="col" class="right">${t('reconciliation', 'tableHeaderBalanceDifference')}</th>
              <th scope="col" class="center" style="width: 80px;">${t('reconciliation', 'tableHeaderActions')}</th>
            </tr>
          </thead>
          <tbody>
            ${repeat(state.filteredReconciliations, (r) => r.id, renderReconciliationRow)}
          </tbody>
        </table>
      `;
    }

    /** @param {Event} event */
    function handleReconciliationCreated(event) {
      loadReconciliations();
    }

    /** @param {CustomEvent} event */
    function handleReconciliationCompleted(event) {
      loadReconciliations();
    }

    /** @param {CustomEvent} event */
    function handleReconciliationDeleted(event) {
      loadReconciliations();
    }

    /** @param {CustomEvent} event */
    function handleViewJournalEntry(event) {
      host.dispatchEvent(new CustomEvent('view-journal-entry', {
        detail: event.detail,
        bubbles: true,
        composed: true,
      }));
    }

    useEffect(host, function renderAccountReconciliationListView() {
      render(html`
        <div class="scrollable" style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 12px 24px; height: 100%;">
          ${state.checkingAccounts === false && state.hasReconciliationAccounts === false
          ? renderMissingAccountsWarning()
          : html`
              <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; justify-content: space-between;">
                ${renderFilterControls()}
                <div>
                  <button role="button" class="text" @click=${loadReconciliations} aria-label="${t('reconciliation', 'refreshReconciliationsAriaLabel')}">
                    <material-symbols name="refresh"></material-symbols>
                    ${t('reconciliation', 'refreshButtonLabel')}
                  </button>
                  <button
                    role="button"
                    class="filled"
                    commandfor="account-reconciliation-creation-dialog"
                    command="--open"
                  >
                    <material-symbols name="add"></material-symbols>
                    ${t('reconciliation', 'createReconciliationButtonLabel')}
                  </button>
                </div>
              </div>
              ${state.isLoading ? renderLoadingIndicator() : nothing}
              ${state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
              ${state.isLoading === false && state.error === null ? renderReconciliationsTable() : nothing}
            `}
        </div>
        <reconciliation-account-creation-dialog
          id="reconciliation-account-creation-dialog"
          @reconciliation-account-created=${handleAccountCreated}
        ></reconciliation-account-creation-dialog>
        <account-reconciliation-creation-dialog
          id="account-reconciliation-creation-dialog"
          @account-reconciliation-created=${handleReconciliationCreated}
        ></account-reconciliation-creation-dialog>
        <account-reconciliation-details-dialog
          ${detailsDialog}
          id="account-reconciliation-details-dialog"
          @account-reconciliation-completed=${handleReconciliationCompleted}
          @account-reconciliation-deleted=${handleReconciliationDeleted}
          @view-journal-entry=${handleViewJournalEntry}
        ></account-reconciliation-details-dialog>
      `);
    });
  }
}

defineWebComponent('account-reconciliation-list-view', AccountReconciliationListViewElement);
