import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';
import '#web/components/account-selector-dialog.js';

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
    const t = useTranslator(host);

    const errorAlertDialog = useDialog(host);

    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const form = reactive({
      state: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      error: /** @type {Error | null} */ (null),
      accountCode: /** @type {number | null} */ (null),
      accountName: /** @type {string | null} */ (null),
    });

    /** @param {CustomEvent} event */
    function handleAccountSelect(event) {
      const detail = event.detail;
      form.accountCode = detail.accountCode;
      form.accountName = detail.accountName;
    }

    function clearAccount() {
      form.accountCode = null;
      form.accountName = null;
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
          if (result.rows.length > 0) input.setCustomValidity(t('paymentMethod', 'paymentMethodNameExistsError'));
        }
        catch (error) {
          input.setCustomValidity(t('paymentMethod', 'paymentMethodNameValidationError'));
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
        const minFee = parseInt(/** @type {string} */ (data.get('minFee')) || '0', 10) || 0;
        const maxFee = parseInt(/** @type {string} */ (data.get('maxFee')) || '0', 10) || 0;
        const relFeePercent = parseFloat(/** @type {string} */ (data.get('relFee')) || '0') || 0;

        // Convert percentage to internal representation (0.01% = 1, 100% = 1000000)
        const relFee = Math.round(relFeePercent * 10000);

        // Validate inputs
        if (!name) throw new Error(t('paymentMethod', 'paymentMethodNameRequiredError'));
        if (!form.accountCode) throw new Error(t('paymentMethod', 'accountRequiredError'));
        if (minFee < 0) throw new Error(t('paymentMethod', 'minimumFeeNegativeError'));
        if (maxFee < 0) throw new Error(t('paymentMethod', 'maximumFeeNegativeError'));
        if (maxFee > 0 && maxFee < minFee) throw new Error(t('paymentMethod', 'maximumFeeLessThanMinimumError'));
        if (relFee < 0 || relFee > 1000000) throw new Error(t('paymentMethod', 'relativeFeeRangeError'));

        // Verify account has POS - Payment Method tag
        const accountCheck = await tx.sql`
          SELECT 1 FROM account_tags
          WHERE account_code = ${form.accountCode}
            AND tag = 'POS - Payment Method'
          LIMIT 1;
        `;
        if (accountCheck.rows.length === 0) {
          throw new Error(t('paymentMethod', 'accountNotTaggedError'));
        }

        // Insert payment method
        const result = await tx.sql`
          INSERT INTO payment_methods (account_code, name, min_fee, max_fee, rel_fee)
          VALUES (${form.accountCode}, ${name}, ${minFee}, ${maxFee}, ${relFee})
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
        // Reset form
        event.currentTarget.reset();
        clearAccount();
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
              <h2 id="payment-method-creation-dialog-title">${t('paymentMethod', 'createDialogTitle')}</h2>
              <button
                role="button"
                type="button"
                class="text"
                aria-label="${t('paymentMethod', 'closeDialogAriaLabel')}"
                commandfor="payment-method-creation-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              <button role="button" type="submit" name="action">${t('paymentMethod', 'addButtonLabel')}</button>
            </header>

            <div class="content">
              ${form.state !== 'idle' ? html`
                <div role="status" aria-live="polite" aria-busy="true">
                  <div role="progressbar" class="linear indeterminate">
                    <div class="track"><div class="indicator"></div></div>
                  </div>
                  <p>${t('paymentMethod', 'creatingPaymentMethodMessage')}</p>
                </div>
              ` : nothing}

              <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0px; max-width: 600px; margin: 0 auto;">

                <!-- Payment Method Name -->
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="payment-method-name-input">${t('paymentMethod', 'nameLabel')}</label>
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
                  <div class="supporting-text">${t('paymentMethod', 'nameSupportingText')}</div>
                </div>

                <!-- Account Selection -->
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="account-input">${t('paymentMethod', 'accountLabel')}</label>
                    <input
                      id="account-input"
                      type="button"
                      readonly
                      required
                      placeholder=" "
                      value="${form.accountCode ? `${form.accountCode} - ${form.accountName}` : ''}"
                      commandfor="account-selector-dialog"
                      command="--open"
                    />
                    ${form.accountCode ? html`
                      <button
                        type="button"
                        class="trailing-icon"
                        @click=${clearAccount}
                        aria-label="${t('paymentMethod', 'clearAccountAriaLabel')}"
                      ><material-symbols name="close"></material-symbols></button>
                    ` : html`
                      <button
                        type="button"
                        class="trailing-icon"
                        commandfor="account-selector-dialog"
                        command="--open"
                        aria-label="${t('paymentMethod', 'selectAccountAriaLabel')}"
                      ><material-symbols name="search"></material-symbols></button>
                    `}
                  </div>
                  <div class="supporting-text">${t('paymentMethod', 'accountSupportingText')}</div>
                </div>

                <!-- Fee Configuration -->
                <fieldset style="border: 1px solid var(--md-sys-color-outline-variant); border-radius: var(--md-sys-shape-corner-medium); padding: 16px; margin: 0;">
                  <legend class="label-medium" style="padding: 0 8px; color: var(--md-sys-color-on-surface-variant);">${t('paymentMethod', 'feeConfigurationLegend')}</legend>
                  <div style="display: flex; flex-direction: column; gap: 16px;">
                    
                    <!-- Relative Fee -->
                    <div class="outlined-text-field">
                      <div class="container">
                        <label for="rel-fee-input">${t('paymentMethod', 'percentageFeeLabel')}</label>
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
                      <div class="supporting-text">${t('paymentMethod', 'percentageFeeSupportingText')}</div>
                    </div>

                    <div style="display: flex; gap: 16px;">
                      <!-- Min Fee -->
                      <div class="outlined-text-field" style="flex: 1;">
                        <div class="container">
                          <label for="min-fee-input">${t('paymentMethod', 'minimumFeeLabel')}</label>
                          <input
                            id="min-fee-input"
                            name="minFee"
                            type="number"
                            min="0"
                            placeholder=" "
                            value="0"
                          />
                        </div>
                        <div class="supporting-text">${t('paymentMethod', 'minimumFeeSupportingText')}</div>
                      </div>

                      <!-- Max Fee -->
                      <div class="outlined-text-field" style="flex: 1;">
                        <div class="container">
                          <label for="max-fee-input">${t('paymentMethod', 'maximumFeeLabel')}</label>
                          <input
                            id="max-fee-input"
                            name="maxFee"
                            type="number"
                            min="0"
                            placeholder=" "
                            value="0"
                          />
                        </div>
                        <div class="supporting-text">${t('paymentMethod', 'maximumFeeSupportingText')}</div>
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
              <h3>${t('paymentMethod', 'errorDialogTitle')}</h3>
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
                >${t('paymentMethod', 'dismissButtonLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>

        <account-selector-dialog
          id="account-selector-dialog"
          filter-tag="POS - Payment Method"
          @account-select=${handleAccountSelect}
        ></account-selector-dialog>
      `);
    });
  }
}

defineWebComponent('payment-method-creation-dialog', PaymentMethodCreationDialogElement);
