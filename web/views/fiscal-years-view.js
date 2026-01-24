import { html, nothing } from 'lit-html';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { FiscalYearClosingDialogElement } from '#web/components/fiscal-year-closing-dialog.js';
import { FiscalYearReversalDialogElement } from '#web/components/fiscal-year-reversal-dialog.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useElement } from '#web/hooks/use-element.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';

import '#web/components/material-symbols.js';
import '#web/components/fiscal-year-creation-dialog.js';
import '#web/components/fiscal-year-closing-dialog.js';
import '#web/components/fiscal-year-reversal-dialog.js';
import { when } from 'lit-html/directives/when.js';

/**
 * @typedef {object} FiscalYearRow
 * @property {number} begin_time
 * @property {number} end_time
 * @property {string | null} name
 * @property {number | null} post_time
 * @property {number | null} closing_journal_entry_ref
 * @property {number | null} reversal_time
 * @property {number | null} reversal_journal_entry_ref
 */

export class FiscalYearsViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);

    const fiscalYearClosingDialog = useElement(host, FiscalYearClosingDialogElement);
    const fiscalYearReversalDialog = useElement(host, FiscalYearReversalDialogElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      fiscalYears: /** @type {FiscalYearRow[]} */ ([]),
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      selectedFiscalYearBeginTime: /** @type {number | null} */ (null),
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false;
    });

    async function loadFiscalYears() {
      try {
        state.isLoading = true;
        state.error = null;

        const result = await database.sql`
          SELECT
            begin_time,
            end_time,
            name,
            post_time,
            closing_journal_entry_ref,
            reversal_time,
            reversal_journal_entry_ref
          FROM fiscal_years
          ORDER BY begin_time DESC
        `;

        state.fiscalYears = result.rows.map(function rowToFiscalYear(row) {
          return /** @type {FiscalYearRow} */ ({
            begin_time: Number(row.begin_time),
            end_time: Number(row.end_time),
            name: row.name ? String(row.name) : null,
            post_time: row.post_time ? Number(row.post_time) : null,
            closing_journal_entry_ref: row.closing_journal_entry_ref ? Number(row.closing_journal_entry_ref) : null,
            reversal_time: row.reversal_time ? Number(row.reversal_time) : null,
            reversal_journal_entry_ref: row.reversal_journal_entry_ref ? Number(row.reversal_journal_entry_ref) : null,
          });
        });

        state.isLoading = false;
      }
      catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
        state.isLoading = false;
      }
    }

    useEffect(host, loadFiscalYears);

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label="${t('fiscalYear', 'loadingFiscalYearLabel')}"
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
          <p>${t('fiscalYear', 'loadingLabel')}</p>
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
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('fiscalYear', 'loadErrorTitle')}</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadFiscalYears}>
            <material-symbols name="refresh"></material-symbols>
            ${t('fiscalYear', 'retryActionLabel')}
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
          <material-symbols name="calendar_month" size="64"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('fiscalYear', 'emptyStateTitle')}</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            ${t('fiscalYear', 'emptyStateMessage')}
          </p>
          <button
            role="button"
            type="button"
            class="tonal"
            commandfor="fiscal-year-creation-dialog"
            command="--open"
          >
            <material-symbols name="add"></material-symbols>
            ${t('fiscalYear', 'createActionLabel')}
          </button>
        </div>
      `;
    }

    /**
     * @param {FiscalYearRow} fiscalYear
     */
    function renderFiscalYearRow(fiscalYear) {
      const statusText = fiscalYear.reversal_time ? t('fiscalYear', 'statusReversed') : fiscalYear.post_time ? t('fiscalYear', 'statusClosed') : t('fiscalYear', 'statusOpen');
      const displayName = fiscalYear.name || t('fiscalYear', 'fiscalYearDefaultName', new Date(fiscalYear.begin_time).getFullYear());
      const canReverse = fiscalYear.post_time && !fiscalYear.reversal_time;

      return html`
        <tr>
          <td class="label-large" style="color: var(--md-sys-color-primary);">
            <button
              role="button"
              type="button"
              class="text extra-small"
              style="--md-sys-density: -4;"
              commandfor="fiscal-year-closing-dialog"
              command="--open"
              data-begin-time="${fiscalYear.begin_time}"
            >${displayName}</button>
          </td>
          <td style="white-space: nowrap;">${i18n.date.format(fiscalYear.begin_time)}</td>
          <td style="white-space: nowrap;">${i18n.date.format(fiscalYear.end_time)}</td>
          <td class="center">
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span
                class="label-small"
                style="
                  display: inline-flex;
                  align-items: center;
                  gap: 4px;
                  padding: 4px 8px;
                  border-radius: var(--md-sys-shape-corner-small);
                  background-color: ${fiscalYear.reversal_time ? 'var(--md-sys-color-error-container)' : fiscalYear.post_time ? 'var(--md-sys-color-tertiary-container)' : 'var(--md-sys-color-secondary-container)'};
                  color: ${fiscalYear.reversal_time ? 'var(--md-sys-color-on-error-container)' : fiscalYear.post_time ? 'var(--md-sys-color-on-tertiary-container)' : 'var(--md-sys-color-on-secondary-container)'};
                "
              >
                ${when(fiscalYear.reversal_time, () => html`<material-symbols name="history" size="16" aria-hidden="true"></material-symbols>`)}
                ${when(!fiscalYear.reversal_time && fiscalYear.post_time, () => html`<material-symbols name="lock" size="16" aria-hidden="true"></material-symbols>`)}
                ${when(!fiscalYear.reversal_time && !fiscalYear.post_time, () => html`<material-symbols name="lock_open" size="16" aria-hidden="true"></material-symbols>`)}
                ${statusText}
              </span>
              ${canReverse ? html`
                <button
                  role="button"
                  type="button"
                  class="text extra-small"
                  style="--md-sys-density: -4;"
                  commandfor="fiscal-year-reversal-dialog"
                  command="--open"
                  data-begin-time="${fiscalYear.begin_time}"
                  aria-label="${t('fiscalYear', 'reverseActionLabel')} ${displayName}"
                >
                  <material-symbols name="history" size="18"></material-symbols>
                  ${t('fiscalYear', 'reverseActionLabel')}
                </button>
              ` : nothing}
            </div>
          </td>
          <td style="white-space: nowrap;">${fiscalYear.post_time ? i18n.date.format(fiscalYear.post_time) : '—'}</td>
          <td class="center">
            ${fiscalYear.closing_journal_entry_ref
          ? html`<span style="color: var(--md-sys-color-primary);">#${fiscalYear.closing_journal_entry_ref}</span>`
          : '—'}
          </td>
        </tr>
      `;
    }

    function renderFiscalYearsTable() {
      if (state.fiscalYears.length === 0) return renderEmptyState();
      return html`
        <table aria-label="Fiscal years list" style="--md-sys-density: -3;">
          <thead>
            <tr>
              <th scope="col">${t('fiscalYear', 'nameColumn')}</th>
              <th scope="col" style="width: 140px;">${t('fiscalYear', 'beginDateColumn')}</th>
              <th scope="col" style="width: 140px;">${t('fiscalYear', 'endDateColumn')}</th>
              <th scope="col" class="center" style="width: 100px;">${t('fiscalYear', 'statusColumn')}</th>
              <th scope="col" style="width: 140px;">${t('fiscalYear', 'closedOnColumn')}</th>
              <th scope="col" class="center" style="width: 120px;">${t('fiscalYear', 'closingEntryColumn')}</th>
            </tr>
          </thead>
          <tbody>
            ${state.fiscalYears.map(renderFiscalYearRow)}
          </tbody>
        </table>
      `;
    }

    useEffect(host, function renderFiscalYearsView() {
      render(html`
        <div style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 16px 24px 0px;">
          <header style="--md-sys-density: -4; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: row; gap: 12px; align-items: center;">
              <!-- Future: Add filters here if needed -->
            </div>
            <div style="display: flex; flex-direction: row; gap: 12px; align-items: center;">
              <button role="button" class="text" @click=${loadFiscalYears} aria-label="${t('fiscalYear', 'refreshActionLabel')}">
                <material-symbols name="refresh"></material-symbols>
                ${t('fiscalYear', 'refreshActionLabel')}
              </button>
              <button role="button" type="button" class="tonal" commandfor="fiscal-year-creation-dialog" command="--open">
                <material-symbols name="add"></material-symbols>
                ${t('fiscalYear', 'newFiscalYearActionLabel')}
              </button>
            </div>
          </header>

          ${state.isLoading ? renderLoadingIndicator() : nothing}
          ${state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
          ${state.isLoading === false && state.error === null ? renderFiscalYearsTable() : nothing}
        </div>

        <fiscal-year-creation-dialog
          id="fiscal-year-creation-dialog"
          @fiscal-year-created=${loadFiscalYears}
        ></fiscal-year-creation-dialog>

        <fiscal-year-closing-dialog
          ${fiscalYearClosingDialog}
          id="fiscal-year-closing-dialog"
          @fiscal-year-closed=${loadFiscalYears}
        ></fiscal-year-closing-dialog>

        <fiscal-year-reversal-dialog
          ${fiscalYearReversalDialog}
          id="fiscal-year-reversal-dialog"
          @fiscal-year-reversed=${loadFiscalYears}
        ></fiscal-year-reversal-dialog>
      `);
    });
  }
}

defineWebComponent('fiscal-years-view', FiscalYearsViewElement);
