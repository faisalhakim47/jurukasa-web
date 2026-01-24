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
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';
import { when } from 'lit-html/directives/when.js';

/**
 * @typedef {object} FiscalYearDetail
 * @property {number} begin_time
 * @property {number} end_time
 * @property {string | null} name
 * @property {number | null} post_time
 * @property {number | null} closing_journal_entry_ref
 * @property {number | null} reversal_time
 * @property {number | null} reversal_journal_entry_ref
 */

/**
 * Fiscal Year Reversal Dialog Component
 * 
 * @fires fiscal-year-reversed - Fired when a fiscal year is successfully reversed. Detail: { beginTime: number }
 */
export class FiscalYearReversalDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);

    const dialog = useDialog(host);
    const confirmDialog = useElement(host, HTMLDialogElement);
    const errorAlertDialog = useElement(host, HTMLDialogElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      reversalState: /** @type {'idle' | 'reversing' | 'success' | 'error'} */ ('idle'),
      reversalError: /** @type {Error | null} */ (null),
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
            fy.post_time,
            fy.closing_journal_entry_ref,
            fy.reversal_time,
            fy.reversal_journal_entry_ref
          FROM fiscal_years fy
          WHERE fy.begin_time = ${beginTime}
        `;

        if (fyResult.rows.length === 0) {
          state.error = new Error(t('fiscalYear', 'noFiscalYearSelected'));
          state.isLoading = false;
          return;
        }

        const fyRow = fyResult.rows[0];

        state.fiscalYear = {
          begin_time: Number(fyRow.begin_time),
          end_time: Number(fyRow.end_time),
          name: fyRow.name ? String(fyRow.name) : null,
          post_time: fyRow.post_time ? Number(fyRow.post_time) : null,
          closing_journal_entry_ref: fyRow.closing_journal_entry_ref ? Number(fyRow.closing_journal_entry_ref) : null,
          reversal_time: fyRow.reversal_time ? Number(fyRow.reversal_time) : null,
          reversal_journal_entry_ref: fyRow.reversal_journal_entry_ref ? Number(fyRow.reversal_journal_entry_ref) : null,
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

    async function handleReverseFiscalYear() {
      if (state.fiscalYear === null) return;
      if (state.fiscalYear.post_time === null) return;
      if (state.fiscalYear.reversal_time !== null) return;

      try {
        state.reversalState = 'reversing';
        state.reversalError = null;

        if (confirmDialog.value instanceof HTMLDialogElement) {
          confirmDialog.value.close();
        }

        const beginTime = state.fiscalYear.begin_time;
        const now = Date.now();

        // Reverse fiscal year by setting reversal_time
        // This triggers the automated reversal entry creation via database trigger
        await database.sql`
          UPDATE fiscal_years
          SET reversal_time = ${now}
          WHERE begin_time = ${beginTime}
            AND reversal_time IS NULL
        `;

        state.reversalState = 'success';
        await feedbackDelay();

        host.dispatchEvent(new CustomEvent('fiscal-year-reversed', {
          detail: { beginTime },
          bubbles: true,
          composed: true,
        }));

        // Reload to show updated state
        await loadFiscalYearDetails();

        state.reversalState = 'idle';
      }
      catch (error) {
        state.reversalState = 'error';
        state.reversalError = error instanceof Error ? error : new Error(String(error));
        await feedbackDelay();
        state.reversalState = 'idle';
      }
    }

    function handleDismissErrorDialog() {
      state.reversalError = null;
    }

    useEffect(host, async function syncErrorAlertDialogState() {
      if (errorAlertDialog.value instanceof HTMLDialogElement) {
        if (state.reversalError instanceof Error) errorAlertDialog.value.showModal();
        else errorAlertDialog.value.close();
      }
    });

    useEffect(host, function renderDialog() {
      const fy = state.fiscalYear;
      const canReverse = fy !== null && fy.post_time !== null && fy.reversal_time === null;
      const isReversed = fy !== null && fy.reversal_time !== null;

      render(html`
        <dialog
          ${dialog.element}
          id="fiscal-year-reversal-dialog"
          class="full-screen"
          aria-labelledby="fiscal-year-reversal-dialog-title"
        >
          <div class="container">
            <header>
              <hgroup>
                <h2 id="fiscal-year-reversal-dialog-title">
                  ${fy?.name || t('fiscalYear', 'reversalTitle')}
                </h2>
              </hgroup>
              <button
                role="button"
                type="button"
                class="text"
                aria-label="${t('fiscalYear', 'closeDialogLabel')}"
                commandfor="fiscal-year-reversal-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              ${canReverse ? html`
                <button
                  role="button"
                  type="button"
                  ?disabled=${state.reversalState !== 'idle'}
                  @click=${handleOpenConfirmDialog}
                >
                  ${state.reversalState === 'reversing' ? t('fiscalYear', 'reversalLoadingLabel') : state.reversalState === 'success' ? t('fiscalYear', 'reversalSuccessLabel') : t('fiscalYear', 'reversalSubmitLabel')}
                </button>
              ` : nothing}
            </header>

            <div class="content">
              ${state.isLoading ? html`
                <div
                  role="status"
                  aria-label="${t('fiscalYear', 'loadingDetailsLabel')}"
                  style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 16px;
                    min-height: 300px;
                  "
                >
                  <div role="progressbar" class="linear indeterminate" style="width: 200px;">
                    <div class="track">
                      <div class="indicator"></div>
                    </div>
                  </div>
                  <p>${t('fiscalYear', 'loadingDetailsLabel')}</p>
                </div>
              ` : nothing}

              ${state.error instanceof Error ? html`
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
                  "
                >
                  <material-symbols name="error" size="48"></material-symbols>
                  <h3 class="title-medium">${t('fiscalYear', 'loadFiscalYearErrorTitle')}</h3>
                  <p style="color: var(--md-sys-color-on-surface-variant);">${state.error.message}</p>
                </div>
              ` : nothing}

              ${fy !== null ? html`
                <div style="display: flex; flex-direction: column; gap: 16px; max-width: 800px; margin: 0 auto;">
                  <!-- Status Badge -->
                  <div style="display: flex; justify-content: center; margin-bottom: 8px;">
                    <span
                      class="label-large"
                      style="
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        padding: 8px 16px;
                        border-radius: var(--md-sys-shape-corner-medium);
                        ${isReversed
                          ? 'background-color: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container);'
                          : fy.post_time !== null
                          ? 'background-color: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container);'
                          : 'background-color: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container);'}
                      "
                    >
                      ${when(isReversed, () => html`<material-symbols name="history" size="20" aria-hidden="true"></material-symbols>`)}
                      ${when(!isReversed && fy.post_time, () => html`<material-symbols name="lock" size="20" aria-hidden="true"></material-symbols>`)}
                      ${when(!isReversed && !fy.post_time, () => html`<material-symbols name="lock_open" size="20" aria-hidden="true"></material-symbols>`)}
                      ${isReversed ? t('fiscalYear', 'statusReversed') : fy.post_time !== null ? t('fiscalYear', 'statusClosed') : t('fiscalYear', 'statusOpen')}
                    </span>
                  </div>

                  <!-- Period Info -->
                  <div class="card outlined" style="padding: 16px;">
                    <h3 class="title-medium" style="margin-bottom: 12px;">${t('fiscalYear', 'periodSectionTitle')}</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                      <div>
                        <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('fiscalYear', 'periodBeginDateLabel')}</p>
                        <p class="body-large">${i18n.date.format(fy.begin_time)}</p>
                      </div>
                      <div>
                        <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('fiscalYear', 'periodEndDateLabel')}</p>
                        <p class="body-large">${i18n.date.format(fy.end_time)}</p>
                      </div>
                    </div>
                  </div>

                  ${fy.post_time !== null ? html`
                    <!-- Closing Details -->
                    <div class="card outlined" style="padding: 16px;">
                      <h3 class="title-medium" style="margin-bottom: 12px;">${t('fiscalYear', 'closingDetailsSectionTitle')}</h3>
                      <div style="display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; justify-content: space-between;">
                          <span class="body-medium">${t('fiscalYear', 'closedOnLabel')}</span>
                          <span class="body-medium">${fy.post_time ? i18n.date.format(fy.post_time) : '—'}</span>
                        </div>
                        ${fy.closing_journal_entry_ref ? html`
                          <div style="display: flex; justify-content: space-between;">
                            <span class="body-medium">${t('fiscalYear', 'closingEntryLabel')}</span>
                            <span class="body-medium" style="color: var(--md-sys-color-primary);">
                              #${fy.closing_journal_entry_ref}
                            </span>
                          </div>
                        ` : nothing}
                      </div>
                    </div>
                  ` : nothing}

                  ${isReversed ? html`
                    <!-- Reversal Details -->
                    <div class="card outlined" style="padding: 16px;">
                      <h3 class="title-medium" style="margin-bottom: 12px;">${t('fiscalYear', 'reversalDetailsSectionTitle')}</h3>
                      <div style="display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; justify-content: space-between;">
                          <span class="body-medium">${t('fiscalYear', 'reversedOnLabel')}</span>
                          <span class="body-medium">${fy.reversal_time ? i18n.date.format(fy.reversal_time) : '—'}</span>
                        </div>
                        ${fy.reversal_journal_entry_ref ? html`
                          <div style="display: flex; justify-content: space-between;">
                            <span class="body-medium">${t('fiscalYear', 'reversalEntryLabel')}</span>
                            <span class="body-medium" style="color: var(--md-sys-color-primary);">
                              #${fy.reversal_journal_entry_ref}
                            </span>
                          </div>
                        ` : nothing}
                      </div>
                    </div>
                  ` : nothing}

                  ${canReverse ? html`
                    <!-- Reversal Warning -->
                    <div
                      role="alert"
                      class="card outlined"
                      style="
                        padding: 16px;
                        border-color: var(--md-sys-color-error);
                        background-color: var(--md-sys-color-error-container);
                      "
                    >
                      <div style="display: flex; align-items: start; gap: 12px;">
                        <material-symbols name="warning" size="24" style="color: var(--md-sys-color-error);"></material-symbols>
                        <div>
                          <h3 class="title-small" style="margin-bottom: 8px; color: var(--md-sys-color-on-error-container);">
                            ${t('fiscalYear', 'reversalWarningTitle')}
                          </h3>
                          <p class="body-medium" style="color: var(--md-sys-color-on-error-container); margin-bottom: 12px;">
                            ${t('fiscalYear', 'reversalWarningMessage')}
                          </p>
                          <ul style="margin: 0; padding-left: 24px; color: var(--md-sys-color-on-error-container);">
                            <li>${t('fiscalYear', 'reversalWarningPoint1')}</li>
                            <li>${t('fiscalYear', 'reversalWarningPoint2')}</li>
                            <li>${t('fiscalYear', 'reversalWarningPoint3')}</li>
                          </ul>
                          <p class="body-medium" style="color: var(--md-sys-color-error); font-weight: 500; margin-top: 12px;">
                            ${t('fiscalYear', 'reversalWarningNote')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ` : nothing}

                  ${!canReverse && !isReversed && fy.post_time !== null ? html`
                    <!-- Cannot Reverse Notice -->
                    <div
                      role="alert"
                      class="card outlined"
                      style="padding: 16px;"
                    >
                      <div style="display: flex; align-items: start; gap: 12px;">
                        <material-symbols name="info" size="24" style="color: var(--md-sys-color-primary);"></material-symbols>
                        <div>
                          <p class="body-medium">
                            ${t('fiscalYear', 'cannotReverseMessage')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ` : nothing}
                </div>
              ` : html`
                <p style="text-align: center; color: var(--md-sys-color-on-surface-variant);">${t('fiscalYear', 'noFiscalYearSelected')}</p>
              `}
            </div>
          </div>
        </dialog>

        <!-- Confirm Reversal Dialog -->
        <dialog ${confirmDialog} id="confirm-reversal-dialog" role="alertdialog" aria-labelledby="confirm-reversal-title">
          <div class="container">
            <material-symbols name="warning" style="color: var(--md-sys-color-error);"></material-symbols>
            <header>
              <h3 id="confirm-reversal-title">${t('fiscalYear', 'confirmReversalTitle')}</h3>
            </header>
            <div class="content">
              <p>
                ${t('fiscalYear', 'confirmReversalMessage')}
              </p>
              <ul style="margin: 12px 0; padding-left: 24px;">
                <li>${t('fiscalYear', 'confirmReversalPoint1')}</li>
                <li>${t('fiscalYear', 'confirmReversalPoint2')}</li>
                <li>${t('fiscalYear', 'confirmReversalPoint3')}</li>
              </ul>
              <p style="color: var(--md-sys-color-error); font-weight: 500;">
                ${t('fiscalYear', 'confirmReversalWarning')}
              </p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  commandfor="confirm-reversal-dialog"
                  command="close"
                >${t('fiscalYear', 'cancelLabel')}</button>
              </li>
              <li>
                <button
                  role="button"
                  type="button"
                  class="filled error"
                  @click=${handleReverseFiscalYear}
                >${t('fiscalYear', 'confirmReversalActionLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>

        <!-- Error Dialog -->
        <dialog ${errorAlertDialog} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>${t('fiscalYear', 'errorTitle')}</h3>
            </header>
            <div class="content">
              <p>${state.reversalError?.message}</p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  @click=${handleDismissErrorDialog}
                >${t('fiscalYear', 'dismissLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('fiscal-year-reversal-dialog', FiscalYearReversalDialogElement);
