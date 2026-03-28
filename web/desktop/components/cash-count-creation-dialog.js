import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { TimeContextElement } from '#web/contexts/time-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { useWatch } from '#web/hooks/use-watch.js';
import { webStyleSheets } from '#web/desktop/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import {
  calculateReconciliationBookBalance,
  normalizeReconciliationError,
} from '#web/tools/accounting.js';

import '#web/desktop/components/material-symbols.js';

/**
 * @typedef {object} CashAccountOption
 * @property {number} accountCode
 * @property {string} accountName
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
    const formElement = useElement(host, HTMLFormElement);
    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      formState: /** @type {'idle' | 'loading-preview' | 'submitting' | 'error'} */ ('idle'),
      formError: /** @type {Error | null} */ (null),
      cashAccounts: /** @type {CashAccountOption[]} */ ([]),
      isLoadingAccounts: false,
      accountCode: /** @type {number | null} */ (null),
      accountName: '',
      checkpointTime: '',
      countedAmount: '',
      note: '',
      bookBalance: 0,
      hasBookBalance: false,
    });

    let previewToken = 0;

    async function loadCashAccounts() {
      try {
        state.isLoadingAccounts = true;
        const result = await database.sql`
          SELECT a.account_code, a.name
          FROM accounts a
          JOIN account_tags at ON at.account_code = a.account_code
          WHERE at.tag = 'Cash Flow - Cash Equivalents'
            AND a.is_posting_account = 1
            AND a.is_active = 1
          ORDER BY a.account_code ASC
        `;
        state.cashAccounts = result.rows.map(function mapCashAccount(row) {
          return /** @type {CashAccountOption} */ ({
            accountCode: Number(row.account_code),
            accountName: String(row.name),
          });
        });
      }
      catch {
        state.cashAccounts = [];
      }
      finally {
        state.isLoadingAccounts = false;
      }
    }

    function resetForm() {
      state.formState = 'idle';
      state.formError = null;
      state.accountCode = null;
      state.accountName = '';
      state.checkpointTime = time.currentDate().toISOString().slice(0, 16);
      state.countedAmount = '';
      state.note = '';
      state.bookBalance = 0;
      state.hasBookBalance = false;
      formElement.value?.reset();
    }

    async function refreshBookBalance() {
      const currentToken = ++previewToken;

      if (state.accountCode === null || state.checkpointTime === '') {
        state.bookBalance = 0;
        state.hasBookBalance = false;
        if (state.formState === 'loading-preview') state.formState = 'idle';
        return;
      }

      const checkpointTime = new Date(state.checkpointTime).getTime();
      if (Number.isNaN(checkpointTime) || checkpointTime <= 0) {
        state.bookBalance = 0;
        state.hasBookBalance = false;
        if (state.formState === 'loading-preview') state.formState = 'idle';
        return;
      }

      try {
        if (state.formState === 'idle') state.formState = 'loading-preview';
        const bookBalance = await calculateReconciliationBookBalance(database, state.accountCode, checkpointTime);
        if (currentToken !== previewToken) return;
        state.bookBalance = bookBalance;
        state.hasBookBalance = true;
      }
      catch {
        if (currentToken !== previewToken) return;
        state.bookBalance = 0;
        state.hasBookBalance = false;
      }
      finally {
        if (currentToken === previewToken && state.formState === 'loading-preview') {
          state.formState = 'idle';
        }
      }
    }

    function closeErrorDialog() {
      errorAlertDialog.value?.close();
    }

    function readCountedAmount() {
      const countedAmount = Number.parseInt(state.countedAmount, 10);
      return Number.isNaN(countedAmount) ? null : countedAmount;
    }

    /** @param {Event} event */
    function handleAccountSelect(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      state.accountCode = Number(event.currentTarget.dataset.accountCode);
      state.accountName = String(event.currentTarget.dataset.accountName);
      void refreshBookBalance();
    }

    /** @param {Event} event */
    function handleCheckpointTimeInput(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      state.checkpointTime = event.currentTarget.value;
      void refreshBookBalance();
    }

    /** @param {Event} event */
    function handleCountedAmountInput(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      state.countedAmount = event.currentTarget.value;
    }

    /** @param {Event} event */
    function handleNoteInput(event) {
      assertInstanceOf(HTMLTextAreaElement, event.currentTarget);
      state.note = event.currentTarget.value;
    }

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
      event.preventDefault();
      if (state.formState === 'submitting') return;

      try {
        if (state.accountCode === null) throw new Error(t('reconciliation', 'accountRequiredError'));
        if (state.checkpointTime === '') throw new Error(t('reconciliation', 'checkpointTimeRequiredError'));
        if (state.countedAmount.trim() === '') throw new Error(t('reconciliation', 'countedAmountRequiredError'));

        const checkpointTime = new Date(state.checkpointTime).getTime();
        if (Number.isNaN(checkpointTime) || checkpointTime <= 0) {
          throw new Error(t('reconciliation', 'invalidCheckpointTimeError'));
        }

        const countedAmount = Number.parseInt(state.countedAmount, 10);
        if (Number.isNaN(countedAmount)) {
          throw new Error(t('reconciliation', 'countedAmountRequiredError'));
        }

        state.formState = 'submitting';
        state.formError = null;

        const result = await database.sql`
          INSERT INTO reconciliation_checkpoints (
            account_code,
            type,
            checkpoint_time,
            external_balance,
            adjustment_journal_entry_ref,
            note,
            create_time
          ) VALUES (
            ${state.accountCode},
            ${'PHYSICAL'},
            ${checkpointTime},
            ${countedAmount},
            (SELECT COALESCE(MAX(ref), 0) + 1 FROM journal_entries),
            ${state.note || null},
            ${time.currentDate().getTime()}
          ) RETURNING id
        `;

        host.dispatchEvent(new CustomEvent('cash-count-created', {
          bubbles: true,
          composed: true,
          detail: {
            reconciliationId: Number(result.rows[0].id),
            countTime: checkpointTime,
          },
        }));

        dialog.open = false;
      }
      catch (error) {
        state.formState = 'error';
        state.formError = normalizeReconciliationError(error, t);
        errorAlertDialog.value?.showModal();
      }
    }

    /** @param {Event} event */
    function handleDialogClose(event) {
      if (state.formState === 'submitting') event.preventDefault();
    }

    function renderPreview() {
      const countedAmount = readCountedAmount();
      const discrepancy = countedAmount === null ? null : countedAmount - state.bookBalance;
      const isBalanced = discrepancy === 0;
      const isShortage = discrepancy !== null && discrepancy < 0;

      return html`
        <section style="display: grid; gap: 12px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
            <article style="padding: 16px; border-radius: var(--md-sys-shape-corner-large); background: var(--md-sys-color-surface-container-low);">
              <p class="label-medium" style="margin: 0; color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'systemBalanceLabel')}</p>
              <p class="title-large" style="margin: 8px 0 0 0;">${state.hasBookBalance ? i18n.displayCurrency(state.bookBalance) : '—'}</p>
            </article>
            <article style="padding: 16px; border-radius: var(--md-sys-shape-corner-large); background: var(--md-sys-color-surface-container-low);">
              <p class="label-medium" style="margin: 0; color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'countedAmountLabel')}</p>
              <p class="title-large" style="margin: 8px 0 0 0;">${countedAmount === null ? '—' : i18n.displayCurrency(countedAmount)}</p>
            </article>
            <article style="padding: 16px; border-radius: var(--md-sys-shape-corner-large); background: var(--md-sys-color-surface-container-low);">
              <p class="label-medium" style="margin: 0; color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'tableHeaderDiscrepancy')}</p>
              <p class="title-large" style="margin: 8px 0 0 0; color: ${isBalanced ? 'inherit' : 'var(--md-sys-color-error)'};">${discrepancy === null ? '—' : i18n.displayCurrency(discrepancy)}</p>
            </article>
          </div>
          <div role="status" style="padding: 16px; border-radius: var(--md-sys-shape-corner-large); background: ${isBalanced ? 'var(--md-sys-color-primary-container)' : isShortage ? 'var(--md-sys-color-error-container)' : 'var(--md-sys-color-tertiary-container)'}; color: ${isBalanced ? 'var(--md-sys-color-on-primary-container)' : isShortage ? 'var(--md-sys-color-on-error-container)' : 'var(--md-sys-color-on-tertiary-container)'};">
            <p class="label-large" style="margin: 0 0 4px 0;">
              ${countedAmount === null
                ? t('reconciliation', 'checkpointPreviewPendingLabel')
                : isBalanced
                  ? t('reconciliation', 'balancedLabel')
                  : isShortage
                    ? t('reconciliation', 'cashShortageLabel')
                    : t('reconciliation', 'cashOverageLabel')}
            </p>
            <p class="body-medium" style="margin: 0;">
              ${countedAmount === null
                ? t('reconciliation', 'enterExternalBalancePreviewMessage')
                : isBalanced
                  ? t('reconciliation', 'cashCountBalancedMessage')
                  : t('reconciliation', 'discrepancyWillBeRecordedMessage')}
            </p>
          </div>
        </section>
      `;
    }

    useWatch(host, dialog, 'open', function onDialogOpenChange(isOpen) {
      if (isOpen) {
        resetForm();
        void loadCashAccounts();
        void refreshBookBalance();
      }
    });

    useEffect(host, function renderDialog() {
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
            @submit=${handleSubmit}
          >
            <header>
              <hgroup>
                <h2 id="cash-count-creation-dialog-title">${t('reconciliation', 'createCashCountDialogTitle')}</h2>
                <p>${t('reconciliation', 'createCashCountDescription')}</p>
              </hgroup>
              <button
                role="button"
                type="button"
                class="text"
                commandfor="cash-count-creation-dialog"
                command="close"
                aria-label="${t('reconciliation', 'closeButtonLabel')}"
              ><material-symbols name="close"></material-symbols></button>
              <button
                role="button"
                type="submit"
                class="filled"
                ?disabled=${state.accountCode === null || state.checkpointTime === '' || state.countedAmount.trim() === '' || state.formState === 'submitting'}
              >
                ${state.formState === 'submitting' ? html`<div role="progressbar" class="circular indeterminate extra-small"></div>` : nothing}
                ${t('reconciliation', 'createCashCountButtonLabel')}
              </button>
            </header>

            <div class="content" style="display: grid; gap: 20px;">
              <div class="outlined-text-field" style="anchor-name: --cash-account-menu-anchor;">
                <div class="container">
                  <label for="cash-account-input">${t('reconciliation', 'cashAccountLabel')}</label>
                  <input
                    id="cash-account-input"
                    type="button"
                    aria-label="${t('reconciliation', 'cashAccountLabel')}"
                    placeholder=" "
                    value="${state.accountCode === null ? '' : `${state.accountCode} - ${state.accountName}`}"
                    popovertarget="cash-account-menu"
                    popovertargetaction="show"
                  />
                  <label for="cash-account-input" class="trailing-icon">
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
                ${repeat(state.cashAccounts, (account) => account.accountCode, function renderCashAccount(account) {
                  return html`
                    <li>
                      <button
                        role="menuitem"
                        type="button"
                        data-account-code="${account.accountCode}"
                        data-account-name="${account.accountName}"
                        @click=${handleAccountSelect}
                        popovertarget="cash-account-menu"
                        popovertargetaction="hide"
                      >
                        <span>${account.accountCode} - ${account.accountName}</span>
                      </button>
                    </li>
                  `;
                })}
              </menu>

              <section style="display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="cash-count-time">${t('reconciliation', 'countTimeLabel')}</label>
                    <input
                      .value=${state.checkpointTime}
                      id="cash-count-time"
                      type="datetime-local"
                      name="checkpointTime"
                      placeholder=" "
                      required
                      @input=${handleCheckpointTimeInput}
                    />
                  </div>
                </div>

                <div class="outlined-text-field">
                  <div class="container">
                    <label for="cash-count-amount">${t('reconciliation', 'countedAmountLabel')}</label>
                    <input
                      .value=${state.countedAmount}
                      id="cash-count-amount"
                      type="number"
                      inputmode="numeric"
                      name="countedAmount"
                      placeholder=" "
                      required
                      @input=${handleCountedAmountInput}
                    />
                  </div>
                </div>
              </section>

              <div class="outlined-text-field textarea">
                <div class="container">
                  <label for="cash-count-note">${t('reconciliation', 'noteLabel')}</label>
                  <textarea
                    .value=${state.note}
                    id="cash-count-note"
                    name="note"
                    placeholder=" "
                    rows="4"
                    @input=${handleNoteInput}
                  ></textarea>
                </div>
              </div>

              ${renderPreview()}
            </div>
          </form>
        </dialog>

        <dialog ${errorAlertDialog} role="alertdialog" aria-labelledby="cash-count-creation-error-title">
          <article class="container" style="min-width: min(420px, calc(100vw - 32px));">
            <header>
              <h2 id="cash-count-creation-error-title">${t('reconciliation', 'cashCountCreationErrorTitle')}</h2>
            </header>
            <div class="content">
              <p>${state.formError?.message ?? t('reconciliation', 'unknownErrorMessage')}</p>
            </div>
            <footer>
              <button type="button" class="filled" @click=${closeErrorDialog}>${t('reconciliation', 'dismissButtonLabel')}</button>
            </footer>
          </article>
        </dialog>
      `);
    });
  }
}

defineWebComponent('cash-count-creation-dialog', CashCountCreationDialogElement);
