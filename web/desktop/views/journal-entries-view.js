import { html, nothing } from 'lit-html';
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
import { webStyleSheets } from '#web/desktop/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import {
  getJournalEntryOwnerLabel,
  getJournalEntryOwnerType,
} from '#web/tools/accounting.js';

import '#web/desktop/components/journal-entry-creation-dialog.js';
import '#web/desktop/components/journal-entry-details-dialog.js';
import '#web/desktop/components/material-symbols.js';

/**
 * @typedef {object} JournalEntryRow
 * @property {number} ref
 * @property {number} entry_time
 * @property {string | null} note
 * @property {string} owner_type
 * @property {number | null} post_time
 * @property {number} total_amount
 */

const statusTypes = /** @type {const} */ (['All', 'Posted', 'Draft']);

/** @typedef {typeof statusTypes[number]} StatusType */

export class JournalEntriesViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);

    const t = useTranslator(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const pageSize = 10;

    const state = reactive({
      journalEntries: /** @type {JournalEntryRow[]} */ ([]),
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      statusFilter: /** @type {StatusType} */ ('All'),
      currentPage: 1,
      totalCount: 0,
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false;
    });

    function getTotalPages() {
      return Math.max(1, Math.ceil(state.totalCount / pageSize));
    }

    async function loadJournalEntries() {
      try {
        state.isLoading = true;
        state.error = null;

        const statusFilterValue = state.statusFilter === 'All' ? null : state.statusFilter;
        const offset = (state.currentPage - 1) * pageSize;

        const countResult = await database.sql`
          SELECT COUNT(*) AS count
          FROM journal_entries je
          WHERE (${statusFilterValue} IS NULL
            OR (${statusFilterValue} = 'Posted' AND je.post_time IS NOT NULL)
            OR (${statusFilterValue} = 'Draft' AND je.post_time IS NULL))
        `;
        state.totalCount = Number(countResult.rows[0].count);

        const result = await database.sql`
          SELECT
            je.ref,
            je.entry_time,
            je.note,
            je.post_time,
            je.purchase_id,
            je.sale_id,
            je.stock_taking_id,
            je.fixed_asset_id,
            je.reconciliation_id,
            EXISTS(
              SELECT 1 FROM fiscal_years fy WHERE fy.closing_journal_entry_ref = je.ref
            ) AS is_fiscal_year_closing,
            EXISTS(
              SELECT 1 FROM fiscal_years fy WHERE fy.reversal_journal_entry_ref = je.ref
            ) AS is_fiscal_year_reversal,
            EXISTS(
              SELECT 1 FROM fiscal_years fy WHERE fy.depreciation_journal_entry_ref = je.ref
            ) AS is_fiscal_year_depreciation,
            EXISTS(
              SELECT 1 FROM fiscal_years fy WHERE fy.depreciation_reversal_journal_entry_ref = je.ref
            ) AS is_fiscal_year_depreciation_reversal,
            COALESCE(SUM(jel.debit), 0) AS total_amount
          FROM journal_entries je
          LEFT JOIN journal_entry_lines jel ON jel.journal_entry_ref = je.ref
          WHERE (${statusFilterValue} IS NULL
            OR (${statusFilterValue} = 'Posted' AND je.post_time IS NOT NULL)
            OR (${statusFilterValue} = 'Draft' AND je.post_time IS NULL))
          GROUP BY je.ref
          ORDER BY je.entry_time DESC, je.ref DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `;

        state.journalEntries = result.rows.map(function rowToJournalEntry(row) {
          return /** @type {JournalEntryRow} */ ({
            ref: Number(row.ref),
            entry_time: Number(row.entry_time),
            note: row.note ? String(row.note) : null,
            owner_type: getJournalEntryOwnerType(row),
            post_time: row.post_time ? Number(row.post_time) : null,
            total_amount: Number(row.total_amount),
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
      loadJournalEntries();
    }

    /** @param {Event} event */
    function handlePageChange(event) {
      if (!(event.currentTarget instanceof HTMLElement)) return;
      const page = Number(event.currentTarget.dataset.page);
      goToPage(page);
    }

    /** @param {Event} event */
    function handleStatusFilterChange(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      state.statusFilter = /** @type {StatusType} */ (event.currentTarget.dataset.statusType);
      state.currentPage = 1;
      loadJournalEntries();
    }

    useEffect(host, loadJournalEntries);

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label=${t('journalEntry', 'loadingEntriesLabel')}
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
          <p>${t('journalEntry', 'loadingEntriesLabel')}</p>
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
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('journalEntry', 'loadEntriesErrorTitle')}</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadJournalEntries}>
            <material-symbols name="refresh" style="color: var(--md-sys-color-error);"></material-symbols>
            ${t('journalEntry', 'retryActionLabel')}
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
          <material-symbols name="receipt_long" size="64"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('journalEntry', 'emptyStateTitle')}</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">${t('journalEntry', 'emptyStateMessage')}</p>
          <button
            role="button"
            type="button"
            class="tonal"
            commandfor="journal-entry-creation-dialog"
            command="--open"
          >
            <material-symbols name="add" style="color: var(--md-sys-color-on-surface-variant);"></material-symbols>
            ${t('journalEntry', 'newEntryActionLabel')}
          </button>
        </div>
      `;
    }

    /**
     * @param {JournalEntryRow} journalEntry
     */
    function renderJournalEntryRow(journalEntry) {
      const isPosted = journalEntry.post_time !== null;
      const statusLabel = isPosted ? t('journalEntry', 'statusPosted') : t('journalEntry', 'statusDraft');
      const ownerLabel = getJournalEntryOwnerLabel(journalEntry.owner_type, t);

      return html`
        <tr>
          <td>
            <button
              role="button"
              type="button"
              class="text extra-small label-large"
              style="--md-sys-density: -4; color: var(--md-sys-color-primary);"
              commandfor="journal-entry-details-dialog"
              command="--open"
              data-journal-entry-ref="${journalEntry.ref}"
            >#${journalEntry.ref}</button>
          </td>
          <td style="white-space: nowrap;">${i18n.date.format(journalEntry.entry_time)}</td>
          <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${journalEntry.note || '—'}</td>
          <td class="source-cell center">
            <span
              class="label-small"
              data-owner-type="${journalEntry.owner_type}"
              style="
                display: inline-flex;
                padding: 4px 8px;
                border-radius: var(--md-sys-shape-corner-small);
                background-color: var(--md-sys-color-surface-container-high);
                color: var(--md-sys-color-on-surface-variant);
                ${journalEntry.owner_type === 'Manual' ? 'background-color: var(--md-sys-color-tertiary-container);' : nothing}
                ${journalEntry.owner_type === 'Manual' ? 'color: var(--md-sys-color-on-tertiary-container);' : nothing}
                ${journalEntry.owner_type !== 'Manual' ? 'background-color: var(--md-sys-color-secondary-container);' : nothing}
                ${journalEntry.owner_type !== 'Manual' ? 'color: var(--md-sys-color-on-secondary-container);' : nothing}
              "
            >${ownerLabel}</span>
          </td>
          <td class="numeric">${i18n.displayCurrency(journalEntry.total_amount)}</td>
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
            >${statusLabel}</span>
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
          aria-label=${t('journalEntry', 'paginationShowing', startItem, endItem, state.totalCount)}
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            border-top: 1px solid var(--md-sys-color-outline-variant);
          "
        >
          <span class="body-small" style="color: var(--md-sys-color-on-surface-variant);">
            ${t('journalEntry', 'paginationShowing', startItem, endItem, state.totalCount)}
          </span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button
              role="button"
              class="text"
              data-page="1"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === 1}
              aria-label=${t('journalEntry', 'paginationFirst')}
            >
              <material-symbols name="first_page"></material-symbols>
            </button>
            <button
              role="button"
              class="text"
              data-page="${state.currentPage - 1}"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === 1}
              aria-label=${t('journalEntry', 'paginationPrevious')}
            >
              <material-symbols name="chevron_left"></material-symbols>
            </button>
            <span class="body-medium" style="min-width: 80px; text-align: center;">
              ${t('journalEntry', 'paginationPage', state.currentPage, totalPages)}
            </span>
            <button
              role="button"
              class="text"
              data-page="${state.currentPage + 1}"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === totalPages}
              aria-label=${t('journalEntry', 'paginationNext')}
            >
              <material-symbols name="chevron_right"></material-symbols>
            </button>
            <button
              role="button"
              class="text"
              data-page="${totalPages}"
              @click=${handlePageChange}
              ?disabled=${state.currentPage === totalPages}
              aria-label=${t('journalEntry', 'paginationLast')}
            >
              <material-symbols name="last_page"></material-symbols>
            </button>
          </div>
        </nav>
      `;
    }

    function renderJournalEntriesTable() {
      if (state.journalEntries.length === 0) return renderEmptyState();

      return html`
        <table aria-label="Journal entries list" style="--md-sys-density: -3;">
          <thead>
            <tr>
              <th scope="col" style="width: 32px;">${t('journalEntry', 'refColumn')}</th>
              <th scope="col" style="width: 128px;">${t('journalEntry', 'dateLabel')}</th>
              <th scope="col">${t('journalEntry', 'noteLabel')}</th>
              <th scope="col" class="center" style="width: 176px;">${t('journalEntry', 'workflowLabel')}</th>
              <th scope="col" class="numeric" style="width: 128px;">${t('journalEntry', 'amountColumn')}</th>
              <th scope="col" class="center" style="width: 128px;">${t('journalEntry', 'statusLabel')}</th>
            </tr>
          </thead>
          <tbody>
            ${state.journalEntries.map(renderJournalEntryRow)}
          </tbody>
        </table>
        ${renderPaginationControls()}
      `;
    }

    /** @param {StatusType} statusType */
    function getStatusLabel(statusType) {
      if (statusType === 'All') return t('journalEntry', 'filterStatusAll');
      if (statusType === 'Posted') return t('journalEntry', 'statusPosted');
      if (statusType === 'Draft') return t('journalEntry', 'statusDraft');
      return statusType;
    }

    useEffect(host, function renderJournalEntriesView() {
      render(html`
        <div style="display: flex; flex-direction: column; gap: 12px; padding: 16px 24px 0px;">
          <header style="--md-sys-density: -4; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; justify-content: space-between; width: 100%;">
              <div style="display: flex; flex-direction: row; gap: 12px; align-items: center;">
                <div class="outlined-text-field" style="min-width: 160px; anchor-name: --status-menu-anchor;">
                  <div class="container">
                    <label for="status-filter-input">${t('journalEntry', 'statusLabel')}</label>
                    <input
                      id="status-filter-input"
                      type="button"
                      value="${getStatusLabel(state.statusFilter)}"
                      popovertarget="status-menu"
                      popovertargetaction="show"
                      placeholder=" "
                      aria-label="${t('journalEntry', 'statusLabel')}"
                    />
                    <label for="status-filter-input" class="trailing-icon" aria-hidden="true">
                      <material-symbols name="arrow_drop_down"></material-symbols>
                    </label>
                  </div>
                </div>
                <menu role="menu" popover id="status-menu" class="dropdown" style="position-anchor: --status-menu-anchor">
                  ${statusTypes.map((statusType) => html`
                    <li>
                      <button
                        role="menuitemradio"
                        aria-checked=${state.statusFilter === statusType ? 'true' : 'false'}
                        type="button"
                        popovertarget="status-menu"
                        popovertargetaction="hide"
                        data-status-type="${statusType}"
                        @click=${handleStatusFilterChange}
                      >
                        ${state.statusFilter === statusType ? html`<material-symbols name="check"></material-symbols>` : nothing}
                        ${getStatusLabel(statusType)}
                      </button>
                    </li>
                  `)}
                </menu>
              </div>
              <div style="display: flex; flex-direction: row; gap: 12px; align-items: center;">
                <button role="button" class="text" @click=${loadJournalEntries} aria-label=${t('journalEntry', 'refreshActionLabel')}>
                  <material-symbols name="refresh"></material-symbols>
                  ${t('journalEntry', 'refreshActionLabel')}
                </button>
                <button role="button" type="button" class="tonal" commandfor="journal-entry-creation-dialog" command="--open">
                  <material-symbols name="add"></material-symbols>
                  ${t('journalEntry', 'newEntryActionLabel')}
                </button>
              </div>
            </div>
          </header>

          ${state.isLoading ? renderLoadingIndicator() : nothing}
          ${state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
          ${state.isLoading === false ? renderJournalEntriesTable() : nothing}
        </div>

        <journal-entry-creation-dialog
          id="journal-entry-creation-dialog"
          @journal-entry-created=${loadJournalEntries}
        ></journal-entry-creation-dialog>

        <journal-entry-details-dialog
          id="journal-entry-details-dialog"
          @journal-entry-posted=${loadJournalEntries}
          @journal-entry-discarded=${loadJournalEntries}
          @journal-entry-reversed=${loadJournalEntries}
        ></journal-entry-details-dialog>
      `);
    });
  }
}

defineWebComponent('journal-entries-view', JournalEntriesViewElement);