import { html } from 'lit-html';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';

import '#web/components/material-symbols.js';
import '#web/components/payment-method-creation-dialog.js';
import '#web/components/payment-method-details-dialog.js';

/**
 * @typedef {object} PaymentMethodItem
 * @property {number} id
 * @property {number} accountCode
 * @property {string} accountName
 * @property {string} name
 * @property {number} minFee
 * @property {number} maxFee
 * @property {number} relFee
 */

export class PaymentMethodsViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);

    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      paymentMethods: /** @type {PaymentMethodItem[]} */ ([]),
      isLoadingPaymentMethods: true,
      paymentMethodsError: /** @type {Error | null} */ (null),
      selectedPaymentMethodId: /** @type {number | null} */ (null),
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoadingPaymentMethods === false;
    });

    async function loadPaymentMethods() {
      try {
        state.isLoadingPaymentMethods = true;
        state.paymentMethodsError = null;

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
          ORDER BY pm.name ASC
        `;

        state.paymentMethods = result.rows.map(function rowToPaymentMethod(row) {
          return /** @type {PaymentMethodItem} */ ({
            id: Number(row.id),
            accountCode: Number(row.account_code),
            accountName: String(row.account_name),
            name: String(row.name),
            minFee: Number(row.min_fee),
            maxFee: Number(row.max_fee),
            relFee: Number(row.rel_fee),
          });
        });

        state.isLoadingPaymentMethods = false;
      }
      catch (error) {
        state.paymentMethodsError = error instanceof Error ? error : new Error(String(error));
        state.isLoadingPaymentMethods = false;
      }
    }

    useEffect(host, loadPaymentMethods);

    /**
     * Format fee percentage for display
     * @param {number} relFee - Fee value (0 - 1000000 represents 0% - 100%)
     * @returns {string}
     */
    function formatFeePercentage(relFee) {
      const percentage = relFee / 10000;
      return `${percentage.toFixed(2)}%`;
    }

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label="${t('settings', 'loadingAriaLabel')}"
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            min-height: 200px;
            color: var(--md-sys-color-on-surface-variant);
          "
        >
          <div role="progressbar" class="linear indeterminate" style="width: 200px;">
            <div class="track">
              <div class="indicator"></div>
            </div>
          </div>
          <p>${t('settings', 'loadingMessage')}</p>
        </div>
      `;
    }

    /**
     * @param {Error} error
     * @param {function} retryFn
     */
    function renderErrorNotice(error, retryFn) {
      return html`
        <div
          role="alert"
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            min-height: 200px;
            text-align: center;
            padding: 24px;
          "
        >
          <material-symbols name="error" size="48"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('settings', 'unableToLoadDataTitle')}</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${retryFn}>
            <material-symbols name="refresh"></material-symbols>
            ${t('settings', 'retryButtonLabel')}
          </button>
        </div>
      `;
    }

    function renderPaymentMethodsEmptyState() {
      return html`
        <div
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            min-height: 300px;
            text-align: center;
            padding: 48px;
          "
        >
          <material-symbols name="payments" size="64"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('settings', 'noPaymentMethodsTitle')}</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            ${t('settings', 'noPaymentMethodsMessage')}
          </p>
          <button
            role="button"
            type="button"
            class="tonal"
            commandfor="payment-method-creation-dialog"
            command="--open"
          >
            <material-symbols name="add"></material-symbols>
            ${t('settings', 'addPaymentMethodButtonLabel')}
          </button>
        </div>
      `;
    }

    /**
     * @param {PaymentMethodItem} paymentMethod
     */
    function renderPaymentMethodRow(paymentMethod) {
      const hasFee = paymentMethod.relFee > 0 || paymentMethod.minFee > 0 || paymentMethod.maxFee > 0;

      return html`
        <tr aria-label="Payment method ${paymentMethod.name}">
          <td class="label-large" style="color: var(--md-sys-color-primary);">
            <button
              role="button"
              type="button"
              class="text extra-small"
              style="--md-sys-density: -4;"
              commandfor="payment-method-details-dialog"
              command="--open"
            >${paymentMethod.name}</button>
          </td>
          <td>
            <span style="display: flex; align-items: center; gap: 8px;">
              <span class="label-medium" style="color: var(--md-sys-color-secondary);">${paymentMethod.accountCode}</span>
              <span>${paymentMethod.accountName}</span>
            </span>
          </td>
          <td class="center">
            ${hasFee ? html`
              <span
                class="label-small"
                style="
                  display: inline-flex;
                  padding: 4px 8px;
                  border-radius: var(--md-sys-shape-corner-small);
                  background-color: var(--md-sys-color-tertiary-container);
                  color: var(--md-sys-color-on-tertiary-container);
                "
              >
                ${paymentMethod.relFee > 0 ? formatFeePercentage(paymentMethod.relFee) : ''}
                ${paymentMethod.relFee > 0 && (paymentMethod.minFee > 0 || paymentMethod.maxFee > 0) ? ' + ' : ''}
                ${paymentMethod.minFee > 0 ? `min ${i18n.displayCurrency(paymentMethod.minFee)}` : ''}
                ${paymentMethod.minFee > 0 && paymentMethod.maxFee > 0 ? ', ' : ''}
                ${paymentMethod.maxFee > 0 ? `max ${i18n.displayCurrency(paymentMethod.maxFee)}` : ''}
              </span>
            ` : html`
              <span
                class="label-small"
                style="
                  display: inline-flex;
                  padding: 4px 8px;
                  border-radius: var(--md-sys-shape-corner-small);
                  background-color: var(--md-sys-color-surface-container-high);
                  color: var(--md-sys-color-on-surface-variant);
                "
              >${t('settings', 'noFeeLabel')}</span>
            `}
          </td>
        </tr>
      `;
    }

    function renderPaymentMethodsPanel() {
      if (state.isLoadingPaymentMethods) return renderLoadingIndicator();
      if (state.paymentMethodsError instanceof Error) return renderErrorNotice(state.paymentMethodsError, loadPaymentMethods);
      if (state.paymentMethods.length === 0) return renderPaymentMethodsEmptyState();

      return html`
        <table aria-label="Payment methods list" style="--md-sys-density: -3;">
          <thead>
            <tr>
              <th scope="col">${t('settings', 'nameColumnHeader')}</th>
              <th scope="col">${t('settings', 'accountColumnHeader')}</th>
              <th scope="col" class="center" style="width: 200px;">${t('settings', 'feeColumnHeader')}</th>
            </tr>
          </thead>
          <tbody>
            ${state.paymentMethods.map(renderPaymentMethodRow)}
          </tbody>
        </table>
      `;
    }

    useEffect(host, function renderPaymentMethodsView() {
      render(html`
        <div style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 12px 24px; height: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
            <h2 class="title-large" style="margin: 0;">${t('settings', 'paymentMethodsTitle')}</h2>
            <div style="display: flex; gap: 12px; align-items: center;">
              <button role="button" class="text" @click=${loadPaymentMethods} aria-label="${t('settings', 'refreshPaymentMethodsAriaLabel')}">
                <material-symbols name="refresh"></material-symbols>
                ${t('settings', 'refreshButtonLabel')}
              </button>
              <button
                role="button"
                type="button"
                class="tonal"
                commandfor="payment-method-creation-dialog"
                command="--open"
              >
                <material-symbols name="add"></material-symbols>
                ${t('settings', 'addPaymentMethodButtonLabel')}
              </button>
            </div>
          </div>
          ${renderPaymentMethodsPanel()}
        </div>

        <payment-method-creation-dialog
          id="payment-method-creation-dialog"
          @payment-method-created=${loadPaymentMethods}
        ></payment-method-creation-dialog>

        <payment-method-details-dialog
          id="payment-method-details-dialog"
          @payment-method-updated=${loadPaymentMethods}
          @payment-method-deleted=${loadPaymentMethods}
        ></payment-method-details-dialog>
      `);
    });
  }
}

defineWebComponent('payment-methods-view', PaymentMethodsViewElement);
