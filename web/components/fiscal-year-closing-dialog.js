import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useElement } from '#web/hooks/use-element.js';
import { webStyleSheets } from '#web/styles.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';

/**
 * @typedef {object} FiscalYearDetail
 * @property {number} begin_time
 * @property {number} end_time
 * @property {string | null} name
 * @property {number} is_closed
 * @property {number | null} post_time
 * @property {number | null} closing_journal_entry_ref
 * @property {number} unposted_entries_count
 * @property {number} total_revenue
 * @property {number} total_expense
 * @property {number} net_income
 */

/**
 * Fiscal Year Closing Dialog Component
 * 
 * @fires fiscal-year-closed - Fired when a fiscal year is successfully closed. Detail: { beginTime: number }
 */
export class FiscalYearClosingDialogElement extends HTMLElement {
  static observedAttributes = ['begin-time'];

  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);

    const dialog = useDialog(host);
    const confirmDialog = useElement(host, HTMLDialogElement);
    const errorAlertDialog = useElement(host, HTMLDialogElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      closingState: /** @type {'idle' | 'closing' | 'success' | 'error'} */ ('idle'),
      closingError: /** @type {Error | null} */ (null),
      fiscalYear: /** @type {FiscalYearDetail | null} */ (null),
    });

    async function loadFiscalYearDetails() {
      const beginTimeValue = dialog.context?.dataset.beginTime;

      if (beginTimeValue === null) {
        state.fiscalYear = null;
        state.isLoading = false;
        return;
      }

      try {
        state.isLoading = true;
        state.error = null;

        const beginTime = Number(beginTimeValue);

        // Get fiscal year details
        const fyResult = await database.sql`
          SELECT
            fy.begin_time,
            fy.end_time,
            fy.name,
            fy.is_closed,
            fy.post_time,
            fy.closing_journal_entry_ref
          FROM fiscal_years fy
          WHERE fy.begin_time = ${beginTime}
        `;

        if (fyResult.rows.length === 0) {
          state.error = new Error('Fiscal year not found');
          state.isLoading = false;
          return;
        }

        const fyRow = fyResult.rows[0];

        // Count unposted entries within fiscal year period
        const unpostedResult = await database.sql`
          SELECT COUNT(*) as count
          FROM journal_entries je
          WHERE je.entry_time > ${beginTime}
            AND je.entry_time <= ${Number(fyRow.end_time)}
            AND je.post_time IS NULL
        `;

        // Calculate revenue and expenses for this period
        const revenueResult = await database.sql`
          SELECT COALESCE(SUM(
            CASE a.normal_balance
              WHEN 1 THEN jel.credit - jel.debit
              ELSE jel.debit - jel.credit
            END
          ), 0) as total
          FROM journal_entry_lines jel
          JOIN journal_entries je ON je.ref = jel.journal_entry_ref
          JOIN accounts a ON a.account_code = jel.account_code
          JOIN account_tags at ON at.account_code = a.account_code
          WHERE je.entry_time > ${beginTime}
            AND je.entry_time <= ${Number(fyRow.end_time)}
            AND je.post_time IS NOT NULL
            AND at.tag = 'Fiscal Year Closing - Revenue'
        `;

        const expenseResult = await database.sql`
          SELECT COALESCE(SUM(
            CASE a.normal_balance
              WHEN 0 THEN jel.debit - jel.credit
              ELSE jel.credit - jel.debit
            END
          ), 0) as total
          FROM journal_entry_lines jel
          JOIN journal_entries je ON je.ref = jel.journal_entry_ref
          JOIN accounts a ON a.account_code = jel.account_code
          JOIN account_tags at ON at.account_code = a.account_code
          WHERE je.entry_time > ${beginTime}
            AND je.entry_time <= ${Number(fyRow.end_time)}
            AND je.post_time IS NOT NULL
            AND at.tag = 'Fiscal Year Closing - Expense'
        `;

        const totalRevenue = Number(revenueResult.rows[0].total) || 0;
        const totalExpense = Number(expenseResult.rows[0].total) || 0;

        state.fiscalYear = {
          begin_time: Number(fyRow.begin_time),
          end_time: Number(fyRow.end_time),
          name: fyRow.name ? String(fyRow.name) : null,
          is_closed: Number(fyRow.is_closed),
          post_time: fyRow.post_time ? Number(fyRow.post_time) : null,
          closing_journal_entry_ref: fyRow.closing_journal_entry_ref ? Number(fyRow.closing_journal_entry_ref) : null,
          unposted_entries_count: Number(unpostedResult.rows[0].count) || 0,
          total_revenue: totalRevenue,
          total_expense: totalExpense,
          net_income: totalRevenue - totalExpense,
        };

        state.isLoading = false;
      }
      catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
        state.isLoading = false;
      }
    }

    useEffect(host, loadFiscalYearDetails);

    function handleOpenConfirmDialog() {
      if (confirmDialog.value instanceof HTMLDialogElement) {
        confirmDialog.value.showModal();
      }
    }

    async function handleCloseFiscalYear() {
      if (state.fiscalYear === null) return;
      if (state.fiscalYear.is_closed) return;

      try {
        state.closingState = 'closing';
        state.closingError = null;

        if (confirmDialog.value instanceof HTMLDialogElement) {
          confirmDialog.value.close();
        }

        const beginTime = state.fiscalYear.begin_time;
        const now = Date.now();

        // Close fiscal year by setting post_time
        // This triggers the automated closing entry creation via database trigger
        await database.sql`
          UPDATE fiscal_years
          SET post_time = ${now}
          WHERE begin_time = ${beginTime}
            AND post_time IS NULL
        `;

        state.closingState = 'success';
        await feedbackDelay();

        host.dispatchEvent(new CustomEvent('fiscal-year-closed', {
          detail: { beginTime },
          bubbles: true,
          composed: true,
        }));

        // Reload to show updated state
        await loadFiscalYearDetails();

        state.closingState = 'idle';
      }
      catch (error) {
        state.closingState = 'error';
        state.closingError = error instanceof Error ? error : new Error(String(error));
        await feedbackDelay();
        state.closingState = 'idle';
      }
    }

    function handleDismissErrorDialog() {
      state.closingError = null;
    }

    useEffect(host, async function syncErrorAlertDialogState() {
      if (errorAlertDialog.value instanceof HTMLDialogElement) {
        if (state.closingError instanceof Error) errorAlertDialog.value.showModal();
        else errorAlertDialog.value.close();
      }
    });

    useEffect(host, function renderDialog() {
      const fy = state.fiscalYear;
      const canClose = fy !== null && !fy.is_closed && fy.unposted_entries_count === 0;
      const hasUnpostedEntries = fy !== null && fy.unposted_entries_count > 0;

      render(html`
        <dialog
          ${dialog.element}
          id="fiscal-year-closing-dialog"
          class="full-screen"
          aria-labelledby="fiscal-year-closing-dialog-title"
        >
          <div class="container">
            <header>
              <h2 id="fiscal-year-closing-dialog-title">
                ${fy?.name || 'Fiscal Year'} Details
              </h2>
              <button
                role="button"
                type="button"
                class="text"
                aria-label="Close dialog"
                commandfor="fiscal-year-closing-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              ${fy !== null && !fy.is_closed ? html`
                <button
                  role="button"
                  type="button"
                  ?disabled=${!canClose || state.closingState !== 'idle'}
                  @click=${handleOpenConfirmDialog}
                >
                  ${state.closingState === 'closing' ? 'Closing...' : state.closingState === 'success' ? 'Closed!' : 'Close Fiscal Year'}
                </button>
              ` : nothing}
            </header>

            <div class="content">
              ${state.isLoading ? html`
                <div
                  role="status"
                  aria-label="Loading fiscal year details"
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
                  <p>Loading fiscal year details...</p>
                </div>
              ` : state.error instanceof Error ? html`
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
                  <h3 class="title-large" style="color: var(--md-sys-color-on-surface);">Error</h3>
                  <p style="color: var(--md-sys-color-on-surface-variant);">${state.error.message}</p>
                </div>
              ` : fy !== null ? html`
                <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0px; max-width: 600px; margin: 0 auto;">

                  <!-- Status Badge -->
                  <div style="display: flex; justify-content: center;">
                    <span
                      class="label-large"
                      style="
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        padding: 8px 16px;
                        border-radius: var(--md-sys-shape-corner-medium);
                        ${fy.is_closed
                          ? 'background-color: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container);'
                          : 'background-color: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container);'}
                      "
                    >
                      <material-symbols name="${fy.is_closed ? 'lock' : 'lock_open'}" size="20" aria-hidden="true"></material-symbols>
                      ${fy.is_closed ? 'Closed' : 'Open'}
                    </span>
                  </div>

                  <!-- Period Info -->
                  <div class="card outlined" style="padding: 16px;">
                    <h3 class="title-medium" style="margin-bottom: 12px;">Period</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                      <div>
                        <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">Begin Date</p>
                        <p class="body-large">${i18n.date.format(fy.begin_time)}</p>
                      </div>
                      <div>
                        <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">End Date</p>
                        <p class="body-large">${i18n.date.format(fy.end_time)}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Financial Summary -->
                  <div class="card outlined" style="padding: 16px;">
                    <h3 class="title-medium" style="margin-bottom: 12px;">Financial Summary</h3>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="body-medium">Total Revenue</span>
                        <span class="body-large" style="color: var(--md-sys-color-primary);">
                          ${i18n.displayCurrency(fy.total_revenue)}
                        </span>
                      </div>
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="body-medium">Total Expenses</span>
                        <span class="body-large" style="color: var(--md-sys-color-error);">
                          (${i18n.displayCurrency(fy.total_expense)})
                        </span>
                      </div>
                      <hr style="border: none; border-top: 1px solid var(--md-sys-color-outline-variant);">
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="title-small">Net Income</span>
                        <span
                          class="title-medium"
                          style="color: ${fy.net_income >= 0 ? '#2E7D32' : '#C62828'};"
                        >
                          ${fy.net_income < 0 ? '(' + i18n.displayCurrency(Math.abs(fy.net_income)) + ')' : i18n.displayCurrency(fy.net_income)}
                        </span>
                      </div>
                    </div>
                  </div>

                  ${!fy.is_closed ? html`
                    <!-- Closing Requirements -->
                    <div class="card outlined" style="padding: 16px;">
                      <h3 class="title-medium" style="margin-bottom: 12px;">Closing Requirements</h3>
                      ${hasUnpostedEntries ? html`
                        <div
                          role="alert"
                          style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 12px;
                            border-radius: var(--md-sys-shape-corner-small);
                            background-color: #FFF3E0;
                            color: #E65100;
                          "
                        >
                          <material-symbols name="warning" size="24"></material-symbols>
                          <div>
                            <p class="body-medium" style="font-weight: 500;">Unposted Entries</p>
                            <p class="body-small">
                              There are ${fy.unposted_entries_count} unposted journal entries within this fiscal year period.
                              All entries must be posted before closing.
                            </p>
                          </div>
                        </div>
                      ` : html`
                        <div
                          style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 12px;
                            border-radius: var(--md-sys-shape-corner-small);
                            background-color: #E8F5E9;
                            color: #2E7D32;
                          "
                        >
                          <material-symbols name="check_circle" size="24"></material-symbols>
                          <div>
                            <p class="body-medium" style="font-weight: 500;">Ready to Close</p>
                            <p class="body-small">
                              All journal entries within this fiscal year are posted. You can proceed with closing.
                            </p>
                          </div>
                        </div>
                      `}
                    </div>
                  ` : html`
                    <!-- Closing Details -->
                    <div class="card outlined" style="padding: 16px;">
                      <h3 class="title-medium" style="margin-bottom: 12px;">Closing Details</h3>
                      <div style="display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; justify-content: space-between;">
                          <span class="body-medium">Closed On</span>
                          <span class="body-medium">${fy.post_time ? i18n.date.format(fy.post_time) : '—'}</span>
                        </div>
                        ${fy.closing_journal_entry_ref ? html`
                          <div style="display: flex; justify-content: space-between;">
                            <span class="body-medium">Closing Entry</span>
                            <span class="body-medium" style="color: var(--md-sys-color-primary);">
                              #${fy.closing_journal_entry_ref}
                            </span>
                          </div>
                        ` : nothing}
                      </div>
                    </div>
                  `}

                </div>
              ` : html`
                <p style="text-align: center; color: var(--md-sys-color-on-surface-variant);">No fiscal year selected</p>
              `}
            </div>
          </div>
        </dialog>

        <!-- Confirm Close Dialog -->
        <dialog ${confirmDialog} id="confirm-close-dialog" role="alertdialog" aria-labelledby="confirm-close-title">
          <div class="container">
            <material-symbols name="warning" style="color: var(--md-sys-color-error);"></material-symbols>
            <header>
              <h3 id="confirm-close-title">Close Fiscal Year?</h3>
            </header>
            <div class="content">
              <p>
                This action will:
              </p>
              <ul style="margin: 12px 0; padding-left: 24px;">
                <li>Create closing journal entries to zero out revenue and expense accounts</li>
                <li>Transfer net income to retained earnings</li>
                <li>Lock the fiscal year from further modifications</li>
              </ul>
              <p style="color: var(--md-sys-color-error); font-weight: 500;">
                This action cannot be undone.
              </p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  commandfor="confirm-close-dialog"
                  command="close"
                >Cancel</button>
              </li>
              <li>
                <button
                  role="button"
                  type="button"
                  @click=${handleCloseFiscalYear}
                >Close Fiscal Year</button>
              </li>
            </menu>
          </div>
        </dialog>

        <!-- Error Dialog -->
        <dialog ${errorAlertDialog} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>Error</h3>
            </header>
            <div class="content">
              <p>${state.closingError?.message}</p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  @click=${handleDismissErrorDialog}
                >Dismiss</button>
              </li>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('fiscal-year-closing-dialog', FiscalYearClosingDialogElement);
