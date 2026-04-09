import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

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
import { useLiteral, useTranslator } from '#web/hooks/use-translator.js';
import { useWatch } from '#web/hooks/use-watch.js';
import { webStyleSheets } from '#web/desktop/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import {
  calculateReconciliationBookBalance,
  normalizeReconciliationError,
} from '#web/tools/accounting.js';

import '#web/desktop/components/material-symbols.js';
import '#web/desktop/components/account-selector-dialog.js';

export class AccountReconciliationCreationDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const time = useContext(host, TimeContextElement);
    const t = useTranslator(host);

    const l = useLiteral(host);
    const errorAlertDialog = useElement(host, HTMLDialogElement);
    const formElement = useElement(host, HTMLFormElement);
    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      formState: /** @type {'idle' | 'loading-preview' | 'submitting' | 'error'} */ ('idle'),
      formError: /** @type {Error | null} */ (null),
      accountCode: /** @type {number | null} */ (null),
      accountName: '',
      checkpointTime: '',
      externalBalance: '',
      note: '',
      bookBalance: 0,
      hasBookBalance: false,
    });

    let previewToken = 0;

    function resetForm() {
      state.formState = 'idle';
      state.formError = null;
      state.accountCode = null;
      state.accountName = '';
      state.checkpointTime = time.newDate().toISOString().slice(0, 16);
      state.externalBalance = '';
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

    function readExternalBalance() {
      const externalBalance = Number.parseInt(state.externalBalance, 10);
      return Number.isNaN(externalBalance) ? null : externalBalance;
    }

    /** @param {CustomEvent} event */
    function handleAccountSelected(event) {
      state.accountCode = Number(event.detail.accountCode);
      state.accountName = String(event.detail.accountName);
      void refreshBookBalance();
    }

    /** @param {Event} event */
    function handleCheckpointTimeInput(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      state.checkpointTime = event.currentTarget.value;
      void refreshBookBalance();
    }

    /** @param {Event} event */
    function handleExternalBalanceInput(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      state.externalBalance = event.currentTarget.value;
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
        if (state.externalBalance.trim() === '') throw new Error(t('reconciliation', 'externalBalanceRequiredError'));

        const checkpointTime = new Date(state.checkpointTime).getTime();
        if (Number.isNaN(checkpointTime) || checkpointTime <= 0) {
          throw new Error(t('reconciliation', 'invalidCheckpointTimeError'));
        }

        const externalBalance = Number.parseInt(state.externalBalance, 10);
        if (Number.isNaN(externalBalance)) {
          throw new Error(t('reconciliation', 'externalBalanceRequiredError'));
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
            ${'STATEMENT'},
            ${checkpointTime},
            ${externalBalance},
            (SELECT COALESCE(MAX(ref), 0) + 1 FROM journal_entries),
            ${state.note || null},
            ${time.newDate().getTime()}
          ) RETURNING id
        `;

        host.dispatchEvent(new CustomEvent('account-reconciliation-created', {
          bubbles: true,
          composed: true,
          detail: { reconciliationId: Number(result.rows[0].id) },
        }));

        dialog.open = false;
      }
      catch (error) {
        state.formState = 'error';
        state.formError = normalizeReconciliationError(error, l);
        errorAlertDialog.value?.showModal();
      }
    }

    /** @param {Event} event */
    function handleDialogClose(event) {
      if (state.formState === 'submitting') event.preventDefault();
    }

    function renderPreview() {
      const externalBalance = readExternalBalance();
      const discrepancy = externalBalance === null ? null : externalBalance - state.bookBalance;
      const isBalanced = discrepancy === 0;

      return html`
        <section style="display: grid; gap: 12px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
            <article style="padding: 16px; border-radius: var(--md-sys-shape-corner-large); background: var(--md-sys-color-surface-container-low);">
              <p class="label-medium" style="margin: 0; color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'bookBalanceLabel')}</p>
              <p class="title-large" style="margin: 8px 0 0 0;">${state.hasBookBalance ? i18n.displayCurrency(state.bookBalance) : '—'}</p>
            </article>
            <article style="padding: 16px; border-radius: var(--md-sys-shape-corner-large); background: var(--md-sys-color-surface-container-low);">
              <p class="label-medium" style="margin: 0; color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'externalBalanceLabel')}</p>
              <p class="title-large" style="margin: 8px 0 0 0;">${externalBalance === null ? '—' : i18n.displayCurrency(externalBalance)}</p>
            </article>
            <article style="padding: 16px; border-radius: var(--md-sys-shape-corner-large); background: var(--md-sys-color-surface-container-low);">
              <p class="label-medium" style="margin: 0; color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'balanceDifferenceLabel')}</p>
              <p class="title-large" style="margin: 8px 0 0 0; color: ${isBalanced ? 'inherit' : 'var(--md-sys-color-error)'};">${discrepancy === null ? '—' : i18n.displayCurrency(discrepancy)}</p>
            </article>
          </div>
          <div role="status" style="padding: 16px; border-radius: var(--md-sys-shape-corner-large); background: ${isBalanced ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-tertiary-container)'}; color: ${isBalanced ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-tertiary-container)'};">
            <p class="label-large" style="margin: 0 0 4px 0;">
              ${externalBalance === null
                ? t('reconciliation', 'checkpointPreviewPendingLabel')
                : isBalanced
                  ? t('reconciliation', 'balancedLabel')
                  : discrepancy > 0
                    ? t('reconciliation', 'overageLabel')
                    : t('reconciliation', 'shortageLabel')}
            </p>
            <p class="body-medium" style="margin: 0;">
              ${externalBalance === null
                ? t('reconciliation', 'enterExternalBalancePreviewMessage')
                : isBalanced
                  ? t('reconciliation', 'statementBalancedMessage')
                  : t('reconciliation', 'statementAdjustmentWillBeRecordedMessage')}
            </p>
          </div>
        </section>
      `;
    }

    useWatch(host, dialog, 'open', function onDialogOpenChange(isOpen) {
      if (isOpen) {
        resetForm();
        void refreshBookBalance();
      }
    });

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="account-reconciliation-creation-dialog"
          class="full-screen"
          role="dialog"
          aria-labelledby="account-reconciliation-creation-title"
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
                <h2 id="account-reconciliation-creation-title">${t('reconciliation', 'createReconciliationTitle')}</h2>
                <p>${t('reconciliation', 'createReconciliationDescription')}</p>
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
                ?disabled=${state.accountCode === null || state.checkpointTime === '' || state.externalBalance.trim() === '' || state.formState === 'submitting'}
              >
                ${state.formState === 'submitting' ? html`<div role="progressbar" class="circular indeterminate extra-small"></div>` : nothing}
                ${t('reconciliation', 'createButtonLabel')}
              </button>
            </header>

            <div class="content" style="display: grid; gap: 20px;">
              <section style="display: grid; gap: 16px;">
                <h3 class="title-medium" style="margin: 0;">${t('reconciliation', 'accountSectionTitle')}</h3>
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="statement-account-selector">${t('reconciliation', 'accountLabel')}</label>
                    <input
                      id="statement-account-selector"
                      type="button"
                      aria-label="${t('reconciliation', 'accountLabel')}"
                      value="${state.accountCode === null ? '' : `${state.accountCode} - ${state.accountName}`}"
                      placeholder=" "
                      commandfor="account-selector-dialog"
                      command="--open"
                    />
                    <label for="statement-account-selector" class="trailing-icon">
                      <material-symbols name="arrow_drop_down"></material-symbols>
                    </label>
                  </div>
                </div>
              </section>

              <section style="display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="statement-checkpoint-time">${t('reconciliation', 'checkpointTimeLabel')}</label>
                    <input
                      .value=${state.checkpointTime}
                      id="statement-checkpoint-time"
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
                    <label for="statement-external-balance">${t('reconciliation', 'statementBalanceLabel')}</label>
                    <input
                      .value=${state.externalBalance}
                      id="statement-external-balance"
                      type="number"
                      inputmode="numeric"
                      name="externalBalance"
                      placeholder=" "
                      required
                      @input=${handleExternalBalanceInput}
                    />
                  </div>
                </div>
              </section>

              <div class="outlined-text-field textarea">
                <div class="container">
                  <label for="statement-note">${t('reconciliation', 'noteLabel')}</label>
                  <textarea
                    .value=${state.note}
                    id="statement-note"
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

          <account-selector-dialog
            id="account-selector-dialog"
            @account-select=${handleAccountSelected}
          ></account-selector-dialog>
        </dialog>

        <dialog ${errorAlertDialog} role="alertdialog" aria-labelledby="account-reconciliation-creation-error-title">
          <article class="container" style="min-width: min(420px, calc(100vw - 32px));">
            <header>
              <h2 id="account-reconciliation-creation-error-title">${t('reconciliation', 'errorTitle')}</h2>
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

defineWebComponent('account-reconciliation-creation-dialog', AccountReconciliationCreationDialogElement);
