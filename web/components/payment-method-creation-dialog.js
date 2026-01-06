import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';
import '#web/components/account-selector-dialog.js';

/**
 * @typedef {object} AccountOption
 * @property {number} accountCode
 * @property {string} name
 */

/**
 * Payment Method Creation Dialog Component
 * 
 * @fires payment-method-created - Fired when a payment method is successfully created. Detail: { paymentMethodId: number }
 */
export class PaymentMethodCreationDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);

    const errorAlertDialog = useDialog(host);

    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      accounts: /** @type {AccountOption[]} */ ([]),
      isLoadingAccounts: false,
      selectedAccountCode: /** @type {number | null} */ (null),
      selectedAccountName: '',
    });

    const form = reactive({
      state: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      error: /** @type {Error | null} */ (null),
    });

    async function loadPaymentMethodAccounts() {
      try {
        state.isLoadingAccounts = true;

        const result = await database.sql`
          SELECT a.account_code, a.name
          FROM accounts a
          JOIN account_tags at ON a.account_code = at.account_code
          WHERE at.tag = 'POS - Payment Method'
            AND a.is_active = 1
            AND a.is_posting_account = 1
          ORDER BY a.account_code ASC
        `;

        state.accounts = result.rows.map(function (row) {
          return /** @type {AccountOption} */ ({
            accountCode: Number(row.account_code),
            name: String(row.name),
          });
        });

        state.isLoadingAccounts = false;
      }
      catch (error) {
        state.isLoadingAccounts = false;
        console.error('Failed to load payment method accounts:', error);
      }
    }

    useEffect(host, function loadAccountsOnOpen() {
      if (dialog.open) {
        loadPaymentMethodAccounts();
        // Reset selection when dialog opens
        state.selectedAccountCode = null;
        state.selectedAccountName = '';
      }
    });

    /** @param {Event} event */
    function handleAccountSelect(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      const accountCode = Number(event.currentTarget.dataset.accountCode);
      const accountName = event.currentTarget.dataset.accountName || '';
      state.selectedAccountCode = accountCode;
      state.selectedAccountName = accountName;
    }

    /** @param {FocusEvent} event */
    async function validatePaymentMethodName(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      const input = event.currentTarget;
      const name = input.value.trim();
      input.setCustomValidity('');
      if (name) {
        try {
          const result = await database.sql`
            SELECT 1 FROM payment_methods WHERE name = ${name} LIMIT 1;
          `;
          if (result.rows.length > 0) input.setCustomValidity('Payment method name already exists.');
        }
        catch (error) {
          input.setCustomValidity('Error validating payment method name.');
        }
      }
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
        const name = /** @type {string} */ (data.get('name'))?.trim();
        const accountCode = state.selectedAccountCode;
        const minFee = parseInt(/** @type {string} */ (data.get('minFee')) || '0', 10) || 0;
        const maxFee = parseInt(/** @type {string} */ (data.get('maxFee')) || '0', 10) || 0;
        const relFeePercent = parseFloat(/** @type {string} */ (data.get('relFee')) || '0') || 0;

        // Convert percentage to internal representation (0.01% = 1, 100% = 1000000)
        const relFee = Math.round(relFeePercent * 10000);

        // Validate inputs
        if (!name) throw new Error('Payment method name is required.');
        if (!accountCode) throw new Error('Please select an account.');
        if (minFee < 0) throw new Error('Minimum fee cannot be negative.');
        if (maxFee < 0) throw new Error('Maximum fee cannot be negative.');
        if (maxFee > 0 && maxFee < minFee) throw new Error('Maximum fee cannot be less than minimum fee.');
        if (relFee < 0 || relFee > 1000000) throw new Error('Relative fee percentage must be between 0% and 100%.');

        // Insert payment method
        const result = await tx.sql`
          INSERT INTO payment_methods (account_code, name, min_fee, max_fee, rel_fee)
          VALUES (${accountCode}, ${name}, ${minFee}, ${maxFee}, ${relFee})
          RETURNING id;
        `;

        const paymentMethodId = Number(result.rows[0].id);

        await tx.commit();

        form.state = 'success';
        await feedbackDelay();

        host.dispatchEvent(new CustomEvent('payment-method-created', {
          detail: { paymentMethodId },
          bubbles: true,
          composed: true,
        }));

        dialog.open = false;
        // Reset form and state
        event.currentTarget.reset();
        state.selectedAccountCode = null;
        state.selectedAccountName = '';
      }
      catch (error) {
        await tx.rollback();
        form.state = 'error';
        form.error = error instanceof Error ? error : new Error(String(error));
        await feedbackDelay();
      }
      finally {
        form.state = 'idle';
      }
    }

    useEffect(host, function syncErrorAlertDialogState() {
      if (form.error instanceof Error) errorAlertDialog.open = true;
      else errorAlertDialog.open = false;
    });

    function handleDismissErrorDialog() { form.error = null; }

    function handleClearAccountSelection() {
      state.selectedAccountCode = null;
      state.selectedAccountName = '';
    }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="payment-method-creation-dialog"
          class="full-screen"
          aria-labelledby="payment-method-creation-dialog-title"
        >
          <form class="container" @submit=${handleSubmit}>
            <header>
              <h2 id="payment-method-creation-dialog-title">Add Payment Method</h2>
              <button
                role="button"
                type="button"
                class="text"
                aria-label="Close dialog"
                commandfor="payment-method-creation-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              <button role="button" type="submit" name="action">Add</button>
            </header>

            <div class="content">
              ${form.state !== 'idle' ? html`
                <div role="status" aria-live="polite" aria-busy="true">
                  <div role="progressbar" class="linear indeterminate">
                    <div class="track"><div class="indicator"></div></div>
                  </div>
                  <p>${form.state === 'submitting' ? 'Creating payment method...' : form.state === 'success' ? 'Payment method created!' : ''}</p>
                </div>
              ` : nothing}

              <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0px; max-width: 600px; margin: 0 auto;">

                <!-- Payment Method Name -->
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="payment-method-name-input">Name</label>
                    <input
                      id="payment-method-name-input"
                      name="name"
                      type="text"
                      placeholder=" "
                      required
                      autocomplete="off"
                      @blur=${validatePaymentMethodName}
                    />
                  </div>
                  <div class="supporting-text">e.g., "Cash", "Bank Transfer", "QRIS"</div>
                </div>

                <!-- Account Selection -->
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label class="label-medium" style="color: var(--md-sys-color-on-surface-variant);">Account</label>
                  ${state.isLoadingAccounts ? html`
                    <div style="display: flex; align-items: center; gap: 8px; padding: 12px; background-color: var(--md-sys-color-surface-container); border-radius: var(--md-sys-shape-corner-medium);">
                      <div role="progressbar" class="linear indeterminate" style="width: 100px;">
                        <div class="track"><div class="indicator"></div></div>
                      </div>
                      <span class="body-small">Loading accounts...</span>
                    </div>
                  ` : state.accounts.length === 0 ? html`
                    <div style="padding: 16px; background-color: var(--md-sys-color-error-container); border-radius: var(--md-sys-shape-corner-medium); color: var(--md-sys-color-on-error-container);">
                      <p class="body-medium" style="margin: 0;">
                        No accounts found with "POS - Payment Method" tag. 
                        Please create an account and assign the tag first.
                      </p>
                    </div>
                  ` : html`
                    ${state.selectedAccountCode ? html`
                      <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background-color: var(--md-sys-color-primary-container); border-radius: var(--md-sys-shape-corner-medium);">
                        <material-symbols name="account_balance" style="color: var(--md-sys-color-on-primary-container);"></material-symbols>
                        <div style="flex: 1;">
                          <span class="label-medium" style="color: var(--md-sys-color-on-primary-container);">${state.selectedAccountCode}</span>
                          <span class="body-medium" style="margin-left: 8px; color: var(--md-sys-color-on-primary-container);">${state.selectedAccountName}</span>
                        </div>
                        <button
                          role="button"
                          type="button"
                          class="text"
                          @click=${handleClearAccountSelection}
                          aria-label="Clear selection"
                        >
                          <material-symbols name="close"></material-symbols>
                        </button>
                      </div>
                    ` : html`
                      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${state.accounts.map(function (account) {
                          return html`
                            <button
                              role="button"
                              type="button"
                              class="outlined"
                              data-account-code="${account.accountCode}"
                              data-account-name="${account.name}"
                              @click=${handleAccountSelect}
                            >
                              <span class="label-medium">${account.accountCode}</span>
                              ${account.name}
                            </button>
                          `;
                        })}
                      </div>
                    `}
                  `}
                  <div class="supporting-text">Select the account for this payment method</div>
                </div>

                <!-- Fee Configuration -->
                <fieldset style="border: 1px solid var(--md-sys-color-outline-variant); border-radius: var(--md-sys-shape-corner-medium); padding: 16px; margin: 0;">
                  <legend class="label-medium" style="padding: 0 8px; color: var(--md-sys-color-on-surface-variant);">Fee Configuration (Optional)</legend>
                  <div style="display: flex; flex-direction: column; gap: 16px;">
                    
                    <!-- Relative Fee -->
                    <div class="outlined-text-field">
                      <div class="container">
                        <label for="rel-fee-input">Percentage Fee (%)</label>
                        <input
                          id="rel-fee-input"
                          name="relFee"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder=" "
                          value="0"
                        />
                      </div>
                      <div class="supporting-text">Fee as percentage of transaction amount (e.g., 0.7 for 0.7%)</div>
                    </div>

                    <div style="display: flex; gap: 16px;">
                      <!-- Min Fee -->
                      <div class="outlined-text-field" style="flex: 1;">
                        <div class="container">
                          <label for="min-fee-input">Minimum Fee</label>
                          <input
                            id="min-fee-input"
                            name="minFee"
                            type="number"
                            min="0"
                            placeholder=" "
                            value="0"
                          />
                        </div>
                        <div class="supporting-text">Minimum fee per transaction</div>
                      </div>

                      <!-- Max Fee -->
                      <div class="outlined-text-field" style="flex: 1;">
                        <div class="container">
                          <label for="max-fee-input">Maximum Fee</label>
                          <input
                            id="max-fee-input"
                            name="maxFee"
                            type="number"
                            min="0"
                            placeholder=" "
                            value="0"
                          />
                        </div>
                        <div class="supporting-text">Maximum fee cap (0 = no limit)</div>
                      </div>
                    </div>
                  </div>
                </fieldset>

              </div>
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
      `);
    });
  }
}

defineWebComponent('payment-method-creation-dialog', PaymentMethodCreationDialogElement);
