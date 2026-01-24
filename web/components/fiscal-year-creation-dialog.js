import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { TimeContextElement } from '#web/contexts/time-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { useMounted } from '#web/hooks/use-mounted.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';

/**
 * Fiscal Year Creation Dialog Component
 * 
 * @fires fiscal-year-created - Fired when a fiscal year is successfully created. Detail: { beginTime: number, endTime: number }
 */
export class FiscalYearCreationDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const time = useContext(host, TimeContextElement);
    const t = useTranslator(host);

    const dialog = useDialog(host);
    const errorAlertDialog = useElement(host, HTMLDialogElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      formState: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      formError: /** @type {Error | null} */ (null),
    });

    const defaultDates = reactive({
      beginDate: '',
      endDate: '',
      isLoading: true,
    });

    /**
     * Format date to YYYY-MM-DD for input[type=date]
     * @param {Date} date
     * @returns {string}
     */
    function formatDateForInput(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    /**
     * Get default end date (end of current year based on begin date)
     * @param {string} beginDateStr
     * @returns {string}
     */
    function getDefaultEndDate(beginDateStr) {
      const beginDate = new Date(beginDateStr);
      // Default to one year minus one day from begin date
      const endDate = new Date(beginDate.getFullYear() + 1, beginDate.getMonth(), beginDate.getDate() - 1, 23, 59, 59, 999);
      return formatDateForInput(endDate);
    }

    useMounted(host, async function loadDefaultDates() {
      try {
        const result = await database.sql`
          SELECT MAX(end_time) as last_end_time FROM fiscal_years
        `;
        let beginDate;
        if (result.rows.length > 0 && result.rows[0].last_end_time !== null) {
          // Start from day after last fiscal year ended
          const lastEndTime = Number(result.rows[0].last_end_time);
          const nextDay = new Date(lastEndTime + 1);
          beginDate = formatDateForInput(nextDay);
        }
        else {
          // Default to start of current year
          const currentDate = time.currentDate();
          const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
          beginDate = formatDateForInput(startOfYear);
        }
        defaultDates.beginDate = beginDate;
        defaultDates.endDate = getDefaultEndDate(beginDate);
        defaultDates.isLoading = false;
      }
      catch (error) {
        console.warn('Failed to get default dates:', error);
        // Fallback to current year
        const currentDate = time.currentDate();
        const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
        defaultDates.beginDate = formatDateForInput(startOfYear);
        defaultDates.endDate = getDefaultEndDate(defaultDates.beginDate);
        defaultDates.isLoading = false;
      }
    });

    /** @param {Event} event */
    function handleBeginDateChange(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      const beginDateStr = event.currentTarget.value;
      const endDateInput = host.shadowRoot?.getElementById('end-date-input');
      if (endDateInput instanceof HTMLInputElement && beginDateStr) {
        endDateInput.value = getDefaultEndDate(beginDateStr);
        endDateInput.min = beginDateStr;
      }
    }

    /** @param {FocusEvent} event */
    async function validateDateRange(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);

      const form = event.currentTarget.closest('form');
      assertInstanceOf(HTMLFormElement, form);

      const beginDateInput = form.elements.namedItem('beginDate');
      const endDateInput = form.elements.namedItem('endDate');

      if (!(beginDateInput instanceof HTMLInputElement)) return;
      if (!(endDateInput instanceof HTMLInputElement)) return;

      beginDateInput.setCustomValidity('');
      endDateInput.setCustomValidity('');

      const beginDateStr = beginDateInput.value;
      const endDateStr = endDateInput.value;

      if (!beginDateStr || !endDateStr) return;

      const beginDate = new Date(beginDateStr);
      const endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);

      const beginTime = beginDate.getTime();
      const endTime = endDate.getTime();

      // Validate duration (30-400 days as per schema)
      const durationDays = (endTime - beginTime) / (24 * 60 * 60 * 1000);
      if (durationDays < 30) {
        endDateInput.setCustomValidity(t('fiscalYear', 'minDurationError'));
        return;
      }
      if (durationDays > 400) {
        endDateInput.setCustomValidity(t('fiscalYear', 'maxDurationError'));
        return;
      }

      // Check for overlapping fiscal years
      try {
        const result = await database.sql`
          SELECT 1 FROM fiscal_years
          WHERE (${beginTime} < end_time AND ${endTime} > begin_time)
          LIMIT 1
        `;
        if (result.rows.length > 0) {
          beginDateInput.setCustomValidity(t('fiscalYear', 'overlapError'));
        }
      }
      catch (error) {
        beginDateInput.setCustomValidity(t('fiscalYear', 'validationError'));
      }
    }

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
      event.preventDefault();
      assertInstanceOf(HTMLFormElement, event.currentTarget);
      const form = event.currentTarget;

      try {
        state.formState = 'submitting';
        state.formError = null;

        const data = new FormData(form);
        const name = /** @type {string} */ (data.get('name')).trim() || null;
        const beginDateStr = /** @type {string} */ (data.get('beginDate'));
        const endDateStr = /** @type {string} */ (data.get('endDate'));

        // Parse dates
        const beginDate = new Date(beginDateStr);
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);

        const beginTime = beginDate.getTime();
        const endTime = endDate.getTime();

        // Insert fiscal year
        await database.sql`
          INSERT INTO fiscal_years (begin_time, end_time, name)
          VALUES (${beginTime}, ${endTime}, ${name})
        `;

        state.formState = 'success';
        await feedbackDelay();

        // Close dialog and reset form first
        dialog.open = false;
        form.reset();

        // Then dispatch the event
        host.dispatchEvent(new CustomEvent('fiscal-year-created', {
          detail: { beginTime, endTime, name },
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
          id="fiscal-year-creation-dialog"
          class="full-screen"
          name="Create New Fiscal Year"
          aria-labelledby="fiscal-year-creation-dialog-title"
        >
          <form class="container" @submit=${handleSubmit}>
            <header>
              <h2 id="fiscal-year-creation-dialog-title">${t('fiscalYear', 'creationTitle')}</h2>
              <button
                role="button"
                type="button"
                class="text"
                aria-label="${t('fiscalYear', 'closeDialogLabel')}"
                commandfor="fiscal-year-creation-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              <button role="button" type="submit" name="action" ?disabled=${defaultDates.isLoading}>${t('fiscalYear', 'creationSubmitLabel')}</button>
            </header>

            <div class="content">
              ${state.formState !== 'idle' ? html`
                <div role="status" aria-live="polite" aria-busy="true">
                  <div role="progressbar" class="linear indeterminate">
                    <div class="track"><div class="indicator"></div></div>
                  </div>
                  <p>${state.formState === 'submitting' ? t('fiscalYear', 'creationLoadingLabel') : state.formState === 'success' ? t('fiscalYear', 'creationSuccessLabel') : ''}</p>
                </div>
              ` : nothing}

              ${defaultDates.isLoading ? html`
                <div role="status" aria-live="polite" aria-busy="true" style="padding: 32px; text-align: center;">
                  <div role="progressbar" class="linear indeterminate">
                    <div class="track"><div class="indicator"></div></div>
                  </div>
                  <p>${t('fiscalYear', 'loadingFormLabel')}</p>
                </div>
              ` : html`
                <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0px; max-width: 600px; margin: 0 auto;">

                  <!-- Fiscal Year Name -->
                  <div class="outlined-text-field">
                    <div class="container">
                      <label for="fiscal-year-name-input">${t('fiscalYear', 'nameLabel')}</label>
                      <input
                        id="fiscal-year-name-input"
                        name="name"
                        type="text"
                        placeholder=" "
                        autocomplete="off"
                      />
                    </div>
                    <div class="supporting-text">${t('fiscalYear', 'nameHelperText')}</div>
                  </div>

                  <!-- Begin Date -->
                  <div class="outlined-text-field">
                    <div class="container">
                      <label for="begin-date-input">${t('fiscalYear', 'beginDateLabel')}</label>
                      <input
                        id="begin-date-input"
                        name="beginDate"
                        type="date"
                        placeholder=" "
                        required
                        value="${defaultDates.beginDate}"
                        @change=${handleBeginDateChange}
                        @blur=${validateDateRange}
                      />
                    </div>
                    <div class="supporting-text">${t('fiscalYear', 'beginDateHelperText')}</div>
                  </div>

                  <!-- End Date -->
                  <div class="outlined-text-field">
                    <div class="container">
                      <label for="end-date-input">${t('fiscalYear', 'endDateLabel')}</label>
                      <input
                        id="end-date-input"
                        name="endDate"
                        type="date"
                        placeholder=" "
                        required
                        value="${defaultDates.endDate}"
                        min="${defaultDates.beginDate}"
                        @blur=${validateDateRange}
                      />
                    </div>
                    <div class="supporting-text">${t('fiscalYear', 'endDateHelperText')}</div>
                  </div>

                </div>
              `}
            </div>
          </form>
        </dialog>

        <dialog ${errorAlertDialog} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>${t('fiscalYear', 'errorTitle')}</h3>
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
                >${t('fiscalYear', 'dismissLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('fiscal-year-creation-dialog', FiscalYearCreationDialogElement);
