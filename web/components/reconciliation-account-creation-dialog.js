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

/**
 * @typedef {'adjustment' | 'cashOverShort'} ReconciliationAccountType
 */

/**
 * Reconciliation Account Creation Dialog Component
 * 
 * @fires reconciliation-account-created - Fired when a reconciliation account is successfully created. Detail: { accountCode: number, accountType: ReconciliationAccountType }
 */
export class ReconciliationAccountCreationDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const t = useTranslator(host);

    const errorAlertDialog = useElement(host, HTMLDialogElement);
    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const form = useElement(host, HTMLFormElement);
    const state = reactive({
      formState: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      formError: /** @type {Error | null} */ (null),
      accountType: /** @type {ReconciliationAccountType | null} */ (null),
      accountCode: /** @type {string} */ (''),
      accountName: /** @type {string} */ (''),
      parentAccountCode: /** @type {number | null} */ (null),
      codeValidation: /** @type {Error | null} */ (null),
      nameValidation: /** @type {Error | null} */ (null),
    });

    /**
     * Get tag name for the selected account type
     * @returns {string}
     */
    function getTagForAccountType() {
      if (state.accountType === 'adjustment') return 'Reconciliation - Adjustment';
      if (state.accountType === 'cashOverShort') return 'Reconciliation - Cash Over/Short';
      return '';
    }

    /**
     * Get suggested account code based on type
     * @returns {number}
     */
    function getSuggestedAccountCode() {
      // Suggest 82200 range for reconciliation adjustment (Other Expenses)
      if (state.accountType === 'adjustment') return 82200;
      // Suggest 82210 for Cash Over/Short
      if (state.accountType === 'cashOverShort') return 82210;
      return 82200;
    }

    /**
     * Get suggested account name based on type
     * @returns {string}
     */
    function getSuggestedAccountName() {
      if (state.accountType === 'adjustment') return t('reconciliation', 'reconciliationAdjustmentAccountName');
      if (state.accountType === 'cashOverShort') return t('reconciliation', 'cashOverShortAccountName');
      return '';
    }

    /**
     * Handle account type selection
     * @param {ReconciliationAccountType} type
     */
    function handleAccountTypeSelect(type) {
      state.accountType = type;
      state.accountCode = getSuggestedAccountCode().toString();
      state.accountName = getSuggestedAccountName();
      state.codeValidation = null;
      state.nameValidation = null;
    }

    /** @param {Event} event */
    function handleAccountTypeClick(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      const type = /** @type {ReconciliationAccountType} */ (event.currentTarget.dataset.type);
      handleAccountTypeSelect(type);
    }

    function handleBackClick() {
      state.accountType = null;
    }

    /** @param {Event} event */
    async function validateAccountCode(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      const input = event.currentTarget;
      const code = input.value.trim();

      input.setCustomValidity('');
      state.codeValidation = null;

      if (!code) return;

      const accountCode = parseInt(code, 10);
      if (isNaN(accountCode)) {
        input.setCustomValidity(t('account', 'invalidAccountCodeError'));
        state.codeValidation = new Error(t('account', 'invalidAccountCodeError'));
        return;
      }

      try {
        const result = await database.sql`SELECT account_code FROM accounts WHERE account_code = ${accountCode}`;
        if (result.rows.length > 0) {
          input.setCustomValidity(t('account', 'accountCodeExistsError'));
          state.codeValidation = new Error(t('account', 'accountCodeExistsError'));
        }
      } catch (error) {
        input.setCustomValidity(t('account', 'accountCodeValidationError'));
        state.codeValidation = new Error(t('account', 'accountCodeValidationError'));
        console.error('Account code validation error:', error);
      }
    }

    /** @param {Event} event */
    async function validateAccountName(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      const input = event.currentTarget;
      const name = input.value.trim();

      input.setCustomValidity('');
      state.nameValidation = null;

      if (!name) return;

      try {
        const result = await database.sql`SELECT name FROM accounts WHERE name = ${name}`;
        if (result.rows.length > 0) {
          input.setCustomValidity(t('account', 'accountNameExistsError'));
          state.nameValidation = new Error(t('account', 'accountNameExistsError'));
        }
      } catch (error) {
        input.setCustomValidity(t('account', 'accountNameValidationError'));
        state.nameValidation = new Error(t('account', 'accountNameValidationError'));
        console.error('Account name validation error:', error);
      }
    }

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
      event.preventDefault();

      if (state.formState === 'submitting') return;

      assertInstanceOf(HTMLFormElement, event.currentTarget);
      const form = event.currentTarget;
      const data = new FormData(form);

      const accountCode = parseInt(String(data.get('accountCode') || ''), 10);
      const accountName = String(data.get('name') || '').trim();
      const accountType = state.accountType;

      try {

        if (!accountCode || isNaN(accountCode)) throw new Error(t('account', 'invalidAccountCodeError'));
        if (!accountName) throw new Error(t('account', 'accountNameRequiredError'));
        if (!accountType) throw new Error(t('reconciliation', 'accountTypeRequiredError'));

        state.formState = 'submitting';
        state.formError = null;

        const tx = await database.transaction('write');

        try {
          // Create the account - Expense accounts have normal_balance = 0 (Debit)
          await tx.sql`
            INSERT INTO accounts (account_code, name, normal_balance, control_account_code, create_time, update_time)
            VALUES (${accountCode}, ${accountName}, ${0}, ${state.parentAccountCode}, ${Date.now()}, ${Date.now()});
          `;

          // Add the Expense tag
          await tx.sql`
            INSERT INTO account_tags (account_code, tag)
            VALUES (${accountCode}, ${'Expense'});
          `;

          // Add the reconciliation-specific tag
          const tag = getTagForAccountType();
          if (tag) {
            // For Cash Over/Short, delete any existing tag assignment first (it's unique)
            if (accountType === 'cashOverShort') {
              await tx.sql`DELETE FROM account_tags WHERE tag = ${tag}`;
            }
            await tx.sql`
              INSERT INTO account_tags (account_code, tag)
              VALUES (${accountCode}, ${tag});
            `;
          }

          await tx.commit();

          state.formState = 'success';

          host.dispatchEvent(new CustomEvent('reconciliation-account-created', {
            bubbles: true,
            composed: true,
            detail: { accountCode, accountType },
          }));

          dialog.open = false;
        } catch (txError) {
          await tx.rollback();
          throw txError;
        }
      }
      catch (error) {
        state.formState = 'error';
        state.formError = error instanceof Error ? error : new Error(String(error));
        errorAlertDialog.value?.showModal();
      }
    }

    useWatch(host, dialog, 'open', function onDialogOpenChange(isOpen) {
      if (isOpen) {
        state.formState = 'idle';
        state.formError = null;
        state.accountType = null;
        state.accountCode = '';
        state.accountName = '';
        state.parentAccountCode = null;
        state.codeValidation = null;
        state.nameValidation = null;
        form.value?.reset();
      }
    });

    /** @param {Event} event */
    function handleDialogClose(event) {
      if (state.formState === 'submitting') {
        event.preventDefault();
        return;
      }
    }

    useEffect(host, function renderReconciliationAccountCreationDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="reconciliation-account-creation-dialog"
          class="full-screen"
          role="dialog"
          aria-labelledby="reconciliation-account-creation-dialog-title"
          @close=${handleDialogClose}
        >
          <form
            ${form}
            method="dialog"
            class="container"
            ?disabled=${state.formState !== 'idle'}
            @submit=${handleSubmit}
          >
            <header>
              <hgroup>
                <h2 id="reconciliation-account-creation-dialog-title">${t('reconciliation', 'createAccountDialogTitle')}</h2>
              </hgroup>
              <button
                role="button"
                type="button"
                class="text"
                aria-label="${t('account', 'cancelButtonLabel')}"
                commandfor="reconciliation-account-creation-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              <button
                role="button"
                type="submit"
                name="action"
                ?disabled=${state.formState !== 'idle' || !state.accountType || state.codeValidation !== null || state.nameValidation !== null}
              >${t('account', 'createDialogSubmitLabel')}</button>
            </header>

            <div class="content">
              ${state.formState !== 'idle' ? html`
                <div role="status" aria-live="polite" aria-busy="true">
                  <div role="progressbar" class="linear indeterminate">
                    <div class="track"><div class="indicator"></div></div>
                  </div>
                  <p>${t('account', 'creatingAccountMessage')}</p>
                </div>
              ` : nothing}

              ${state.formState === 'idle' ? html`
                <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0px; max-width: 600px; margin: 0 auto;">

                  <!-- Account Type Selection -->
                  ${!state.accountType ? html`
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                      <h3 class="title-medium">${t('reconciliation', 'selectAccountTypeLabel')}</h3>
                      <p class="body-medium" style="color: var(--md-sys-color-on-surface-variant);">
                        ${t('reconciliation', 'selectAccountTypeDescription')}
                      </p>

                      <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button
                          type="button"
                          class="outlined"
                          data-type="adjustment"
                          @click=${handleAccountTypeClick}
                          style="
                            display: flex;
                            flex-direction: column;
                            align-items: flex-start;
                            gap: 8px;
                            padding: 16px;
                            text-align: left;
                          "
                        >
                          <div style="display: flex; align-items: center; gap: 12px;">
                            <material-symbols name="sync_alt"></material-symbols>
                            <span class="title-medium">${t('reconciliation', 'adjustmentAccountLabel')}</span>
                          </div>
                          <span class="body-small" style="color: var(--md-sys-color-on-surface-variant);">
                            ${t('reconciliation', 'adjustmentAccountDescription')}
                          </span>
                        </button>

                        <button
                          type="button"
                          class="outlined"
                          data-type="cashOverShort"
                          @click=${handleAccountTypeClick}
                          style="
                            display: flex;
                            flex-direction: column;
                            align-items: flex-start;
                            gap: 8px;
                            padding: 16px;
                            text-align: left;
                          "
                        >
                          <div style="display: flex; align-items: center; gap: 12px;">
                            <material-symbols name="payments"></material-symbols>
                            <span class="title-medium">${t('reconciliation', 'cashOverShortAccountLabel')}</span>
                          </div>
                          <span class="body-small" style="color: var(--md-sys-color-on-surface-variant);">
                            ${t('reconciliation', 'cashOverShortAccountDescription')}
                          </span>
                          <span class="body-small" style="color: var(--md-sys-color-tertiary);">
                            ${t('reconciliation', 'uniqueAccountWarning')}
                          </span>
                        </button>
                      </div>
                    </div>
                  ` : html`
                    <!-- Account Details Form -->
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                      <button
                        type="button"
                        class="icon"
                        @click=${handleBackClick}
                        aria-label="${t('reconciliation', 'changeAccountTypeAriaLabel')}"
                      ><material-symbols name="arrow_back"></material-symbols></button>
                      <h3 class="title-medium">
                        ${state.accountType === 'adjustment' ? t('reconciliation', 'adjustmentAccountLabel') : t('reconciliation', 'cashOverShortAccountLabel')}
                      </h3>
                    </div>

                    <!-- Account Code -->
                    <div class="outlined-text-field ${state.codeValidation ? 'error' : ''}">
                      <div class="container">
                        <label for="account-code-input">${t('account', 'accountCodeLabel')}</label>
                        <input
                          id="account-code-input"
                          name="accountCode"
                          type="text"
                          inputmode="numeric"
                          pattern="[0-9]*"
                          placeholder=" "
                          required
                          value="${state.accountCode}"
                          ${readValue(state, 'accountCode')}
                          @blur=${validateAccountCode}
                        />
                      </div>
                      <div class="supporting-text ${state.codeValidation ? 'error' : ''}">
                        ${state.codeValidation ? state.codeValidation.message : t('account', 'accountCodeSupportingText')}
                      </div>
                    </div>

                    <!-- Account Name -->
                    <div class="outlined-text-field ${state.nameValidation ? 'error' : ''}">
                      <div class="container">
                        <label for="account-name-input">${t('account', 'accountNameLabel')}</label>
                        <input
                          id="account-name-input"
                          name="name"
                          type="text"
                          placeholder=" "
                          required
                          value="${state.accountName}"
                          ${readValue(state, 'accountName')}
                          @blur=${validateAccountName}
                        />
                      </div>
                      <div class="supporting-text ${state.nameValidation ? 'error' : ''}">
                        ${state.nameValidation ? state.nameValidation.message : ''}
                      </div>
                    </div>

                    <!-- Info Box -->
                    <div style="
                      padding: 12px 16px;
                      background-color: var(--md-sys-color-surface-container-high);
                      border-radius: 12px;
                      display: flex;
                      gap: 12px;
                    ">
                      <material-symbols name="info" style="color: var(--md-sys-color-primary);"></material-symbols>
                      <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                        <span class="body-medium" style="font-weight: 500;">
                          ${t('reconciliation', 'accountWillBeTaggedLabel')}
                        </span>
                        <span class="body-small" style="color: var(--md-sys-color-on-surface-variant);">
                          ${getTagForAccountType()}
                        </span>
                      </div>
                    </div>
                  `}

                </div>
              ` : nothing}
            </div>
          </form>
        </dialog>

        <dialog
          ${errorAlertDialog}
          role="alertdialog"
          id="reconciliation-account-error-alert-dialog"
          aria-labelledby="reconciliation-account-error-alert-dialog-title"
        >
          <div class="container">
            <material-symbols name="error" style="color: var(--md-sys-color-error);"></material-symbols>
            <header>
              <hgroup>
                <h3 id="reconciliation-account-error-alert-dialog-title">${t('account', 'errorDialogTitle')}</h3>
              </hgroup>
            </header>
            <div class="content">
              <p>${state.formError?.message || t('account', 'unknownErrorMessage')}</p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  class="text"
                  commandfor="reconciliation-account-error-alert-dialog"
                  command="close"
                >${t('account', 'dismissButtonLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('reconciliation-account-creation-dialog', ReconciliationAccountCreationDialogElement);
