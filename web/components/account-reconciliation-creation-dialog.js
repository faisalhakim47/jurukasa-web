import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { useWatch } from '#web/hooks/use-watch.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { readValue } from '#web/directives/read-value.js';

import '#web/components/material-symbols.js';
import '#web/components/account-selector-dialog.js';

/**
 * Account Reconciliation Creation Dialog Component
 * 
 * @fires account-reconciliation-created - Fired when a reconciliation session is successfully created. Detail: { reconciliationId: number }
 */
export class AccountReconciliationCreationDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const t = useTranslator(host);

    const errorAlertDialog = useElement(host, HTMLDialogElement);
    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const formElement = useElement(host, HTMLFormElement);
    const form = reactive({
      state: /** @type {'idle' | 'submitting' | 'calculating' | 'success' | 'error'} */ ('idle'),
      error: /** @type {Error | null} */ (null),

      // Fields
      accountCode: /** @type {number | null} */ (null),
      accountName: /** @type {string} */ (''),
      statementBeginTime: /** @type {string} */ (''), // YYYY-MM-DD
      statementEndTime: /** @type {string} */ (''), // YYYY-MM-DD
      statementReference: /** @type {string} */ (''),
      statementOpeningBalance: /** @type {string} */ ('0'),
      statementClosingBalance: /** @type {string} */ ('0'),
      note: /** @type {string} */ (''),

      // Calculated Internal Values
      internalOpeningBalance: /** @type {number} */ (0),
      internalClosingBalance: /** @type {number} */ (0),
      hasCalculatedBalances: false,
      currencyDecimals: 0,
    });

    useEffect(host, async function loadConfig() {
      try {
        const result = await database.sql`SELECT value FROM config WHERE key = 'Currency Decimals'`;
        const decimals = Number(result.rows[0]?.value ?? 0);
        form.currencyDecimals = Number.isInteger(decimals) && decimals >= 0 ? decimals : 0;
      }
      catch (error) {
        console.trace('Failed to load currency config:', error);
      }
    });

    /**
     * @param {number} accountCode
     * @param {string} beginDate
     * @param {string} endDate
     */
    async function calculateInternalBalances(accountCode, beginDate, endDate) {
      if (!accountCode || !beginDate || !endDate) {
        form.internalOpeningBalance = 0;
        form.internalClosingBalance = 0;
        form.hasCalculatedBalances = false;
        return;
      }

      try {
        form.state = 'calculating';
        const beginTime = new Date(beginDate).getTime();
        const endTime = new Date(endDate).getTime();

        // Get account normal balance
        const accountResult = await database.sql`
          SELECT normal_balance FROM accounts WHERE account_code = ${accountCode}
        `;
        if (accountResult.rows.length === 0) throw new Error('Account not found');
        const normalBalance = Number(accountResult.rows[0].normal_balance);

        // Calculate Opening Balance (entries <= beginTime)
        // Schema says statement_begin_time is exclusive for the period
        // So opening balance should be balance AT beginTime.
        const openingResult = await database.sql`
          SELECT SUM(
            CASE ${normalBalance}
              WHEN 0 THEN debit - credit
              WHEN 1 THEN credit - debit
            END
          ) as balance
          FROM journal_entry_lines jel
          JOIN journal_entries je ON je.ref = jel.journal_entry_ref
          WHERE jel.account_code = ${accountCode}
            AND je.post_time IS NOT NULL
            AND je.entry_time <= ${beginTime}
        `;

        // Calculate Closing Balance (entries <= endTime)
        const closingResult = await database.sql`
          SELECT SUM(
            CASE ${normalBalance}
              WHEN 0 THEN debit - credit
              WHEN 1 THEN credit - debit
            END
          ) as balance
          FROM journal_entry_lines jel
          JOIN journal_entries je ON je.ref = jel.journal_entry_ref
          WHERE jel.account_code = ${accountCode}
            AND je.post_time IS NOT NULL
            AND je.entry_time <= ${endTime}
        `;

        form.internalOpeningBalance = Number(openingResult.rows[0]?.balance ?? 0);
        form.internalClosingBalance = Number(closingResult.rows[0]?.balance ?? 0);
        form.hasCalculatedBalances = true;
        form.state = 'idle';
      }
      catch (error) {
        console.error('Error calculating balances:', error);
        form.state = 'idle'; // Recover to idle but maybe show warning?
      }
    }

    /**
     * Trigger balance calculation if all required fields are present
     */
    function tryCalculateBalances() {
      if (form.accountCode && form.statementBeginTime && form.statementEndTime) {
        calculateInternalBalances(
          form.accountCode,
          form.statementBeginTime,
          form.statementEndTime
        );
      }
    }

    /** @param {CustomEvent} event */
    function handleAccountSelected(event) {
      form.accountCode = event.detail.accountCode;
      form.accountName = event.detail.accountName;
      tryCalculateBalances();
    }

    /** @param {Event} event */
    function handleDateChange(event) {
      // Just let the model update through input binding if we had it, but we use native events
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      if (event.currentTarget.name === 'statementBeginTime') {
        form.statementBeginTime = event.currentTarget.value;
      } else if (event.currentTarget.name === 'statementEndTime') {
        form.statementEndTime = event.currentTarget.value;
      }
      tryCalculateBalances();
    }

    /** @param {Event} event */
    function handleNoteInput(event) {
      assertInstanceOf(HTMLTextAreaElement, event.currentTarget);
      form.note = event.currentTarget.value;
    }

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
      event.preventDefault();
      if (form.state === 'submitting') return;

      const tx = await database.transaction('write');

      try {
        if (!form.accountCode) throw new Error(t('reconciliation', 'accountRequiredError'));
        if (!form.statementBeginTime) throw new Error(t('reconciliation', 'beginDateRequiredError'));
        if (!form.statementEndTime) throw new Error(t('reconciliation', 'endDateRequiredError'));

        const beginTime = new Date(form.statementBeginTime).getTime();
        const endTime = new Date(form.statementEndTime).getTime();

        if (beginTime >= endTime) {
          throw new Error(t('reconciliation', 'periodInvalidError'));
        }

        form.state = 'submitting';
        form.error = null;

        const multiplier = Math.pow(10, form.currencyDecimals);
        const sOpen = Math.round(parseFloat(form.statementOpeningBalance) * multiplier);
        const sClose = Math.round(parseFloat(form.statementClosingBalance) * multiplier);

        const result = await tx.sql`
          INSERT INTO reconciliation_sessions (
            account_code,
            reconciliation_time,
            statement_begin_time,
            statement_end_time,
            statement_reference,
            statement_opening_balance,
            statement_closing_balance,
            internal_opening_balance,
            internal_closing_balance,
            note,
            create_time
          ) VALUES (
            ${form.accountCode},
            ${Date.now()},
            ${beginTime},
            ${endTime},
            ${form.statementReference || null},
            ${sOpen},
            ${sClose},
            ${form.internalOpeningBalance},
            ${form.internalClosingBalance},
            ${form.note || null},
            ${Date.now()}
          ) RETURNING id
        `;

        await tx.commit();

        const newId = result.rows[0].id;

        host.dispatchEvent(new CustomEvent('account-reconciliation-created', {
          bubbles: true,
          composed: true,
          detail: { reconciliationId: newId },
        }));

        form.state = 'success';
        dialog.open = false;

      }
      catch (error) {
        await tx.rollback();
        form.state = 'error';
        form.error = error instanceof Error ? error : new Error(String(error));
        errorAlertDialog.value?.showModal();
      }
    }

    useWatch(host, dialog, 'open', function onDialogOpenChange(isOpen) {
      if (isOpen) {
        form.state = 'idle';
        form.error = null;
        form.accountCode = null;
        form.accountName = '';
        form.statementBeginTime = '';
        form.statementEndTime = '';
        form.statementReference = '';
        form.statementOpeningBalance = '0';
        form.statementClosingBalance = '0';
        form.note = '';
        form.internalOpeningBalance = 0;
        form.internalClosingBalance = 0;
        form.hasCalculatedBalances = false;
        formElement.value?.reset();
      }
    });

    /** @param {Event} event */
    function handleDialogClose(event) {
      if (form.state === 'submitting') {
        event.preventDefault();
      }
    }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="account-reconciliation-creation-dialog"
          class="full-screen"
          role="dialog"
          aria-labelledby="reconciliation-creation-title"
          @close=${handleDialogClose}
        >
          <form
            ${formElement}
            method="dialog"
            class="container"
            @submit=${handleSubmit}
          >
            <header>
              <hgroup>
                <h2 id="reconciliation-creation-title">${t('reconciliation', 'createReconciliationTitle')}</h2>
              </hgroup>
              <button
                role="button"
                type="button"
                class="text"
                commandfor="account-reconciliation-creation-dialog"
                command="close"
                aria-label="${t('reconciliation', 'closeButtonLabel')}"
              ><material-symbols name="close"></material-symbols></button>
              <button
                role="button"
                type="submit"
                class="filled"
                ?disabled=${!form.accountCode || !form.statementBeginTime || !form.statementEndTime || form.state === 'submitting'}
              >
                ${form.state === 'submitting' ? html`
                  <div role="progressbar" class="circular indeterminate extra-small"></div>
                ` : nothing}
                ${t('reconciliation', 'createButtonLabel')}
              </button>
            </header>

            <div class="content">
              <div style="max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px;">
                
                <!-- Account Selection -->
                 
                <section>
                  <h3 class="title-medium" style="margin-bottom: 16px;">${t('reconciliation', 'accountSectionTitle')}</h3>
                  <div style="display: flex; gap: 12px; align-items: flex-end;">
                    <div class="outlined-text-field">
                      <div class="container">
                        <label for="account-input">${t('reconciliation', 'accountLabel')}</label>
                        <input
                          id="account-input"
                          type="button"
                          readonly
                          required
                          placeholder=" "
                          value="${form.accountName ? `${form.accountCode} - ${form.accountName}` : ''}"
                          commandfor="account-selector-dialog"
                          command="--open"
                        />
                        ${form.accountCode ? html`
                          <button
                            type="button"
                            class="trailing-icon"
                            aria-label="${t('reconciliation', 'accountLabel')}"
                          ><material-symbols name="close"></material-symbols></button>
                        ` : html`
                          <button
                            type="button"
                            class="trailing-icon"
                            commandfor="account-selector-dialog"
                            command="--open"
                            aria-label="${t('reconciliation', 'selectAccountButtonLabel')}"
                          ><material-symbols name="search"></material-symbols></button>
                        `}
                      </div>
                    </div>
                  </div>
                </section>

                <!-- Period -->
                <section>
                  <h3 class="title-medium" style="margin-bottom: 16px;">${t('reconciliation', 'periodSectionTitle')}</h3>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="outlined-text-field">
                      <div class="container">
                        <label for="statement-begin-date-input">${t('reconciliation', 'beginDateLabel')}</label>
                        <input
                          id="statement-begin-date-input"
                          name="statementBeginTime"
                          type="date"
                          required
                          value="${form.statementBeginTime}"
                          @change=${handleDateChange}
                        />
                      </div>
                    </div>
                    <div class="outlined-text-field">
                      <div class="container">
                        <label for="statement-end-date-input">${t('reconciliation', 'endDateLabel')}</label>
                        <input
                          id="statement-end-date-input"
                          name="statementEndTime"
                          type="date"
                          required
                          value="${form.statementEndTime}"
                          @change=${handleDateChange}
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <!-- Comparison (Internal vs Statement) -->
                ${form.hasCalculatedBalances ? html`
                  <div style="
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                    padding: 16px;
                    background-color: var(--md-sys-color-surface-container);
                    border-radius: 12px;
                  ">
                    <!-- Internal Record -->
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                      <h4 class="title-small" style="color: var(--md-sys-color-primary);">
                        ${t('reconciliation', 'internalRecordTitle')}
                      </h4>
                      
                      <div class="outlined-text-field" style="--md-sys-density: -2;">
                        <div class="container">
                          <label for="internal-opening-balance-input">${t('reconciliation', 'internalOpeningBalanceLabel')}</label>
                          <input id="internal-opening-balance-input" type="text" readonly value="${form.internalOpeningBalance}" />
                        </div>
                      </div>

                      <div class="outlined-text-field" style="--md-sys-density: -2;">
                        <div class="container">
                          <label for="internal-closing-balance-input">${t('reconciliation', 'internalClosingBalanceLabel')}</label>
                          <input id="internal-closing-balance-input" type="text" readonly value="${form.internalClosingBalance}" />
                        </div>
                      </div>
                    </div>

                    <!-- Statement Record -->
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                      <h4 class="title-small" style="color: var(--md-sys-color-tertiary);">
                        ${t('reconciliation', 'statementRecordTitle')}
                      </h4>

                      <div class="outlined-text-field" style="--md-sys-density: -2;">
                        <div class="container">
                          <label for="statement-opening-balance-input">${t('reconciliation', 'statementOpeningBalanceLabel')}</label>
                          <input
                            id="statement-opening-balance-input"
                            name="statementOpeningBalance"
                            type="number"
                            inputmode="decimal"
                            step="${form.currencyDecimals > 0 ? Array(form.currencyDecimals).fill(0).map((_, i) => i === 0 ? '.' : '0').join('') + '1' : '1'}"
                            required
                            value="${form.statementOpeningBalance}"
                            ${readValue(form, 'statementOpeningBalance')}
                          />
                        </div>
                      </div>

                      <div class="outlined-text-field" style="--md-sys-density: -2;">
                        <div class="container">
                          <label for="statement-closing-balance-input">${t('reconciliation', 'statementClosingBalanceLabel')}</label>
                          <input
                            id="statement-closing-balance-input"
                            name="statementClosingBalance"
                            type="number"
                            inputmode="decimal"
                            step="${form.currencyDecimals > 0 ? Array(form.currencyDecimals).fill(0).map((_, i) => i === 0 ? '.' : '0').join('') + '1' : '1'}"
                            required
                            value="${form.statementClosingBalance}"
                            ${readValue(form, 'statementClosingBalance')}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ` : nothing}

                <!-- Additional Info -->
                <section>
                   <h3 class="title-medium" style="margin-bottom: 16px;">${t('reconciliation', 'detailsSectionTitle')}</h3>
                   <div style="display: flex; flex-direction: column; gap: 16px;">
                      <div class="outlined-text-field">
                        <div class="container">
                           <label>${t('reconciliation', 'statementReferenceLabel')}</label>
                          <input
                            name="statementReference"
                            type="text"
                            placeholder="e.g. Bank Statement Jan 2026"
                            value="${form.statementReference}"
                            ${readValue(form, 'statementReference')}
                          />
                        </div>
                      </div>

                      <div class="outlined-text-field">
                        <div class="container">
                          <label>${t('reconciliation', 'noteLabel')}</label>
                          <textarea
                            name="note"
                            rows="3"
                            placeholder=" "
                            value="${form.note}"
                            @input=${handleNoteInput}
                          ></textarea>
                        </div>
                      </div>
                   </div>
                </section>
                
              </div>
            </div>
          </form>
        </dialog>

        <!-- Nested Account Selector -->
        <account-selector-dialog
          id="account-selector-dialog"
          @account-select=${handleAccountSelected}
        ></account-selector-dialog>

        <!-- Error Alert -->
        <dialog
          ${errorAlertDialog}
          role="alertdialog"
          id="reconciliation-creation-error-dialog"
          aria-labelledby="reconciliation-creation-error-title"
        >
          <div class="container">
            <material-symbols name="error" style="color: var(--md-sys-color-error);"></material-symbols>
            <header>
              <hgroup>
                <h3 id="reconciliation-creation-error-title">${t('reconciliation', 'errorTitle')}</h3>
              </hgroup>
            </header>
            <div class="content">
              <p>${form.error?.message}</p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  class="text"
                  commandfor="reconciliation-creation-error-dialog"
                  command="close"
                >${t('reconciliation', 'dismissButtonLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('account-reconciliation-creation-dialog', AccountReconciliationCreationDialogElement);
