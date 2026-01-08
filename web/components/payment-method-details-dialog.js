import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';

/**
 * @typedef {object} PaymentMethodDetails
 * @property {number} id
 * @property {number} accountCode
 * @property {string} accountName
 * @property {string} name
 * @property {number} minFee
 * @property {number} maxFee
 * @property {number} relFee
 */

/**
 * @typedef {object} AccountOption
 * @property {number} accountCode
 * @property {string} name
 */

/**
 * Payment Method Details Dialog Component
 * 
 * @fires payment-method-updated - Fired when a payment method is successfully updated. Detail: { paymentMethodId: number }
 * @fires payment-method-deleted - Fired when a payment method is successfully deleted. Detail: { paymentMethodId: number }
 */
export class PaymentMethodDetailsDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);

    const errorAlertDialog = useDialog(host);
    const deleteConfirmDialog = useDialog(host);

    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      paymentMethod: /** @type {PaymentMethodDetails | null} */ (null),
      isLoading: false,
      loadError: /** @type {Error | null} */ (null),
      accounts: /** @type {AccountOption[]} */ ([]),
      isLoadingAccounts: false,
      selectedAccountCode: /** @type {number | null} */ (null),
      selectedAccountName: '',
      isEditing: false,
    });

    const form = reactive({
      state: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      error: /** @type {Error | null} */ (null),
    });

    async function loadPaymentMethod() {
      const paymentMethodId = parseInt(dialog.context?.dataset.paymentMethodId, 10);

      if (isNaN(paymentMethodId)) {
        state.paymentMethod = null;
        return;
      }

      try {
        state.isLoading = true;
        state.loadError = null;

        const result = await database.sql`
          SELECT
            pm.id,
            pm.account_code,
            a.name as account_name,
            pm.name,
            pm.min_fee,
            pm.max_fee,
            pm.rel_fee
          FROM payment_methods pm
          JOIN accounts a ON a.account_code = pm.account_code
          WHERE pm.id = ${paymentMethodId}
        `;

        if (result.rows.length === 0) {
          throw new Error(t('paymentMethod', 'paymentMethodNotFoundError'));
        }

        const row = result.rows[0];
        state.paymentMethod = {
          id: Number(row.id),
          accountCode: Number(row.account_code),
          accountName: String(row.account_name),
          name: String(row.name),
          minFee: Number(row.min_fee),
          maxFee: Number(row.max_fee),
          relFee: Number(row.rel_fee),
        };

        state.selectedAccountCode = state.paymentMethod.accountCode;
        state.selectedAccountName = state.paymentMethod.accountName;
        state.isLoading = false;
      }
      catch (error) {
        state.loadError = error instanceof Error ? error : new Error(String(error));
        state.isLoading = false;
      }
    }

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

    useEffect(host, function loadPaymentMethodOnOpen() {
      if (dialog.open && dialog.context) {
        state.isEditing = false;
        loadPaymentMethod();
      }
    });

    function startEditing() {
      state.isEditing = true;
      loadPaymentMethodAccounts();
    }

    function cancelEditing() {
      state.isEditing = false;
      if (state.paymentMethod) {
        state.selectedAccountCode = state.paymentMethod.accountCode;
        state.selectedAccountName = state.paymentMethod.accountName;
      }
    }

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
      if (name && state.paymentMethod && name !== state.paymentMethod.name) {
        try {
          const result = await database.sql`
            SELECT 1 FROM payment_methods WHERE name = ${name} AND id != ${state.paymentMethod.id} LIMIT 1;
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

      if (!state.paymentMethod) return;

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
        if (!name) throw new Error(t('paymentMethod', 'paymentMethodNameRequiredError'));
        if (!accountCode) throw new Error(t('paymentMethod', 'accountRequiredError'));
        if (minFee < 0) throw new Error(t('paymentMethod', 'minimumFeeNegativeError'));
        if (maxFee < 0) throw new Error(t('paymentMethod', 'maximumFeeNegativeError'));
        if (maxFee > 0 && maxFee < minFee) throw new Error(t('paymentMethod', 'maximumFeeLessThanMinimumError'));
        if (relFee < 0 || relFee > 1000000) throw new Error(t('paymentMethod', 'relativeFeeRangeError'));

        const paymentMethodId = state.paymentMethod.id;

        // Update payment method
        await tx.sql`
          UPDATE payment_methods
          SET account_code = ${accountCode}, name = ${name}, min_fee = ${minFee}, max_fee = ${maxFee}, rel_fee = ${relFee}
          WHERE id = ${paymentMethodId}
        `;

        await tx.commit();

        form.state = 'success';
        await feedbackDelay();

        host.dispatchEvent(new CustomEvent('payment-method-updated', {
          detail: { paymentMethodId },
          bubbles: true,
          composed: true,
        }));

        state.isEditing = false;
        loadPaymentMethod();
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

    function showDeleteConfirmation() {
      deleteConfirmDialog.open = true;
    }

    async function handleDelete() {
      if (!state.paymentMethod) return;

      const tx = await database.transaction('write');

      try {
        form.state = 'submitting';
        form.error = null;

        const paymentMethodId = state.paymentMethod.id;

        // Check if payment method is used in any sales
        const usageResult = await tx.sql`
          SELECT 1 FROM sale_payments WHERE payment_method_id = ${paymentMethodId} LIMIT 1;
        `;

        if (usageResult.rows.length > 0) {
          throw new Error(t('paymentMethod', 'paymentMethodUsedInSalesError'));
        }

        // Delete payment method
        await tx.sql`
          DELETE FROM payment_methods WHERE id = ${paymentMethodId}
        `;

        await tx.commit();

        form.state = 'success';
        await feedbackDelay();

        host.dispatchEvent(new CustomEvent('payment-method-deleted', {
          detail: { paymentMethodId },
          bubbles: true,
          composed: true,
        }));

        deleteConfirmDialog.open = false;
        dialog.open = false;
      }
      catch (error) {
        await tx.rollback();
        form.state = 'error';
        form.error = error instanceof Error ? error : new Error(String(error));
        deleteConfirmDialog.open = false;
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

    /**
     * Format fee percentage for display
     * @param {number} relFee - Fee value (0 - 1000000 represents 0% - 100%)
     * @returns {number}
     */
    function formatFeePercentageValue(relFee) {
      return relFee / 10000;
    }

    function renderLoadingState() {
      return html`
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; gap: 16px;">
          <div role="progressbar" class="linear indeterminate" style="width: 200px;">
            <div class="track"><div class="indicator"></div></div>
          </div>
          <p style="color: var(--md-sys-color-on-surface-variant);">${t('paymentMethod', 'loadingPaymentMethodMessage')}</p>
        </div>
      `;
    }

    /**
     * @param {Error} error
     */
    function renderErrorState(error) {
      return html`
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; gap: 16px; text-align: center;">
          <material-symbols name="error" size="48" style="color: var(--md-sys-color-error);"></material-symbols>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadPaymentMethod}>
            <material-symbols name="refresh"></material-symbols>
            ${t('paymentMethod', 'retryButtonLabel')}
          </button>
        </div>
      `;
    }

    function renderViewMode() {
      const pm = state.paymentMethod;
      if (!pm) return nothing;

      const hasFee = pm.relFee > 0 || pm.minFee > 0 || pm.maxFee > 0;

      return html`
        <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0px; max-width: 600px; margin: 0 auto;">
          
          <!-- Name -->
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <span class="label-medium" style="color: var(--md-sys-color-on-surface-variant);">${t('paymentMethod', 'nameFieldLabel')}</span>
            <span class="title-large">${pm.name}</span>
          </div>

          <!-- Account -->
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <span class="label-medium" style="color: var(--md-sys-color-on-surface-variant);">${t('paymentMethod', 'accountFieldLabel')}</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="label-large" style="color: var(--md-sys-color-primary);">${pm.accountCode}</span>
              <span class="body-large">${pm.accountName}</span>
            </div>
          </div>

          <!-- Fee Configuration -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <span class="label-medium" style="color: var(--md-sys-color-on-surface-variant);">${t('paymentMethod', 'feeConfigurationFieldLabel')}</span>
            ${hasFee ? html`
              <div style="display: flex; flex-wrap: wrap; gap: 12px;">
                ${pm.relFee > 0 ? html`
                  <div style="display: flex; flex-direction: column; gap: 4px; padding: 12px; background-color: var(--md-sys-color-tertiary-container); border-radius: var(--md-sys-shape-corner-medium);">
                    <span class="label-small" style="color: var(--md-sys-color-on-tertiary-container);">${t('paymentMethod', 'percentageFieldLabel')}</span>
                    <span class="title-medium" style="color: var(--md-sys-color-on-tertiary-container);">${formatFeePercentageValue(pm.relFee)}%</span>
                  </div>
                ` : nothing}
                ${pm.minFee > 0 ? html`
                  <div style="display: flex; flex-direction: column; gap: 4px; padding: 12px; background-color: var(--md-sys-color-secondary-container); border-radius: var(--md-sys-shape-corner-medium);">
                    <span class="label-small" style="color: var(--md-sys-color-on-secondary-container);">${t('paymentMethod', 'minimumFieldLabel')}</span>
                    <span class="title-medium" style="color: var(--md-sys-color-on-secondary-container);">${i18n.displayCurrency(pm.minFee)}</span>
                  </div>
                ` : nothing}
                ${pm.maxFee > 0 ? html`
                  <div style="display: flex; flex-direction: column; gap: 4px; padding: 12px; background-color: var(--md-sys-color-secondary-container); border-radius: var(--md-sys-shape-corner-medium);">
                    <span class="label-small" style="color: var(--md-sys-color-on-secondary-container);">${t('paymentMethod', 'maximumFieldLabel')}</span>
                    <span class="title-medium" style="color: var(--md-sys-color-on-secondary-container);">${i18n.displayCurrency(pm.maxFee)}</span>
                  </div>
                ` : nothing}
              </div>
            ` : html`
              <span class="body-medium" style="color: var(--md-sys-color-on-surface-variant);">${t('paymentMethod', 'noFeeConfiguredMessage')}</span>
            `}
          </div>

          <!-- Actions -->
          <div style="display: flex; gap: 12px; justify-content: flex-end; padding-top: 16px; border-top: 1px solid var(--md-sys-color-outline-variant);">
            <button role="button" class="text" style="color: var(--md-sys-color-error);" @click=${showDeleteConfirmation}>
              <material-symbols name="delete"></material-symbols>
              ${t('paymentMethod', 'deleteButtonLabel')}
            </button>
            <button role="button" class="tonal" @click=${startEditing}>
              <material-symbols name="edit"></material-symbols>
              ${t('paymentMethod', 'editButtonLabel')}
            </button>
          </div>
        </div>
      `;
    }

    function handleClearAccountSelection() {
      state.selectedAccountCode = null;
      state.selectedAccountName = '';
    }

    function renderEditMode() {
      const pm = state.paymentMethod;
      if (!pm) return nothing;

      return html`
        <form @submit=${handleSubmit} style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0px; max-width: 600px; margin: 0 auto;">
          ${form.state === 'submitting' ? html`
            <div role="status" aria-live="polite" aria-busy="true">
              <div role="progressbar" class="linear indeterminate">
                <div class="track"><div class="indicator"></div></div>
              </div>
              <p style="text-align: center; color: var(--md-sys-color-on-surface-variant);">${t('paymentMethod', 'savingChangesMessage')}</p>
            </div>
          ` : nothing}

          <!-- Payment Method Name -->
          <div class="outlined-text-field">
            <div class="container">
              <label for="edit-payment-method-name-input">${t('paymentMethod', 'nameLabel')}</label>
              <input
                id="edit-payment-method-name-input"
                name="name"
                type="text"
                placeholder=" "
                required
                autocomplete="off"
                value="${pm.name}"
                @blur=${validatePaymentMethodName}
              />
            </div>
          </div>

          <!-- Account Selection -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label class="label-medium" style="color: var(--md-sys-color-on-surface-variant);">${t('paymentMethod', 'accountLabel')}</label>
            ${state.isLoadingAccounts ? html`
              <div style="display: flex; align-items: center; gap: 8px; padding: 12px; background-color: var(--md-sys-color-surface-container); border-radius: var(--md-sys-shape-corner-medium);">
                <div role="progressbar" class="linear indeterminate" style="width: 100px;">
                  <div class="track"><div class="indicator"></div></div>
                </div>
                <span class="body-small">${t('paymentMethod', 'loadingAccountsMessage')}</span>
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
                    aria-label="${t('paymentMethod', 'clearSelectionAriaLabel')}"
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
          </div>

          <!-- Fee Configuration -->
          <fieldset style="border: 1px solid var(--md-sys-color-outline-variant); border-radius: var(--md-sys-shape-corner-medium); padding: 16px; margin: 0;">
            <legend class="label-medium" style="padding: 0 8px; color: var(--md-sys-color-on-surface-variant);">${t('paymentMethod', 'feeConfigurationFieldLabel')}</legend>
            <div style="display: flex; flex-direction: column; gap: 16px;">
              
              <!-- Relative Fee -->
              <div class="outlined-text-field">
                <div class="container">
                  <label for="edit-rel-fee-input">${t('paymentMethod', 'percentageFeeLabel')}</label>
                  <input
                    id="edit-rel-fee-input"
                    name="relFee"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder=" "
                    value="${formatFeePercentageValue(pm.relFee)}"
                  />
                </div>
              </div>

              <div style="display: flex; gap: 16px;">
                <!-- Min Fee -->
                <div class="outlined-text-field" style="flex: 1;">
                  <div class="container">
                    <label for="edit-min-fee-input">${t('paymentMethod', 'minimumFeeLabel')}</label>
                    <input
                      id="edit-min-fee-input"
                      name="minFee"
                      type="number"
                      min="0"
                      placeholder=" "
                      value="${pm.minFee}"
                    />
                  </div>
                </div>

                <!-- Max Fee -->
                <div class="outlined-text-field" style="flex: 1;">
                  <div class="container">
                    <label for="edit-max-fee-input">${t('paymentMethod', 'maximumFeeLabel')}</label>
                    <input
                      id="edit-max-fee-input"
                      name="maxFee"
                      type="number"
                      min="0"
                      placeholder=" "
                      value="${pm.maxFee}"
                    />
                  </div>
                </div>
              </div>
            </div>
          </fieldset>

          <!-- Actions -->
          <div style="display: flex; gap: 12px; justify-content: flex-end; padding-top: 16px;">
            <button role="button" type="button" class="text" @click=${cancelEditing} ?disabled=${form.state === 'submitting'}>
              ${t('paymentMethod', 'cancelButtonLabel')}
            </button>
            <button role="button" type="submit" class="filled" ?disabled=${form.state === 'submitting'}>
              <material-symbols name="save"></material-symbols>
              ${t('paymentMethod', 'saveChangesButtonLabel')}
            </button>
          </div>
        </form>
      `;
    }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="payment-method-details-dialog"
          class="full-screen"
          aria-labelledby="payment-method-details-dialog-title"
        >
          <div class="container">
            <header>
              <h2 id="payment-method-details-dialog-title">
                ${state.isEditing ? t('paymentMethod', 'editDialogTitle') : t('paymentMethod', 'detailsDialogTitle')}
              </h2>
              <button
                role="button"
                type="button"
                class="text"
                aria-label="${t('paymentMethod', 'closeDialogAriaLabel')}"
                commandfor="payment-method-details-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
            </header>

            <div class="content">
              ${state.isLoading ? renderLoadingState() : nothing}
              ${state.loadError instanceof Error ? renderErrorState(state.loadError) : nothing}
              ${!state.isLoading && !(state.loadError instanceof Error) && state.paymentMethod
                ? (state.isEditing ? renderEditMode() : renderViewMode())
                : nothing}
            </div>
          </div>
        </dialog>

        <dialog ${deleteConfirmDialog.element} id="delete-confirm-dialog" role="alertdialog">
          <div class="container">
            <material-symbols name="warning" style="color: var(--md-sys-color-error);"></material-symbols>
            <header>
              <h3>${t('paymentMethod', 'deleteConfirmTitle')}</h3>
            </header>
            <div class="content">
              <p>${t('paymentMethod', 'deleteConfirmMessage', state.paymentMethod?.name)}</p>
            </div>
            <menu>
              <li>
                <button role="button" type="button" class="text" commandfor="delete-confirm-dialog" command="close">
                  ${t('paymentMethod', 'cancelButtonLabel')}
                </button>
              </li>
              <li>
                <button role="button" type="button" class="filled" style="background-color: var(--md-sys-color-error);" @click=${handleDelete}>
                  ${t('paymentMethod', 'deleteButtonLabel')}
                </button>
              </li>
            </menu>
          </div>
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
      `);
    });
  }
}

defineWebComponent('payment-method-details-dialog', PaymentMethodDetailsDialogElement);
