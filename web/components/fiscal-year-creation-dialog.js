import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { TimeContextElement } from '#web/contexts/time-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useMounted } from '#web/hooks/use-mounted.js';
import { useRender } from '#web/hooks/use-render.js';
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

    const dialog = useDialog(host);
    const errorAlertDialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const form = reactive({
      state: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      error: /** @type {Error | null} */ (null),
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
        endDateInput.setCustomValidity('Fiscal year must be at least 30 days');
        return;
      }
      if (durationDays > 400) {
        endDateInput.setCustomValidity('Fiscal year cannot exceed 400 days');
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
          beginDateInput.setCustomValidity('Fiscal year periods cannot overlap with existing fiscal years');
        }
      }
      catch (error) {
        beginDateInput.setCustomValidity('Error validating date range');
      }
    }

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
      event.preventDefault();
      assertInstanceOf(HTMLFormElement, event.currentTarget);

      const formElement = event.currentTarget;

      try {
        form.state = 'submitting';
        form.error = null;

        const data = new FormData(formElement);
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

        form.state = 'success';
        await feedbackDelay();

        // Close dialog and reset form first
        dialog.open = false;
        formElement.reset();

        // Then dispatch the event
        host.dispatchEvent(new CustomEvent('fiscal-year-created', {
          detail: { beginTime, endTime, name },
          bubbles: true,
          composed: true,
        }));
      }
      catch (error) {
        form.state = 'error';
        form.error = error instanceof Error ? error : new Error(String(error));
        await feedbackDelay();
      }
      finally {
        form.state = 'idle';
      }
    }

    function handleDismissErrorDialog() { form.error = null; }

    useEffect(host, function syncErrorAlertDialogState() {
      errorAlertDialog.open = form.error instanceof Error;
    });

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="fiscal-year-creation-dialog"
          class="full-screen"
          aria-labelledby="fiscal-year-creation-dialog-title"
        >
          <form class="container" @submit=${handleSubmit}>
            <header>
              <h2 id="fiscal-year-creation-dialog-title">Create Fiscal Year</h2>
              <button
                role="button"
                type="button"
                class="text"
                aria-label="Close dialog"
                commandfor="fiscal-year-creation-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              <button role="button" type="submit" name="action" ?disabled=${defaultDates.isLoading}>Create</button>
            </header>

            <div class="content">
              ${form.state !== 'idle' ? html`
                <div role="status" aria-live="polite" aria-busy="true">
                  <div role="progressbar" class="linear indeterminate">
                    <div class="track"><div class="indicator"></div></div>
                  </div>
                  <p>${form.state === 'submitting' ? 'Creating fiscal year...' : form.state === 'success' ? 'Fiscal year created!' : ''}</p>
                </div>
              ` : nothing}

              ${defaultDates.isLoading ? html`
                <div role="status" aria-live="polite" aria-busy="true" style="padding: 32px; text-align: center;">
                  <div role="progressbar" class="linear indeterminate">
                    <div class="track"><div class="indicator"></div></div>
                  </div>
                  <p>Loading form...</p>
                </div>
              ` : html`
                <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0px; max-width: 600px; margin: 0 auto;">

                  <!-- Fiscal Year Name -->
                  <div class="outlined-text-field">
                    <div class="container">
                      <label for="fiscal-year-name-input">Name (Optional)</label>
                      <input
                        id="fiscal-year-name-input"
                        name="name"
                        type="text"
                        placeholder=" "
                        autocomplete="off"
                      />
                    </div>
                    <div class="supporting-text">e.g., "FY 2025" or "Fiscal Year 2025"</div>
                  </div>

                  <!-- Begin Date -->
                  <div class="outlined-text-field">
                    <div class="container">
                      <label for="begin-date-input">Begin Date</label>
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
                    <div class="supporting-text">First day of the fiscal year</div>
                  </div>

                  <!-- End Date -->
                  <div class="outlined-text-field">
                    <div class="container">
                      <label for="end-date-input">End Date</label>
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
                    <div class="supporting-text">Last day of the fiscal year (30-400 days from begin date)</div>
                  </div>

                </div>
              `}
            </div>
          </form>
        </dialog>

        <dialog ${errorAlertDialog.element} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>Error</h3>
            </header>
            <div class="content">
              <p>${form.error}</p>
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

defineWebComponent('fiscal-year-creation-dialog', FiscalYearCreationDialogElement);
