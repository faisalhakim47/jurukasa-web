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
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';
import '#web/components/account-selector-dialog.js';

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

    const dialog = useDialog(host);
    const errorAlertDialog = useElement(host, HTMLDialogElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const form = reactive({
      state: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      error: /** @type {Error | null} */ (null),
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
          const result = await database.sql`
            SELECT 1 FROM accounts WHERE account_code = ${accountCode} LIMIT 1;
          `;
          if (result.rows.length > 0) input.setCustomValidity('Account code already exists.');
        }
        catch (error) {
          input.setCustomValidity('Error validating account code.');
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
          const result = await database.sql`
            SELECT 1 FROM accounts WHERE name = ${name} LIMIT 1;
          `;
          if (result.rows.length > 0) input.setCustomValidity('Account name already exists.');
        }
        catch (error) {
          input.setCustomValidity('Error validating account name.');
        }
      }
    }

    /** @param {CustomEvent} event */
    function handleAccountSelect(event) {
      const detail = event.detail;
      form.parentAccountCode = detail.accountCode;
      form.parentAccountName = detail.accountName;
    }

    function clearParentAccount() {
      form.parentAccountCode = null;
      form.parentAccountName = null;
    }

    /** @param {Event} event */
    function handleNormalBalanceSelect(event) {
      assertInstanceOf(HTMLElement, event.currentTarget);
      form.normalBalance = event.currentTarget.getAttribute('data-value') === 'Debit'
        ? 'Debit'
        : 'Credit';
      host.shadowRoot?.getElementById('normal-balance-menu')?.hidePopover();
    }

    /** @param {string} value */
    function handleAccountTypeSelect(value) {
      form.accountType = value;
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

      const tx = await database.transaction('write');

      try {
        form.state = 'submitting';
        form.error = null;

        const data = new FormData(event.currentTarget);
        const accountCode = parseInt(/** @type {string} */(data.get('accountCode')), 10);
        const name = /** @type {string} */ (data.get('name'));
        const normalBalance = /** @type {string} */ (data.get('normalBalance'));
        const accountType = /** @type {string} */ (data.get('accountType'));

        if (isNaN(accountCode)) throw new Error('Invalid account code.');
        if (!name) throw new Error('Account name is required.');
        if (!['Debit', 'Credit'].includes(normalBalance)) throw new Error('Invalid normal balance.');
        if (!accountType) throw new Error('Account type is required.');

        await tx.sql`
          INSERT INTO accounts (account_code, name, normal_balance, control_account_code, create_time, update_time)
          VALUES (${accountCode}, ${name}, ${normalBalance === 'Debit' ? 0 : 1}, ${form.parentAccountCode}, ${Date.now()}, ${Date.now()});
        `;

        await tx.sql`
          INSERT INTO account_tags (account_code, tag)
          VALUES (${accountCode}, ${accountType});
        `;

        await tx.commit();

        form.state = 'success';
        await feedbackDelay();

        host.dispatchEvent(new CustomEvent('account-created', {
          detail: { accountCode },
          bubbles: true,
          composed: true,
        }));

        dialog.open = false;

        event.currentTarget.reset();
        clearParentAccount();

        form.normalBalance = null;
        form.accountType = null;
      } catch (error) {
        await tx.rollback();
        form.state = 'error';
        form.error = error instanceof Error ? error : new Error(String(error));
        await feedbackDelay();
      } finally {
        form.state = 'idle';
      }
    }

    useEffect(host, async function syncErrorAlertDialogState() {
      if (errorAlertDialog.value instanceof HTMLDialogElement) {
        if (form.error instanceof Error) errorAlertDialog.value.showModal();
        else errorAlertDialog.value.close();
      }
    });

    function handleDismissErrorDialog() { form.error = null; }

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
              <h2 id="account-creation-dialog-title">Create New Account</h2>
              <button
                role="button"
                type="button"
                class="text"
                commandfor="account-creation-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              <button role="button" type="submit" name="action">Create Account</button>
            </header>

            <div class="content">
              ${form.state !== 'idle' ? html`
                <div role="status" aria-live="polite" aria-busy="true">
                  <div role="progressbar" class="linear indeterminate">
                    <div class="track"><div class="indicator"></div></div>
                  </div>
                  <p>Creating account...</p>
                </div>
              ` : nothing}

              <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0px; max-width: 600px; margin: 0 auto;">

                <!-- Account Code -->
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="account-code-input">Account Code</label>
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
                  <div class="supporting-text">Unique numeric code for the account</div>
                </div>

                <!-- Account Name -->
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="account-name-input">Account Name</label>
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
                    <label for="normal-balance-input">Normal Balance</label>
                    <input type="hidden" name="normalBalance" value="${form.normalBalance ?? ''}">
                    <input
                      type="button"
                      id="normal-balance-input"
                      popovertarget="normal-balance-menu"
                      style="text-align: start;"
                      value="${form.normalBalance}"
                    />
                    <label for="normal-balance-input" class="trailing-icon">
                      <material-symbols name="arrow_drop_down"></material-symbols>
                    </label>
                  </div>
                </div>
                <menu id="normal-balance-menu" role="menu" popover class="dropdown" style="position-anchor: --normal-balance-menu-anchor;">
                  <li>
                    <button type="button" role="menuitem" data-value="Debit" @click=${handleNormalBalanceSelect}>
                      <span class="text">Debit</span>
                    </button>
                  </li>
                  <li>
                    <button type="button" role="menuitem" data-value="Credit" @click=${handleNormalBalanceSelect}>
                      <span class="text">Credit</span>
                    </button>
                  </li>
                </menu>

                <!-- Account Type -->
                <div class="outlined-text-field" style="anchor-name: --account-type-menu-anchor;">
                  <div class="container">
                    <label for="account-type-input">Account Type</label>
                    <input type="hidden" name="accountType" value="${form.accountType ?? ''}">
                    <input
                      type="button"
                      id="account-type-input"
                      popovertarget="account-type-menu"
                      style="text-align: start;"
                      value="${form.accountType ?? ''}"
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
                        <span class="text">${accountType}</span>
                      </button>
                    </li>
                  `)}
                </menu>

                <!-- Parent Account -->
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="parent-account-input">Parent Account (Optional)</label>
                    <input
                      id="parent-account-input"
                      type="button"
                      readonly
                      placeholder=" "
                      value="${form.parentAccountCode ? `${form.parentAccountCode} - ${form.parentAccountName}` : ''}"
                      commandfor="account-selector-dialog"
                      command="--open"
                    />
                    ${form.parentAccountCode ? html`
                      <button
                        type="button"
                        class="trailing-icon"
                        @click=${clearParentAccount}
                        aria-label="Clear parent account"
                      ><material-symbols name="close"></material-symbols></button>
                    ` : html`
                      <button
                        type="button"
                        class="trailing-icon"
                        commandfor="account-selector-dialog"
                        command="--open"
                        aria-label="Select parent account"
                      ><material-symbols name="search"></material-symbols></button>
                    `}
                  </div>
                  <div class="supporting-text">Select a parent account to make this a sub-account</div>
                </div>

              </div>
            </div>
          </form>
        </dialog>

        <dialog ${errorAlertDialog} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>Error</h3>
            </header>
            <div class="content">
              <p>${form.error?.message}</p>
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

        <account-selector-dialog
          id="account-selector-dialog"
          @account-select=${handleAccountSelect}
        ></account-selector-dialog>
      `);
    });
  }
}

defineWebComponent('account-creation-dialog', AccountCreationDialogElement);
