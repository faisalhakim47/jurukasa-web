import { html, nothing } from 'lit-html';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';

export class AccountingConfigurationViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const t = useTranslator(host);

    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const successDialog = useElement(host, HTMLDialogElement);
    const errorAlertDialog = useElement(host, HTMLDialogElement);

    const state = reactive({
      businessName: '',
      businessType: '',
      currencyCode: '',
      currencyDecimals: '',
      fiscalYearStartMonth: '',
      language: '',
      locale: '',
      isLoadingConfig: true,
      configError: /** @type {Error | null} */ (null),
      configFormState: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      configFormError: /** @type {Error | null} */ (null),
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoadingConfig === false;
    });

    async function loadConfig() {
      try {
        state.isLoadingConfig = true;
        state.configError = null;

        const result = await database.sql`
          SELECT key, value
          FROM config
          WHERE key IN ('Business Name', 'Business Type', 'Currency Code', 'Currency Decimals', 'Fiscal Year Start Month', 'Language', 'Locale')
        `;

        for (const row of result.rows) {
          const key = String(row.key);
          const value = String(row.value);

          if (key === 'Business Name') state.businessName = value;
          else if (key === 'Business Type') state.businessType = value;
          else if (key === 'Currency Code') state.currencyCode = value;
          else if (key === 'Currency Decimals') state.currencyDecimals = value;
          else if (key === 'Fiscal Year Start Month') state.fiscalYearStartMonth = value;
          else if (key === 'Language') state.language = value;
          else if (key === 'Locale') state.locale = value;
        }

        state.isLoadingConfig = false;
      }
      catch (error) {
        state.configError = error instanceof Error ? error : new Error(String(error));
        state.isLoadingConfig = false;
      }
    }

    useEffect(host, loadConfig);

    /** @param {SubmitEvent} event */
    async function handleConfigFormSubmit(event) {
      event.preventDefault();
      assertInstanceOf(HTMLFormElement, event.currentTarget);
      const form = event.currentTarget;

      const tx = await database.transaction('write');

      try {
        state.configFormState = 'submitting';
        state.configFormError = null;

        const data = new FormData(form);
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
      }
      catch (error) {
        state.configFormState = 'error';
        state.configFormError = error instanceof Error ? error : new Error(String(error));
        await tx.rollback();
      }
      finally {
        await loadConfig();
      }
    }

    function handleDismissErrorDialog() {
      console.trace('handleDismissErrorDialog');
      state.configFormError = null;
      state.configFormState = 'idle';
    }

    useEffect(host, function syncErrorAlertDialogState() {
      if (errorAlertDialog.value instanceof HTMLDialogElement) {
        if (state.configFormError instanceof Error && state.configFormState !== 'submitting') errorAlertDialog.value.showModal();
        else errorAlertDialog.value.close();
      }
    });

    /** @param {MouseEvent} event */
    function handleSelectBusinessType(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      const selectedValue = event.currentTarget.dataset.value || '';
      const form = event.currentTarget.closest('form');
      if (form instanceof HTMLFormElement) {
        const hiddenInput = form.querySelector('input[name="Business Type"]');
        const displayInput = form.querySelector('#business-type-input');
        if (hiddenInput instanceof HTMLInputElement) {
          hiddenInput.value = selectedValue;
        }
        if (displayInput instanceof HTMLInputElement) {
          displayInput.value = selectedValue;
        }
      }
    }

    /** @param {MouseEvent} event */
    function handleSelectLanguage(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      const selectedValue = event.currentTarget.dataset.value || '';
      const displayName = event.currentTarget.dataset.displayName || selectedValue;
      const form = event.currentTarget.closest('form');
      if (form instanceof HTMLFormElement) {
        const hiddenInput = form.querySelector('input[name="Language"]');
        const displayInput = form.querySelector('#language-input');
        if (hiddenInput instanceof HTMLInputElement) {
          hiddenInput.value = selectedValue;
        }
        if (displayInput instanceof HTMLInputElement) {
          displayInput.value = displayName;
        }
      }
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

    function getLanguageDisplayName(langCode) {
      if (langCode === 'en') return 'English';
      if (langCode === 'id') return 'Bahasa Indonesia';
      return langCode;
    }

    function renderAccountingConfigPanel() {
      if (state.isLoadingConfig) return renderLoadingIndicator();
      if (state.configError instanceof Error) return renderErrorNotice(state.configError, loadConfig);

      const languageDisplayValue = state.language ? getLanguageDisplayName(state.language) : t('settings', 'selectPlaceholder');
      const businessTypeDisplayValue = state.businessType || t('settings', 'selectPlaceholder');

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

          <div class="outlined-text-field">
            <div class="container">
              <label for="business-name-input">Business Name</label>
              <input
                id="business-name-input"
                name="Business Name"
                type="text"
                placeholder=" "
                value="${state.businessName}"
              />
            </div>
          </div>

          <div class="outlined-text-field" style="anchor-name: --business-type-input-anchor;">
            <div class="container">
              <label for="business-type-input">Business Type</label>
              <input
                id="business-type-input"
                type="button"
                value="${businessTypeDisplayValue}"
                popovertarget="business-type-input-menu"
                popovertargetaction="show"
                placeholder=" "
              />
              <input type="hidden" name="Business Type" value="${state.businessType}" />
              <label for="business-type-input" class="trailing-icon">
                <material-symbols name="arrow_drop_down"></material-symbols>
              </label>
            </div>
          </div>
          <menu role="menu" popover id="business-type-input-menu" class="dropdown" style="position-anchor: --business-type-input-anchor;">
            <li>
              <button
                role="menuitem"
                type="button"
                data-value="Small Business"
                @click=${handleSelectBusinessType}
                popovertarget="business-type-input-menu"
                popovertargetaction="hide"
                aria-selected=${state.businessType === 'Small Business' ? 'true' : 'false'}
              >
                ${state.businessType === 'Small Business' ? html`<material-symbols name="check"></material-symbols>` : nothing}
                Small Business
              </button>
            </li>
            <li>
              <button
                role="menuitem"
                type="button"
                data-value="Medium Enterprise"
                @click=${handleSelectBusinessType}
                popovertarget="business-type-input-menu"
                popovertargetaction="hide"
                aria-selected=${state.businessType === 'Medium Enterprise' ? 'true' : 'false'}
              >
                ${state.businessType === 'Medium Enterprise' ? html`<material-symbols name="check"></material-symbols>` : nothing}
                Medium Enterprise
              </button>
            </li>
            <li>
              <button
                role="menuitem"
                type="button"
                data-value="Corporation"
                @click=${handleSelectBusinessType}
                popovertarget="business-type-input-menu"
                popovertargetaction="hide"
                aria-selected=${state.businessType === 'Corporation' ? 'true' : 'false'}
              >
                ${state.businessType === 'Corporation' ? html`<material-symbols name="check"></material-symbols>` : nothing}
                Corporation
              </button>
            </li>
            <li>
              <button
                role="menuitem"
                type="button"
                data-value="Non-Profit"
                @click=${handleSelectBusinessType}
                popovertarget="business-type-input-menu"
                popovertargetaction="hide"
                aria-selected=${state.businessType === 'Non-Profit' ? 'true' : 'false'}
              >
                ${state.businessType === 'Non-Profit' ? html`<material-symbols name="check"></material-symbols>` : nothing}
                Non-Profit
              </button>
            </li>
          </menu>

          <div class="outlined-text-field">
            <div class="container">
              <label for="currency-code-input">Currency Code</label>
              <input
                id="currency-code-input"
                name="Currency Code"
                type="text"
                placeholder=" "
                value="${state.currencyCode}"
              />
            </div>
          </div>

          <div class="outlined-text-field">
            <div class="container">
              <label for="currency-decimals-input">Currency Decimals</label>
              <input
                id="currency-decimals-input"
                name="Currency Decimals"
                type="number"
                placeholder=" "
                value="${state.currencyDecimals}"
                min="0"
                max="4"
              />
            </div>
          </div>

          <div class="outlined-text-field">
            <div class="container">
              <label for="fiscal-year-start-month-input">Fiscal Year Start Month</label>
              <input
                id="fiscal-year-start-month-input"
                name="Fiscal Year Start Month"
                type="number"
                placeholder=" "
                value="${state.fiscalYearStartMonth}"
                min="1"
                max="12"
              />
            </div>
          </div>

          <div class="outlined-text-field" style="anchor-name: --language-input-anchor;">
            <div class="container">
              <label for="language-input">Language</label>
              <input
                id="language-input"
                type="button"
                value="${languageDisplayValue}"
                popovertarget="language-input-menu"
                popovertargetaction="show"
                placeholder=" "
              />
              <input type="hidden" name="Language" value="${state.language}" />
              <label for="language-input" class="trailing-icon">
                <material-symbols name="arrow_drop_down"></material-symbols>
              </label>
            </div>
          </div>
          <menu role="menu" popover id="language-input-menu" class="dropdown" style="position-anchor: --language-input-anchor;">
            <li>
              <button
                role="menuitem"
                type="button"
                data-value="en"
                data-display-name="English"
                @click=${handleSelectLanguage}
                popovertarget="language-input-menu"
                popovertargetaction="hide"
                aria-selected=${state.language === 'en' ? 'true' : 'false'}
              >
                ${state.language === 'en' ? html`<material-symbols name="check"></material-symbols>` : nothing}
                English
              </button>
            </li>
            <li>
              <button
                role="menuitem"
                type="button"
                data-value="id"
                data-display-name="Bahasa Indonesia"
                @click=${handleSelectLanguage}
                popovertarget="language-input-menu"
                popovertargetaction="hide"
                aria-selected=${state.language === 'id' ? 'true' : 'false'}
              >
                ${state.language === 'id' ? html`<material-symbols name="check"></material-symbols>` : nothing}
                Bahasa Indonesia
              </button>
            </li>
          </menu>

          <div class="outlined-text-field">
            <div class="container">
              <label for="locale-input">Locale</label>
              <input
                id="locale-input"
                name="Locale"
                type="text"
                placeholder=" "
                value="${state.locale}"
              />
            </div>
          </div>

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

    useEffect(host, function renderAccountingConfigurationView() {
      render(html`
        <div class="scrollable" style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 12px 24px; height: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
            <h2 class="title-large" style="margin: 0;">${t('settings', 'accountingConfigurationTitle')}</h2>
            <button role="button" class="text" @click=${loadConfig} aria-label="${t('settings', 'refreshConfigurationAriaLabel')}">
              <material-symbols name="refresh"></material-symbols>
              ${t('settings', 'refreshButtonLabel')}
            </button>
          </div>
          ${renderAccountingConfigPanel()}
        </div>

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
      `);
    });
  }
}

defineWebComponent('accounting-configuration-view', AccountingConfigurationViewElement);
