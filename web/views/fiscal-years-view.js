import { html, nothing } from 'lit-html';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { FiscalYearClosingDialogElement } from '#web/components/fiscal-year-closing-dialog.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useElement } from '#web/hooks/use-element.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

import '#web/components/material-symbols.js';
import '#web/components/fiscal-year-creation-dialog.js';
import '#web/components/fiscal-year-closing-dialog.js';

/**
 * @typedef {object} FiscalYearRow
 * @property {number} begin_time
 * @property {number} end_time
 * @property {string | null} name
 * @property {number} is_closed
 * @property {number | null} post_time
 * @property {number | null} closing_journal_entry_ref
 */

export class FiscalYearsViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);

    const fiscalYearClosingDialog = useElement(host, FiscalYearClosingDialogElement);
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
            is_closed,
            post_time,
            closing_journal_entry_ref
          FROM fiscal_years
          ORDER BY begin_time DESC
        `;

        state.fiscalYears = result.rows.map(function (row) {
          return /** @type {FiscalYearRow} */ ({
            begin_time: Number(row.begin_time),
            end_time: Number(row.end_time),
            name: row.name ? String(row.name) : null,
            is_closed: Number(row.is_closed),
            post_time: row.post_time ? Number(row.post_time) : null,
            closing_journal_entry_ref: row.closing_journal_entry_ref ? Number(row.closing_journal_entry_ref) : null,
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

    /** @param {Event} event */
    function handleFiscalYearRowInteraction(event) {
      assertInstanceOf(HTMLTableRowElement, event.currentTarget);

      const beginTime = Number(event.currentTarget.dataset.beginTime);
      if (isNaN(beginTime)) return;

      const isOpeningAction = (event instanceof MouseEvent && event.type === 'click')
        || (event instanceof KeyboardEvent && ['Enter', ' '].includes(event.key));

      if (isOpeningAction) {
        state.selectedFiscalYearBeginTime = beginTime;
        if (fiscalYearClosingDialog.value instanceof FiscalYearClosingDialogElement) {
          fiscalYearClosingDialog.value.dispatchEvent(new CommandEvent('command', {
            command: '--open',
            bubbles: true,
            cancelable: true,
            source: event.currentTarget,
          }));
          event.preventDefault();
        }
      }
    }

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label="Loading fiscal years"
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
          <p>Loading fiscal years...</p>
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
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">Unable to load fiscal years</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadFiscalYears}>
            <material-symbols name="refresh"></material-symbols>
            Retry
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
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">No fiscal years defined</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            Create your first fiscal year to organize your accounting periods and enable income statement reporting.
          </p>
          <button
            role="button"
            type="button"
            class="tonal"
            commandfor="fiscal-year-creation-dialog"
            command="--open"
          >
            <material-symbols name="add"></material-symbols>
            Create Fiscal Year
          </button>
        </div>
      `;
    }

    /**
     * @param {FiscalYearRow} fiscalYear
     */
    function renderFiscalYearRow(fiscalYear) {
      const statusText = fiscalYear.is_closed ? 'Closed' : 'Open';
      const displayName = fiscalYear.name || `FY ${new Date(fiscalYear.begin_time).getFullYear()}`;

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
            <span
              class="label-small"
              style="
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 4px 8px;
                border-radius: var(--md-sys-shape-corner-small);
                background-color: ${statusText === 'Closed' ? 'var(--md-sys-color-tertiary-container)' : 'var(--md-sys-color-secondary-container)'};
                color: ${statusText === 'Closed' ? 'var(--md-sys-color-on-tertiary-container)' : 'var(--md-sys-color-on-secondary-container)'};
              "
            >
              <material-symbols name="${fiscalYear.is_closed ? 'lock' : 'lock_open'}" size="16" aria-hidden="true"></material-symbols>
              ${statusText}
            </span>
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
              <th scope="col">Name</th>
              <th scope="col" style="width: 140px;">Begin Date</th>
              <th scope="col" style="width: 140px;">End Date</th>
              <th scope="col" class="center" style="width: 100px;">Status</th>
              <th scope="col" style="width: 140px;">Closed On</th>
              <th scope="col" class="center" style="width: 120px;">Closing Entry</th>
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
              <button role="button" class="text" @click=${loadFiscalYears} aria-label="Refresh fiscal years">
                <material-symbols name="refresh"></material-symbols>
                Refresh
              </button>
              <button role="button" type="button" class="tonal" commandfor="fiscal-year-creation-dialog" command="--open">
                <material-symbols name="add"></material-symbols>
                New Fiscal Year
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
      `);
    });
  }
}

defineWebComponent('fiscal-years-view', FiscalYearsViewElement);
