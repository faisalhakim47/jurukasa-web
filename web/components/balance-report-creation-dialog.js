import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { useMounted } from '#web/hooks/use-mounted.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';

/**
 * Balance Report Creation Dialog Component
 * 
 * @fires balance-report-created - Fired when a balance report is successfully created. Detail: { reportId: number, reportTime: number }
 */
export class BalanceReportCreationDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);

    const dialog = useDialog(host);
    const errorAlertDialog = useElement(host, HTMLDialogElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      formState: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      formError: /** @type {Error | null} */ (null),
    });

    const defaultDateTime = reactive({
      value: '',
      isLoading: true,
    });

    /** @param {number} timestamp */
    function formatDateTimeInput(timestamp) {
      const now = new Date(timestamp);
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    useMounted(host, function loadDefaultDateTime() {
      try {
        defaultDateTime.value = formatDateTimeInput(Date.now());
        defaultDateTime.isLoading = false;
      }
      catch (error) {
        console.warn('Failed to get default datetime:', error);
        defaultDateTime.isLoading = false;
      }
    });

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
      event.preventDefault();

      const form = event.currentTarget;
      if (!(form instanceof HTMLFormElement)) return;

      try {
        state.formState = 'submitting';
        state.formError = null;

        const data = new FormData(form);
        const dateTimeStr = /** @type {string} */ (data.get('reportDateTime'));
        const name = /** @type {string} */ (data.get('name'))?.trim() || null;

        const reportTime = new Date(dateTimeStr).getTime();

        if (isNaN(reportTime) || reportTime <= 0) {
          state.formState = 'error';
          state.formError = new Error(t('financialReport', 'invalidDateTimeError'));
          await feedbackDelay();
          return;
        }

        const result = await database.sql`
          INSERT INTO balance_reports (report_time, report_type, name, create_time)
          VALUES (${reportTime}, 'Ad Hoc', ${name}, ${Date.now()})
          RETURNING id, report_time
        `;

        const reportId = Number(result.rows[0].id);
        const reportTimeValue = Number(result.rows[0].report_time);

        state.formState = 'success';
        await feedbackDelay();

        dialog.open = false;
        form.reset();

        host.dispatchEvent(new CustomEvent('balance-report-created', {
          detail: { reportId, reportTime: reportTimeValue },
          bubbles: true,
          composed: true,
        }));
      }
      catch (error) {
        state.formState = 'error';
        state.formError = error instanceof Error ? error : new Error(String(error));
        await feedbackDelay();
      }
      finally {
        state.formState = 'idle';
      }
    }

    function handleDismissErrorDialog() { state.formError = null; }

    useEffect(host, function syncErrorAlertDialogState() {
      if (state.formError instanceof Error) errorAlertDialog.value?.showModal();
      else errorAlertDialog.value?.close();
    });

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="balance-report-creation-dialog"
          name="${t('financialReport', 'generateReportDialogTitle')}"
          aria-labelledby="balance-report-creation-dialog-title"
        >
          <form class="container" @submit=${handleSubmit}>
            <header>
              <h2 id="balance-report-creation-dialog-title">${t('financialReport', 'generateReportDialogTitle')}</h2>
            </header>

            <div role="status" aria-live="polite" aria-busy="true">
              ${state.formState === 'submitting' ? html`<progress aria-label="${t('financialReport', 'generationProgressLabel')}"></progress>` : nothing}
            </div>

            <div class="content">
              ${defaultDateTime.isLoading ? html`
                <div role="status" aria-live="polite" aria-busy="true" style="padding: 32px; text-align: center;">
                  <div role="progressbar" class="linear indeterminate">
                    <div class="track"><div class="indicator"></div></div>
                  </div>
                  <p>${t('financialReport', 'loadingFormLabel')}</p>
                </div>
              ` : html`
                <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0px; max-width: 600px; margin: 0 auto;">

                  <!-- Report Name -->
                  <div class="outlined-text-field">
                    <div class="container">
                      <label for="report-name-input">${t('financialReport', 'reportNameLabel')}</label>
                      <input
                        id="report-name-input"
                        name="name"
                        type="text"
                        placeholder=" "
                        autocomplete="off"
                      />
                    </div>
                    <div class="supporting-text">${t('financialReport', 'reportNameHelperText')}</div>
                  </div>

                  <!-- Report Date Time -->
                  <div class="outlined-text-field">
                    <div class="container">
                      <label for="report-datetime-input">${t('financialReport', 'reportDateTimeLabel')}</label>
                      <input
                        id="report-datetime-input"
                        name="reportDateTime"
                        type="datetime-local"
                        placeholder=" "
                        required
                        value="${defaultDateTime.value}"
                      />
                    </div>
                    <div class="supporting-text">${t('financialReport', 'reportDateTimeHelperText')}</div>
                  </div>

                </div>
              `}
            </div>

            <menu>
              <button
                type="button"
                role="button"
                class="text"
                ?disabled=${state.formState !== 'idle'}
                commandfor="balance-report-creation-dialog"
                command="close"
              >${t('financialReport', 'closeDialogLabel')}</button>
              <button
                type="submit"
                role="button"
                class="filled"
                ?disabled=${defaultDateTime.isLoading || state.formState !== 'idle'}
              >
                <material-symbols name="save"></material-symbols>
                ${t('financialReport', 'generateReportActionLabel')}
              </button>
            </menu>
          </form>
        </dialog>

        <dialog ${errorAlertDialog} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>${t('financialReport', 'errorTitle')}</h3>
            </header>
            <div class="content">
              <p>${state.formError}</p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  @click=${handleDismissErrorDialog}
                >${t('financialReport', 'dismissLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('balance-report-creation-dialog', BalanceReportCreationDialogElement);
