import { html, nothing } from 'lit-html';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useBusyStateUntil, useReady } from '#web/contexts/ready-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { useMounted } from '#web/hooks/use-mounted.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';
import { scrollIntoView } from '#web/tools/dom.js';

import '#web/components/material-symbols.js';
import '#web/components/router-link.js';
import '#web/components/payment-method-creation-dialog.js';
import '#web/components/payment-method-details-dialog.js';

/**
 * @typedef {object} ConfigItem
 * @property {string} key
 * @property {string} value
 * @property {string | null} description
 */

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

export class SettingsViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const router = useContext(host, RouterContextElement);
    const t = useTranslator(host);

    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const accountingTabpanel = useElement(host, HTMLElement);
    const paymentsTabpanel = useElement(host, HTMLElement);
    const notfoundDialog = useElement(host, HTMLDialogElement);
    const successDialog = useElement(host, HTMLDialogElement);
    const errorAlertDialog = useElement(host, HTMLDialogElement);

    const state = reactive({
      // Accounting config
      config: /** @type {ConfigItem[]} */ ([]),
      isLoadingConfig: true,
      configError: /** @type {Error | null} */ (null),

      // Payment methods
      paymentMethods: /** @type {PaymentMethodItem[]} */ ([]),
      isLoadingPaymentMethods: true,
      paymentMethodsError: /** @type {Error | null} */ (null),

      // Payment method details
      selectedPaymentMethodId: /** @type {number | null} */ (null),

      // Config form state
      configFormState: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      configFormError: /** @type {Error | null} */ (null),
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoadingConfig === false && state.isLoadingPaymentMethods === false;
    });

    function syncRouteToTabpanel() {
      if (!(accountingTabpanel.value instanceof HTMLElement)) return;
      if (!(paymentsTabpanel.value instanceof HTMLElement)) return;
      if (!(notfoundDialog.value instanceof HTMLDialogElement)) return;
      notfoundDialog.value.close();
      const pathname = router.route.pathname;
      // Skip sync if we're at the base /settings or /settings/ - the mounted hook will redirect
      if (pathname === '/settings' || pathname === '/settings/') return;
      if (pathname.startsWith('/settings/accounting')) scrollIntoView(accountingTabpanel.value);
      else if (pathname.startsWith('/settings/payments')) scrollIntoView(paymentsTabpanel.value);
      else {
        if (notfoundDialog.value.isConnected) notfoundDialog.value.showModal();
        else {
          requestAnimationFrame(function waitForAnimationToShowModal() {
            if (notfoundDialog.value.isConnected) notfoundDialog.value.showModal();
            else console.warn('Cannot show notfound dialog because it is not connected to DOM');
          });
        }
      }
    }

    useEffect(host, syncRouteToTabpanel);
    useReady(host, syncRouteToTabpanel); // sync on ready for initial scrollIntoView to works
    useMounted(host, function evaluateDefaultRoute() {
      const pathname = router.route?.pathname;
      if (pathname === '/settings' || pathname === '/settings/') {
        router.navigate({ pathname: '/settings/accounting', replace: true });
      }
    });

    /** @param {Event} event */
    function handleTabpanelContainerScrollEnd(event) {
      const container = event.currentTarget;
      assertInstanceOf(HTMLElement, container);
      requestAnimationFrame(function makeSureScrollEndedByAnimationFrame() {
        requestIdleCallback(function makeSureScrollEndedByIdle() {
          const scrollLeft = container.scrollLeft;
          const containerWidth = container.clientWidth;
          const tabIndex = Math.round(scrollLeft / containerWidth);
          if (tabIndex === 0) router.navigate({ pathname: '/settings/accounting', replace: true });
          else if (tabIndex === 1) router.navigate({ pathname: '/settings/payments', replace: true });
          else router.navigate({ pathname: '/settings/accounting', replace: true });
        });
      });
    }

    async function loadConfig() {
      try {
        state.isLoadingConfig = true;
        state.configError = null;

        const result = await database.sql`
          SELECT key, value, description
          FROM config
          WHERE key NOT IN ('Schema Version')
          ORDER BY key ASC
        `;

        state.config = result.rows.map(function (row) {
          return /** @type {ConfigItem} */ ({
            key: String(row.key),
            value: String(row.value),
            description: row.description ? String(row.description) : null,
          });
        });

        state.isLoadingConfig = false;
      }
      catch (error) {
        state.configError = error instanceof Error ? error : new Error(String(error));
        state.isLoadingConfig = false;
      }
    }

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

        state.paymentMethods = result.rows.map(function (row) {
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

    useEffect(host, loadConfig);
    useEffect(host, loadPaymentMethods);

    /**
     * Get the input type for a config key
     * @param {string} key
     * @returns {'text' | 'number' | 'select'}
     */
    function getConfigInputType(key) {
      if (key === 'Currency Decimals' || key === 'Fiscal Year Start Month') return 'number';
      if (key === 'Business Type') return 'select';
      return 'text';
    }

    /**
     * Get the options for select config fields
     * @param {string} key
     * @returns {string[]}
     */
    function getConfigSelectOptions(key) {
      if (key === 'Business Type') {
        return ['Small Business', 'Medium Enterprise', 'Corporation', 'Non-Profit'];
      }
      return [];
    }

    /**
     * Get placeholder text for config fields
     * @param {string} key
     * @returns {string}
     */
    function getConfigPlaceholder(key) {
      if (key === 'Business Name') return 'e.g., My Store';
      if (key === 'Currency Code') return 'e.g., IDR, USD';
      if (key === 'Locale') return 'e.g., en-ID, id-ID';
      if (key === 'Fiscal Year Start Month') return '1-12';
      return '';
    }

    /** @param {SubmitEvent} event */
    async function handleConfigFormSubmit(event) {
      event.preventDefault();
      assertInstanceOf(HTMLFormElement, event.currentTarget);

      const tx = await database.transaction('write');

      try {
        state.configFormState = 'submitting';
        state.configFormError = null;

        const data = new FormData(event.currentTarget);
        const updateTime = Date.now();

        for (const [key, value] of data.entries()) {
          const trimmedValue = String(value).trim();
          await tx.sql`
            UPDATE config
            SET value = ${trimmedValue}, update_time = ${updateTime}
            WHERE key = ${key}
          `;
        }

        await tx.commit();

        state.configFormState = 'success';

        if (successDialog.value instanceof HTMLDialogElement) {
          successDialog.value.showModal();
        }

        await feedbackDelay();

        if (successDialog.value instanceof HTMLDialogElement) {
          successDialog.value.close();
        }

        state.configFormState = 'idle';

        // Reload config to reflect changes
        loadConfig();
      }
      catch (error) {
        await tx.rollback();
        state.configFormState = 'error';
        state.configFormError = error instanceof Error ? error : new Error(String(error));
      }
    }

    function handleDismissErrorDialog() {
      state.configFormError = null;
      state.configFormState = 'idle';
    }

    useEffect(host, function syncErrorAlertDialogState() {
      if (errorAlertDialog.value instanceof HTMLDialogElement) {
        if (state.configFormError instanceof Error && state.configFormState !== 'submitting') {
          errorAlertDialog.value.showModal();
        }
        else {
          errorAlertDialog.value.close();
        }
      }
    });

    /** @param {Event} event */
    function handlePaymentMethodRowInteraction(event) {
      if (!(event.target instanceof HTMLElement)) return;

      const closestRow = event.target.closest('tr[data-payment-method-id]');
      if (!(closestRow instanceof HTMLTableRowElement)) return;

      const paymentMethodId = Number(closestRow.dataset.paymentMethodId);
      if (isNaN(paymentMethodId)) return;

      const isOpeningAction = (event instanceof MouseEvent && event.type === 'click')
        || (event instanceof KeyboardEvent && ['Enter', ' '].includes(event.key));

      if (isOpeningAction) {
        state.selectedPaymentMethodId = paymentMethodId;
        const detailsDialog = host.shadowRoot?.getElementById('payment-method-details-dialog');
        if (detailsDialog) {
          detailsDialog.dispatchEvent(new CommandEvent('command', {
            command: '--open',
            bubbles: true,
            cancelable: true,
          }));
        }
        event.preventDefault();
      }
    }

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

    function renderAccountingConfigPanel() {
      if (state.isLoadingConfig) return renderLoadingIndicator();
      if (state.configError instanceof Error) return renderErrorNotice(state.configError, loadConfig);

      return html`
        <form @submit=${handleConfigFormSubmit} style="display: flex; flex-direction: column; gap: 24px; max-width: 600px;">
          ${state.configFormState === 'submitting' ? html`
            <div role="status" aria-live="polite" aria-busy="true">
              <div role="progressbar" class="linear indeterminate">
                <div class="track"><div class="indicator"></div></div>
              </div>
              <p style="text-align: center; color: var(--md-sys-color-on-surface-variant);">${t('settings', 'savingConfigurationMessage')}</p>
            </div>
          ` : nothing}

          ${state.config.map(function (item) {
        const inputType = getConfigInputType(item.key);
        const inputId = `config-${item.key.toLowerCase().replace(/\s+/g, '-')}-input`;

        if (inputType === 'select') {
          const options = getConfigSelectOptions(item.key);
          return html`
                <div class="outlined-text-field" style="anchor-name: --${inputId}-anchor;">
                  <div class="container">
                    <label for="${inputId}">${item.key}</label>
                    <input
                      id="${inputId}"
                      type="button"
                      value="${item.value || t('settings', 'selectPlaceholder')}"
                      popovertarget="${inputId}-menu"
                      popovertargetaction="show"
                      placeholder=" "
                    />
                    <input type="hidden" name="${item.key}" value="${item.value}" />
                    <label for="${inputId}" class="trailing-icon">
                      <material-symbols name="arrow_drop_down"></material-symbols>
                    </label>
                  </div>
                  ${item.description ? html`<div class="supporting-text">${item.description}</div>` : nothing}
                </div>
                <menu role="menu" popover id="${inputId}-menu" class="dropdown" style="position-anchor: --${inputId}-anchor;">
                  ${options.map(function (option) {
            return html`
                      <li>
                        <button
                          role="menuitem"
                          type="button"
                          @click=${function handleSelectOption(event) {
                assertInstanceOf(HTMLButtonElement, event.currentTarget);
                const form = event.currentTarget.closest('form');
                if (form instanceof HTMLFormElement) {
                  const hiddenInput = form.querySelector(`input[name="${item.key}"]`);
                  const displayInput = form.querySelector(`#${inputId}`);
                  if (hiddenInput instanceof HTMLInputElement) {
                    hiddenInput.value = option;
                  }
                  if (displayInput instanceof HTMLInputElement) {
                    displayInput.value = option;
                  }
                }
              }}
                          popovertarget="${inputId}-menu"
                          popovertargetaction="hide"
                          aria-selected=${option === item.value ? 'true' : 'false'}
                        >
                          ${option === item.value ? html`<material-symbols name="check"></material-symbols>` : ''}
                          ${option}
                        </button>
                      </li>
                    `;
          })}
                </menu>
              `;
        }

        return html`
              <div class="outlined-text-field">
                <div class="container">
                  <label for="${inputId}">${item.key}</label>
                  <input
                    id="${inputId}"
                    name="${item.key}"
                    type="${inputType === 'number' ? 'number' : 'text'}"
                    placeholder=" "
                    value="${item.value}"
                    ${inputType === 'number' && item.key === 'Fiscal Year Start Month' ? html`min="1" max="12"` : nothing}
                    ${inputType === 'number' && item.key === 'Currency Decimals' ? html`min="0" max="4"` : nothing}
                  />
                </div>
                ${item.description ? html`<div class="supporting-text">${item.description}</div>` : nothing}
              </div>
            `;
      })}

          <div style="display: flex; justify-content: flex-end; gap: 12px; padding-top: 16px;">
            <button
              role="button"
              type="button"
              class="text"
              @click=${loadConfig}
              ?disabled=${state.configFormState === 'submitting'}
            >
              <material-symbols name="refresh"></material-symbols>
              ${t('settings', 'resetButtonLabel')}
            </button>
            <button
              role="button"
              type="submit"
              class="filled"
              ?disabled=${state.configFormState === 'submitting'}
            >
              <material-symbols name="save"></material-symbols>
              ${t('settings', 'saveChangesButtonLabel')}
            </button>
          </div>
        </form>
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
        <tr
          tabindex="0"
          aria-label="Payment method ${paymentMethod.name}"
          data-payment-method-id="${paymentMethod.id}"
          @click=${handlePaymentMethodRowInteraction}
          @keydown=${handlePaymentMethodRowInteraction}
        >
          <td class="label-large" style="color: var(--md-sys-color-primary);">${paymentMethod.name}</td>
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

    useEffect(host, function renderSettingsView() {
      render(html`
        <div style="height: 100%; display: flex; flex-direction: column;">
          <header class="app-bar" style="max-width: 1280px; margin: 0 auto; width: 100%; flex-shrink: 0;">
            <hgroup>
              <h1>${t('settings', 'settingsTitle')}</h1>
              <p>${t('settings', 'settingsDescription')}</p>
            </hgroup>
          </header>
          <nav
            role="tablist"
            aria-label="${t('settings', 'settingsSectionsAriaLabel')}"
            style="position: sticky; top: 0; z-index: 1; max-width: 1280px; margin: 0 auto; width: 100%; flex-shrink: 0;"
          >
            <router-link role="tab" aria-controls="accounting-panel" href="/settings/accounting" replace>
              <span class="content">
                <material-symbols name="settings" size="24"></material-symbols>
                ${t('settings', 'accountingConfigTabLabel')}
              </span>
            </router-link>
            <router-link role="tab" aria-controls="payments-panel" href="/settings/payments" replace>
              <span class="content">
                <material-symbols name="payments" size="24"></material-symbols>
                ${t('settings', 'paymentMethodsTabLabel')}
              </span>
            </router-link>
          </nav>
          <main
            @scrollend=${handleTabpanelContainerScrollEnd}
            style="
              flex: 1;
              display: flex;
              flex-direction: row;
              width: 100%;
              max-width: 1280px;
              margin: 0 auto;
              overflow-x: auto;
              overflow-y: hidden;
              overscroll-behavior-x: contain;
              scroll-snap-type: x mandatory;
              scroll-behavior: smooth;
              scrollbar-width: none;
            "
          >
            <div
              ${accountingTabpanel}
              id="accounting-panel"
              role="tabpanel"
              aria-label="${t('settings', 'accountingConfigTabLabel')}"
              aria-hidden="${router.route.pathname.startsWith('/settings/accounting') ? 'false' : 'true'}"
              tabindex="${router.route.pathname.startsWith('/settings/accounting') ? '0' : '-1'}"
              ?inert=${router.route.pathname.startsWith('/settings/accounting') === false}
              style="
                flex: 0 0 100%;
                width: 100%;
                min-width: 0;
                scroll-snap-align: start;
                scroll-snap-stop: always;
                overflow-y: auto;
                padding: 24px;
                box-sizing: border-box;
              "
            >
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 class="title-large" style="margin: 0;">${t('settings', 'accountingConfigurationTitle')}</h2>
                <button role="button" class="text" @click=${loadConfig} aria-label="${t('settings', 'refreshConfigurationAriaLabel')}">
                  <material-symbols name="refresh"></material-symbols>
                  ${t('settings', 'refreshButtonLabel')}
                </button>
              </div>
              ${renderAccountingConfigPanel()}
            </div>
            <div
              ${paymentsTabpanel}
              id="payments-panel"
              role="tabpanel"
              aria-label="${t('settings', 'paymentMethodsTabLabel')}"
              aria-hidden="${router.route.pathname.startsWith('/settings/payments') ? 'false' : 'true'}"
              tabindex="${router.route.pathname.startsWith('/settings/payments') ? '0' : '-1'}"
              ?inert=${router.route.pathname.startsWith('/settings/payments') === false}
              style="
                flex: 0 0 100%;
                width: 100%;
                min-width: 0;
                scroll-snap-align: start;
                scroll-snap-stop: always;
                overflow-y: auto;
                padding: 24px;
                box-sizing: border-box;
              "
            >
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
          </main>
        </div>

        <dialog ${notfoundDialog} id="notfound-dialog">
          <div class="container">
            <header>
              <h2>${t('settings', 'pageNotFoundTitle')}</h2>
            </header>
            <section class="content">
              <p>${t('settings', 'pageNotFoundMessage')}</p>
            </section>
            <menu>
              <router-link
                href="/settings/accounting"
                replace
              >${t('settings', 'goToAccountingConfigButtonLabel')}</router-link>
            </menu>
          </div>
        </dialog>

        <dialog ${successDialog} id="success-dialog" aria-labelledby="success-dialog-title">
          <div class="container">
            <material-symbols name="check_circle" style="color: var(--md-sys-color-primary);"></material-symbols>
            <header>
              <h3 id="success-dialog-title">${t('settings', 'settingsSavedTitle')}</h3>
            </header>
            <div class="content">
              <p>${t('settings', 'settingsSavedMessage')}</p>
            </div>
          </div>
        </dialog>

        <dialog ${errorAlertDialog} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>${t('settings', 'errorOccurredTitle')}</h3>
            </header>
            <div class="content">
              <p>${state.configFormError?.message}</p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  @click=${handleDismissErrorDialog}
                >${t('settings', 'dismissButtonLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>

        <payment-method-creation-dialog
          id="payment-method-creation-dialog"
          @payment-method-created=${loadPaymentMethods}
        ></payment-method-creation-dialog>

        <payment-method-details-dialog
          id="payment-method-details-dialog"
          payment-method-id=${state.selectedPaymentMethodId}
          @payment-method-updated=${loadPaymentMethods}
          @payment-method-deleted=${loadPaymentMethods}
        ></payment-method-details-dialog>
      `);
    });
  }
}

defineWebComponent('settings-view', SettingsViewElement);
