import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';

import { defineWebComponent } from '#web/component.js';
import { readValue } from '#web/directives/read-value.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { TimeContextElement } from '#web/contexts/time-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { useWatch } from '#web/hooks/use-watch.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';
import '#web/components/account-selector-dialog.js';

/**
 * @typedef {object} CashAccountOption
 * @property {number} account_code
 * @property {string} name
 * @property {number} balance
 */

/**
 * Cash Count Creation Dialog Component
 * 
 * @fires cash-count-created - Fired when a cash count is successfully created. Detail: { countTime: number }
 */
export class CashCountCreationDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const time = useContext(host, TimeContextElement);
    const t = useTranslator(host);

    const errorAlertDialog = useElement(host, HTMLDialogElement);
    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const formElement = useElement(host, HTMLFormElement);
    const form = reactive({
      state: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      error: /** @type {Error | null} */ (null),
      accountCode: /** @type {number | null} */ (null),
      accountName: /** @type {string | null} */ (null),
      accountBalance: /** @type {number | null} */ (null),
      countedAmount: '',
      note: '',
      countTime: '',
    });

    const state = reactive({
      cashAccounts: /** @type {CashAccountOption[]} */ ([]),
      isLoadingAccounts: false,
    });

    async function loadCashAccounts() {
      try {
        state.isLoadingAccounts = true;
        const result = await database.sql`
          SELECT
            a.account_code,
            a.name,
            a.balance
          FROM accounts a
          JOIN account_tags at ON at.account_code = a.account_code
          WHERE at.tag = 'Cash Flow - Cash Equivalents'
            AND a.is_posting_account = 1
            AND a.is_active = 1
          ORDER BY a.account_code
        `;

        state.cashAccounts = result.rows.map(function rowToCashAccount(row) {
          return /** @type {CashAccountOption} */ ({
            account_code: Number(row.account_code),
            name: String(row.name),
            balance: Number(row.balance),
          });
        });
      }
      catch (error) {
        console.error('Error loading cash accounts:', error);
      }
      finally {
        state.isLoadingAccounts = false;
      }
    }

    /** @param {Event} event */
    function handleAccountSelect(event) {
      const target = event.currentTarget;
      assertInstanceOf(HTMLElement, target);

      const accountCode = Number(target.dataset.accountCode);
      const accountName = String(target.dataset.accountName);
      const accountBalance = Number(target.dataset.accountBalance);

      form.accountCode = accountCode;
      form.accountName = accountName;
      form.accountBalance = accountBalance;
    }

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
      event.preventDefault();

      if (form.state === 'submitting') return;

      assertInstanceOf(HTMLFormElement, event.currentTarget);
      const formData = new FormData(event.currentTarget);

      const accountCode = Number(formData.get('accountCode'));
      const countedAmountStr = String(formData.get('countedAmount') || '0');
      const countedAmount = parseInt(countedAmountStr, 10);
      const note = String(formData.get('note') || '');
      const countTimeStr = String(formData.get('countTime') || '');

      try {
        form.state = 'submitting';
        form.error = null;

        let countTime;
        if (countTimeStr) {
          const parsedDate = new Date(countTimeStr);
          if (isNaN(parsedDate.getTime())) {
            throw new Error(t('reconciliation', 'invalidCountTimeError'));
          }
          countTime = parsedDate.getTime();
        }
        else {
          countTime = time.now * 1000; // Convert seconds to milliseconds
        }

        const draftCheck = await database.sql`
          SELECT COUNT(*) as count
          FROM reconciliation_sessions
          WHERE account_code = ${accountCode}
            AND complete_time IS NULL
        `;

        if (Number(draftCheck.rows[0].count) > 0) {
          throw new Error(t('reconciliation', 'draftReconciliationExistsError'));
        }

        await database.sql`
          INSERT INTO cash_counts (account_code, count_time, counted_amount, note, create_time)
          VALUES (${accountCode}, ${countTime}, ${countedAmount}, ${note || null}, ${time.now * 1000})
        `;

        form.state = 'success';
        await feedbackDelay();

        host.dispatchEvent(new CustomEvent('cash-count-created', {
          bubbles: true,
          composed: true,
          detail: { countTime },
        }));

        dialog.open = false;
      }
      catch (error) {
        form.state = 'error';
        form.error = error instanceof Error ? error : new Error(String(error));
        errorAlertDialog.value?.showModal();
      }
    }

    useWatch(host, dialog, 'open', function onDialogOpenChange(isOpen) {
      if (isOpen) {
        form.state = 'idle';
        form.error = null;
        form.countTime = time.currentDate().toISOString().slice(0, 16);
        formElement.value?.reset();
        loadCashAccounts();
      }
    });

    /** @param {Event} event */
    function handleDialogClose(event) {
      if (form.state === 'submitting') {
        event.preventDefault();
        return;
      }
    }

    function renderCashCountNotice() {
      if (typeof form.accountCode === 'number') {
        const counted = parseInt(form.countedAmount, 10) || 0;
        const system = form.accountBalance || 0;
        const discrepancy = counted - system;

        const isBalanced = discrepancy === 0;
        const isShortage = discrepancy < 0;

        if (isBalanced) {
          var backgroundColor = 'var(--md-sys-color-primary-container)';
          var textColor = 'var(--md-sys-color-on-primary-container)';
          var iconName = 'check_circle';
          var labelText = t('reconciliation', 'balancedLabel');
          var amountText = '';
          var messageText = t('reconciliation', 'cashCountBalancedMessage');
        }
        else {
          var backgroundColor = isShortage ? 'var(--md-sys-color-error-container)' : 'var(--md-sys-color-tertiary-container)';
          var textColor = isShortage ? 'var(--md-sys-color-on-error-container)' : 'var(--md-sys-color-on-tertiary-container)';
          var iconName = isShortage ? 'warning' : 'info';
          var labelText = isShortage ? t('reconciliation', 'cashShortageLabel') : t('reconciliation', 'cashOverageLabel');
          var amountText = i18n.displayCurrency(Math.abs(discrepancy));
          var messageText = t('reconciliation', 'discrepancyWillBeRecordedMessage');
        }

        return html`
          <div role="alert" style="
            background-color: ${backgroundColor};
            color: ${textColor};
            padding: 16px;
            border-radius: var(--md-sys-shape-corner-medium);
            display: flex;
            flex-direction: column;
            gap: 8px;
          ">
            <div style="display: flex; align-items: center; gap: 8px;">
              <material-symbols name="${iconName}"></material-symbols>
              <span class="label-medium">${labelText}</span>
            </div>
            ${amountText ? html`<p class="title-medium" style="margin: 0;">${amountText}</p>` : nothing}
            <p class="body-small" style="margin: 0;">
              ${messageText}
            </p>
          </div>
        `;
      }
      else return html`
        <div role="alert" style="
          background-color: var(--md-sys-color-surface-container);
          color: var(--md-sys-color-on-surface);
          padding: 16px;
          border-radius: var(--md-sys-shape-corner-medium);
          display: flex;
          flex-direction: column;
          gap: 8px;
        ">
          <div style="display: flex; align-items: center; gap: 8px;">
            <material-symbols name="info"></material-symbols>
            <span class="label-small">${t('reconciliation', 'selectAccountFirstLabel')}</span>
          </div>
          <p class="body-small" style="margin: 0;">
            ${t('reconciliation', 'selectAccountFirstMessage')}
          </p>
        </div>
      `;
    }

    useEffect(host, function renderCashCountCreationDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="cash-count-creation-dialog"
          role="dialog"
          aria-labelledby="cash-count-creation-dialog-title"
          @close=${handleDialogClose}
        >
          <form
            ${formElement}
            method="dialog"
            class="container"
            ?disabled=${form.state !== 'idle'}
            @submit=${handleSubmit}
          >
            <header>
              <hgroup>
                <h2 id="cash-count-creation-dialog-title">${t('reconciliation', 'createCashCountDialogTitle')}</h2>
              </hgroup>
            </header>

            <div class="content">
              <p class="body-medium" style="margin: 0; color: var(--md-sys-color-on-surface-variant);">
                ${t('reconciliation', 'createCashCountDescription')}
              </p>

              <div class="outlined-text-field" style="anchor-name: --cash-account-menu-anchor;">
                <div class="container">
                  <label for="account-code-input">${t('reconciliation', 'cashAccountLabel')}</label>
                  <input
                    id="account-code-input"
                    type="button"
                    required
                    placeholder=" "
                    value="${form.accountCode ? `${form.accountCode} - ${form.accountName}` : ''}"
                    popovertarget="cash-account-menu"
                    popovertargetaction="show"
                  />
                  <input type="hidden" name="accountCode" value="${form.accountCode || ''}" />
                  <label for="account-code-input" class="trailing-icon">
                    <material-symbols name="arrow_drop_down"></material-symbols>
                  </label>
                </div>
              </div>
              <menu role="menu" popover id="cash-account-menu" class="dropdown" style="position-anchor: --cash-account-menu-anchor;">
                ${state.cashAccounts.length === 0 ? html`
                  <li style="padding: 12px 16px; color: var(--md-sys-color-on-surface-variant);">
                    ${state.isLoadingAccounts ? t('settings', 'loadingMessage') : t('reconciliation', 'selectCashAccountOption')}
                  </li>
                ` : nothing}
                ${repeat(state.cashAccounts, (account) => account.account_code, (account) => html`
                  <li>
                    <button
                      role="menuitem"
                      type="button"
                      data-account-code="${account.account_code}"
                      data-account-name="${account.name}"
                      data-account-balance="${account.balance}"
                      @click=${handleAccountSelect}
                      popovertarget="cash-account-menu"
                      popovertargetaction="hide"
                      aria-selected="${form.accountCode === account.account_code ? 'true' : 'false'}"
                    >
                      ${form.accountCode === account.account_code ? html`<material-symbols name="check"></material-symbols>` : nothing}
                      <div class="text">
                        <span>${account.account_code} - ${account.name}</span>
                        <small>${i18n.displayCurrency(account.balance)}</small>
                      </div>
                    </button>
                  </li>
                `)}
              </menu>

              <div style="background-color: var(--md-sys-color-surface-container); padding: 16px; border-radius: var(--md-sys-shape-corner-medium);">
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <div>
                    <p class="label-small" style="color: var(--md-sys-color-on-surface-variant); margin: 0;">
                      ${t('reconciliation', 'systemBalanceLabel')}
                    </p>
                    <p class="title-medium" style="margin: 0;">
                      ${i18n.displayCurrency(form.accountBalance || 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div class="outlined-text-field">
                <div class="container">
                  <label for="counted-amount-input">${t('reconciliation', 'countedAmountLabel')}</label>
                  <input
                    id="counted-amount-input"
                    name="countedAmount"
                    type="text"
                    inputmode="numeric"
                    placeholder=" "
                    required
                    value="${form.countedAmount}"
                    ${readValue(form, 'countedAmount')}
                  />
                </div>
              </div>

              ${renderCashCountNotice()}

              <div class="outlined-text-field">
                <div class="container">
                  <label for="count-time-input">${t('reconciliation', 'countTimeLabel')}</label>
                  <input
                    id="count-time-input"
                    name="countTime"
                    type="datetime-local"
                    placeholder=" "
                    value="${form.countTime}"
                    ${readValue(form, 'countTime')}
                    required
                  />
                </div>
              </div>

              <div class="outlined-text-field">
                <div class="container">
                  <label for="note-input">${t('reconciliation', 'noteLabel')}</label>
                  <input
                    id="note-input"
                    name="note"
                    type="text"
                    placeholder=" "
                    value="${form.note}"
                  />
                </div>
              </div>
            </div>

            <menu>
              <button
                type="button"
                role="button"
                class="text"
                ?disabled=${form.state !== 'idle'}
                commandfor="cash-count-creation-dialog"
                command="close"
              >${t('reconciliation', 'cancelButtonLabel')}</button>
              <button
                type="submit"
                role="button"
                class="filled"
                ?disabled=${form.state !== 'idle'}
              >
                <material-symbols name="save"></material-symbols>
                ${t('reconciliation', 'createCashCountButtonLabel')}
              </button>
            </menu>
          </form>
        </dialog>

        <dialog
          ${errorAlertDialog}
          role="alertdialog"
          id="cash-count-error-alert-dialog"
          aria-labelledby="cash-count-error-alert-dialog-title"
        >
          <div class="container">
            <material-symbols name="error" style="color: var(--md-sys-color-error);"></material-symbols>
            <header>
              <hgroup>
                <h3>${t('reconciliation', 'cashCountCreationErrorTitle')}</h3>
              </hgroup>
            </header>
            <div class="content">
              <p>${form.error?.message || t('reconciliation', 'unknownErrorMessage')}</p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  class="text"
                  commandfor="cash-count-error-alert-dialog"
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

defineWebComponent('cash-count-creation-dialog', CashCountCreationDialogElement);
