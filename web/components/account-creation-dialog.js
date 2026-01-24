import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useElement } from '#web/hooks/use-element.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';
import '#web/components/account-selector-dialog.js';

/** @import { EnLangPack as DefaultLangPack } from '#web/lang/en.js' */

const accountTypes = /** @type {const} */ ([
  'Asset',
  'Liability',
  'Equity',
  'Revenue',
  'Expense',
  'Contra Asset',
  'Contra Liability',
  'Contra Equity',
  'Contra Revenue',
  'Contra Expense',
]);

/** @type {Record<string, keyof DefaultLangPack['account']>} */
const accountTypeTranslationKeyMap = {
  'Asset': 'accountTypeAsset',
  'Liability': 'accountTypeLiability',
  'Equity': 'accountTypeEquity',
  'Revenue': 'accountTypeRevenue',
  'Expense': 'accountTypeExpense',
  'Contra Asset': 'accountTypeContraAsset',
  'Contra Liability': 'accountTypeContraLiability',
  'Contra Equity': 'accountTypeContraEquity',
  'Contra Revenue': 'accountTypeContraRevenue',
  'Contra Expense': 'accountTypeContraExpense',
};

/**
 * Map account type to translation key
 * @param {string} accountType
 * @returns {keyof DefaultLangPack['account']}
 */
function getAccountTypeTranslationKey(accountType) {
  return accountTypeTranslationKeyMap[accountType] || 'accountTypeAsset';
}

/**
 * Account Creation Dialog Component
 * 
 * @fires account-created - Fired when an account is successfully created. Detail: { accountCode: number }
 */
export class AccountCreationDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);

    const t = useTranslator(host);
    const dialog = useDialog(host);
    const errorAlertDialog = useElement(host, HTMLDialogElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      formState: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      formError: /** @type {Error | null} */ (null),
      parentAccountCode: /** @type {number | null} */ (null),
      parentAccountName: /** @type {string | null} */ (null),
      normalBalance: /** @type {'Debit' | 'Credit'} */ (null),
      accountType: /** @type {string | null} */ (null),
    });

    /** @param {FocusEvent} event */
    async function validateAccountCode(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      const input = event.currentTarget;
      const accountCode = input.value.trim();
      input.setCustomValidity('');
      if (accountCode) {
        try {
          const result = await database.sql`SELECT 1 FROM accounts WHERE account_code = ${accountCode} LIMIT 1;`;
          if (result.rows.length > 0) input.setCustomValidity(t('account', 'accountCodeExistsError'));
        } catch (error) {
          input.setCustomValidity(t('account', 'accountCodeValidationError', error));
        }
      }
    }

    /** @param {FocusEvent} event */
    async function validateAccountName(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      const input = event.currentTarget;
      const name = input.value.trim();
      input.setCustomValidity('');
      if (name) {
        try {
          const result = await database.sql`SELECT 1 FROM accounts WHERE name = ${name} LIMIT 1;`;
          if (result.rows.length > 0) input.setCustomValidity(t('account', 'accountNameExistsError'));
        }
        catch (error) {
          input.setCustomValidity(t('account', 'accountNameValidationError', error));
        }
      }
    }

    /** @param {CustomEvent} event */
    function handleAccountSelect(event) {
      const detail = event.detail;
      state.parentAccountCode = detail.accountCode;
      state.parentAccountName = detail.accountName;
    }

    function clearParentAccount() {
      state.parentAccountCode = null;
      state.parentAccountName = null;
    }

    /** @param {Event} event */
    function handleNormalBalanceSelect(event) {
      assertInstanceOf(HTMLElement, event.currentTarget);
      state.normalBalance = event.currentTarget.getAttribute('data-value') === 'Debit'
        ? 'Debit'
        : 'Credit';
      host.shadowRoot?.getElementById('normal-balance-menu')?.hidePopover();
    }

    /** @param {string} value */
    function handleAccountTypeSelect(value) {
      state.accountType = value;
      host.shadowRoot?.getElementById('account-type-menu')?.hidePopover();
    }

    /** @param {Event} event */
    function handleAccountTypeClick(event) {
      const target = /** @type {HTMLElement} */ (event.currentTarget);
      const accountType = String(target.dataset.accountType);
      handleAccountTypeSelect(accountType);
    }

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
      event.preventDefault();
      assertInstanceOf(HTMLFormElement, event.currentTarget);
      const form = event.currentTarget;

      const tx = await database.transaction('write');
      try {
        state.formState = 'submitting';
        state.formError = null;

        const data = new FormData(form);
        const accountCode = parseInt(/** @type {string} */(data.get('accountCode')), 10);
        const name = /** @type {string} */ (data.get('name'));
        const normalBalance = /** @type {string} */ (data.get('normalBalance'));
        const accountType = /** @type {string} */ (data.get('accountType'));

        if (isNaN(accountCode)) throw new Error(t('account', 'invalidAccountCodeError'));
        if (!name) throw new Error(t('account', 'accountNameRequiredError'));
        if (!['Debit', 'Credit'].includes(normalBalance)) throw new Error(t('account', 'invalidNormalBalanceError'));
        if (!accountType) throw new Error(t('account', 'accountTypeRequiredError'));

        await tx.sql`
          INSERT INTO accounts (account_code, name, normal_balance, control_account_code, create_time, update_time)
          VALUES (${accountCode}, ${name}, ${normalBalance === 'Debit' ? 0 : 1}, ${state.parentAccountCode}, ${Date.now()}, ${Date.now()});
        `;

        await tx.sql`
          INSERT INTO account_tags (account_code, tag)
          VALUES (${accountCode}, ${accountType});
        `;

        await tx.commit();

        state.formState = 'success';
        await feedbackDelay();

        host.dispatchEvent(new CustomEvent('account-created', {
          detail: { accountCode },
          bubbles: true,
          composed: true,
        }));

        dialog.open = false;

        form.reset();
        clearParentAccount();

        state.normalBalance = null;
        state.accountType = null;
      }
      catch (error) {
        // console.debug(error);
        await tx.rollback();
        state.formState = 'error';
        state.formError = error instanceof Error ? error : new Error(String(error));
        await feedbackDelay();
      }
      finally {
        state.formState = 'idle';
      }
    }

    useEffect(host, async function syncErrorAlertDialogState() {
      if (errorAlertDialog.value instanceof HTMLDialogElement) {
        if (state.formError instanceof Error) errorAlertDialog.value.showModal();
        else errorAlertDialog.value.close();
      }
    });

    function handleDismissErrorDialog() { state.formError = null; }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="account-creation-dialog"
          class="full-screen"
          aria-labelledby="account-creation-dialog-title"
        >
          <form class="container" @submit=${handleSubmit}>
            <header>
              <hgroup>
                <h2 id="account-creation-dialog-title">${t('account', 'createDialogTitle')}</h2>
              </hgroup>
              <button
                role="button"
                type="button"
                class="text"
                aria-label="${t('account', 'cancelButtonLabel')}"
                commandfor="account-creation-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              <button role="button" type="submit" name="action">${t('account', 'createDialogSubmitLabel')}</button>
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

              <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0px; max-width: 600px; margin: 0 auto;">

                <!-- Account Code -->
                <div class="outlined-text-field">
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
                      @blur=${validateAccountCode}
                    />
                  </div>
                  <div class="supporting-text">${t('account', 'accountCodeSupportingText')}</div>
                </div>

                <!-- Account Name -->
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="account-name-input">${t('account', 'accountNameLabel')}</label>
                    <input
                      id="account-name-input"
                      name="name"
                      type="text"
                      placeholder=" "
                      required
                      @blur=${validateAccountName}
                    />
                  </div>
                </div>

                <!-- Normal Balance -->
                <div class="outlined-text-field" style="anchor-name: --normal-balance-menu-anchor;">
                  <div class="container">
                    <label for="normal-balance-input">${t('account', 'normalBalanceLabel')}</label>
                    <input type="hidden" name="normalBalance" value="${state.normalBalance ?? ''}">
                    <input
                      type="button"
                      id="normal-balance-input"
                      popovertarget="normal-balance-menu"
                      style="text-align: start;"
                      value="${state.normalBalance ? t('account', state.normalBalance === 'Debit' ? 'normalBalanceDebit' : 'normalBalanceCredit') : ''}"
                    />
                    <label for="normal-balance-input" class="trailing-icon">
                      <material-symbols name="arrow_drop_down"></material-symbols>
                    </label>
                  </div>
                </div>
                <menu id="normal-balance-menu" role="menu" popover class="dropdown" style="position-anchor: --normal-balance-menu-anchor;">
                  <li>
                    <button type="button" role="menuitem" data-value="Debit" @click=${handleNormalBalanceSelect}>
                      <span class="text">${t('account', 'normalBalanceDebit')}</span>
                    </button>
                  </li>
                  <li>
                    <button type="button" role="menuitem" data-value="Credit" @click=${handleNormalBalanceSelect}>
                      <span class="text">${t('account', 'normalBalanceCredit')}</span>
                    </button>
                  </li>
                </menu>

                <!-- Account Type -->
                <div class="outlined-text-field" style="anchor-name: --account-type-menu-anchor;">
                  <div class="container">
                    <label for="account-type-input">${t('account', 'accountTypeLabel')}</label>
                    <input type="hidden" name="accountType" value="${state.accountType ?? ''}">
                    <input
                      type="button"
                      id="account-type-input"
                      popovertarget="account-type-menu"
                      style="text-align: start;"
                      value="${state.accountType ? t('account', getAccountTypeTranslationKey(state.accountType)) : ''}"
                    />
                    <label for="account-type-input" class="trailing-icon">
                      <material-symbols name="arrow_drop_down"></material-symbols>
                    </label>
                  </div>
                </div>
                <menu id="account-type-menu" role="menu" popover class="dropdown" style="position-anchor: --account-type-menu-anchor;">
                  ${accountTypes.map((accountType) => html`
                    <li>
                      <button type="button" role="menuitem" data-account-type="${accountType}" @click=${handleAccountTypeClick}>
                        <span class="text">${t('account', getAccountTypeTranslationKey(accountType))}</span>
                      </button>
                    </li>
                  `)}
                </menu>

                <!-- Parent Account -->
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="parent-account-input">${t('account', 'parentAccountLabel')}</label>
                    <input
                      id="parent-account-input"
                      type="button"
                      readonly
                      placeholder=" "
                      value="${state.parentAccountCode ? `${state.parentAccountCode} - ${state.parentAccountName}` : ''}"
                      commandfor="account-selector-dialog"
                      command="--open"
                    />
                    ${state.parentAccountCode ? html`
                      <button
                        type="button"
                        class="trailing-icon"
                        @click=${clearParentAccount}
                        aria-label="${t('account', 'clearParentAccountAriaLabel')}"
                      ><material-symbols name="close"></material-symbols></button>
                    ` : html`
                      <button
                        type="button"
                        class="trailing-icon"
                        commandfor="account-selector-dialog"
                        command="--open"
                        aria-label="${t('account', 'selectParentAccountAriaLabel')}"
                      ><material-symbols name="search"></material-symbols></button>
                    `}
                  </div>
                  <div class="supporting-text">${t('account', 'parentAccountSupportingText')}</div>
                </div>

              </div>
            </div>
          </form>
        </dialog>

        <dialog ${errorAlertDialog} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>${t('account', 'errorDialogTitle')}</h3>
            </header>
            <div class="content">
              <p>${state.formError?.message}</p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  @click=${handleDismissErrorDialog}
                >${t('account', 'dismissButtonLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>

        <account-selector-dialog
          id="account-selector-dialog"
          @account-select=${handleAccountSelect}
        ></account-selector-dialog>
      `);
    });
  }
}

defineWebComponent('account-creation-dialog', AccountCreationDialogElement);
