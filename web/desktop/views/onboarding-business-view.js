import { reactive } from '@vue/reactivity';
import { html } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { DeviceContextElement } from '#web/contexts/device-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';

import { webStyleSheets } from '#web/desktop/styles.js';
import { feedbackDelay } from '#web/tools/timing.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

import '#web/desktop/components/material-symbols.js';
import { useConnectedCallback } from '#web/hooks/use-lifecycle.js';
import { useMounted } from '#web/hooks/use-mounted.js';
import { useElement } from '#web/hooks/use-element.js';

export class OnboardingBusinessViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const device = useContext(host, DeviceContextElement);
    const router = useContext(host, RouterContextElement);
    const t = useTranslator(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const form = reactive({
      state: /** @type {'ready'|'submitting'|'failure'|'success'} */ ('ready'),
      errorMessage: /** @type {string} */ (undefined),
      selectedLanguage: 'en',
      selectedLanguageDisplay: 'English',
    });

    const formElementRef = useElement(host, HTMLFormElement);
    let configData = /** @type {Record<string, string>|null} */ (null);

    useConnectedCallback(host, function initiateDefaultLanguage() {
      form.selectedLanguage = device?.language || 'en';
      form.selectedLanguageDisplay = device?.language === 'id' ? 'Bahasa Indonesia' : 'English';
    });

    // Load existing config from database after initial render when connected
    useMounted(host, async function loadConfigFromDatabase() {
      if (database.state !== 'connected') return;
      try {
        console.debug('onboarding-business-view', 'fetchConfigData', 'fetching...');
        const result = await database.sql`
          SELECT key, value FROM config WHERE key IN (
            'Business Name', 'Business Type', 'Currency Code', 'Currency Decimals',
            'Locale', 'Language', 'Fiscal Year Start Month'
          )
        `;
        console.debug('onboarding-business-view', 'fetchConfigData', 'result', JSON.stringify(result.rows));
        configData = Object.fromEntries(result.rows.map(row => [row.key, row.value]));
        console.debug('onboarding-business-view', 'fetchConfigData', 'configData', JSON.stringify(configData));

        // Set input values directly since form.reset() only works with initial HTML attributes
        // Only update if input is empty or database has a value - preserves browser-restored values during back navigation
        queueMicrotask(function setInputValues() {
          const formEl = formElementRef.value;
          if (!formEl) return;
          const businessNameInput = formEl.elements['business-name'];
          const businessNameValue = configData?.['Business Name'];
          if (businessNameInput && businessNameInput.dataset.userModified !== 'true') {
            businessNameInput.value = businessNameValue || '';
          }
          const businessTypeInput = formEl.elements['business-type'];
          const businessTypeValue = configData?.['Business Type'];
          if (businessTypeInput && businessTypeInput.dataset.userModified !== 'true') {
            businessTypeInput.value = businessTypeValue || 'Small Business';
          }
          const currencyCodeInput = formEl.elements['currency-code'];
          const currencyCodeValue = configData?.['Currency Code'];
          if (currencyCodeInput && currencyCodeInput.dataset.userModified !== 'true') {
            currencyCodeInput.value = currencyCodeValue || 'IDR';
          }
          const currencyDecimalsInput = formEl.elements['currency-decimals'];
          const currencyDecimalsValue = configData?.['Currency Decimals'];
          if (currencyDecimalsInput && currencyDecimalsInput.dataset.userModified !== 'true') {
            currencyDecimalsInput.value = currencyDecimalsValue || '0';
          }
          const localeInput = formEl.elements['locale'];
          const localeValue = configData?.['Locale'];
          if (localeInput && localeInput.dataset.userModified !== 'true') {
            localeInput.value = localeValue || 'en-ID';
          }
          const fiscalYearInput = formEl.elements['fiscal-year-start-month'];
          const fiscalYearValue = configData?.['Fiscal Year Start Month'];
          if (fiscalYearInput && fiscalYearInput.dataset.userModified !== 'true') {
            fiscalYearInput.value = fiscalYearValue || '1';
          }
        });

        // Update language selection from config if available
        const configLanguage = configData?.['Language'];
        if (configLanguage) {
          form.selectedLanguage = configLanguage;
          form.selectedLanguageDisplay = configLanguage === 'id' ? 'Bahasa Indonesia' : 'English';
        }
      }
      catch (error) {
        console.error('Failed to load business config', error);
      }
    });



    /** @param {SubmitEvent} event */
    async function submitBusinessConfig(event) {
      event.preventDefault();
      assertInstanceOf(HTMLFormElement, event.currentTarget);
      const formEl = event.currentTarget;
      if (!formEl.checkValidity()) {
        formEl.reportValidity();
        return;
      }

      const formData = new FormData(formEl);

      form.state = 'submitting';
      form.errorMessage = undefined;

      const tx = await database.transaction('write');
      try {
        await tx.sql`UPDATE config SET value = ${formData.get('business-name') || ''} WHERE key = 'Business Name'`;
        await tx.sql`UPDATE config SET value = ${formData.get('business-type') || ''} WHERE key = 'Business Type'`;
        await tx.sql`UPDATE config SET value = ${formData.get('currency-code') || ''} WHERE key = 'Currency Code'`;
        await tx.sql`UPDATE config SET value = ${formData.get('currency-decimals') || ''} WHERE key = 'Currency Decimals'`;
        await tx.sql`UPDATE config SET value = ${formData.get('locale') || ''} WHERE key = 'Locale'`;
        await tx.sql`UPDATE config SET value = ${formData.get('language') || ''} WHERE key = 'Language'`;
        await tx.sql`UPDATE config SET value = ${formData.get('fiscal-year-start-month') || ''} WHERE key = 'Fiscal Year Start Month'`;
        await tx.commit();
        form.state = 'success';
        await feedbackDelay();

        router.navigate({ pathname: '/onboarding/chart-of-accounts' });
      }
      catch (error) {
        console.error('Failed to save configuration', error);
        await tx.rollback();
        form.state = 'failure';
        form.errorMessage = error.message;
        await feedbackDelay();
        form.state = 'ready';
      }
    }

    /** @param {Event} event */
    function handleLanguageSelection(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      const selectedLanguage = event.currentTarget.dataset.language;
      const displayName = event.currentTarget.dataset.displayName;
      event.currentTarget.form.elements['language'].value = selectedLanguage;
      event.currentTarget.form.elements['language-display'].value = displayName;
      for (const li of event.currentTarget.closest('[role="menu"]').children) {
        assertInstanceOf(HTMLButtonElement, li.firstElementChild);
        li.firstElementChild.setAttribute('aria-checked', selectedLanguage === li.firstElementChild.dataset.language ? 'true' : 'false');
      }
    }

    /** @param {Event} event */
    function handleFormInput(event) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        target.dataset.userModified = 'true';
      }
    }

    useEffect(host, function renderOnboardingBusinessView() {
      console.debug('onboarding-business-view', 'renderOnboardingBusinessView', form.state);
      const formState = form.state;
      const formDisabled = formState !== 'ready';

      render(html`
        <dialog
          class="full-screen"
          aria-labelledby="business-config-title"
          style="max-width: 600px; margin: 0 auto;"
          open
        >
          <form class="container" ?disabled=${formDisabled} @submit=${submitBusinessConfig} @input=${handleFormInput} ${formElementRef}>
            <header>
              <h2 id="business-config-title" class="headline">${t('onboarding', 'businessConfigTitle')}</h2>
              <button
                role="button"
                class="text"
                type="submit"
                ?disabled=${formDisabled}
              >${t('onboarding', 'businessConfigSubmitLabel')}</button>
            </header>
            <div role="status" aria-live="polite" aria-busy="true">
              ${formState === 'submitting' ? html`<progress aria-label="${t('onboarding', 'businessConfigProgressIndicatorLabel')}"></progress>` : ''}
            </div>
            <div class="content">
              <div class="outlined-text-field">
                <div class="container">
                  <label for="business-name">${t('onboarding', 'businessNameLabel')}</label>
                  <input id="business-name" name="business-name" type="text" placeholder=" " required ?disabled=${formDisabled} value="" />
                </div>
              </div>

              <div class="outlined-text-field">
                <div class="container">
                  <label for="business-type">${t('onboarding', 'businessTypeLabel')}</label>
                  <input id="business-type" name="business-type" type="text" placeholder=" " required value="Small Business" ?disabled=${formDisabled} />
                </div>
              </div>

              <div class="outlined-text-field">
                <div class="container">
                  <label for="currency-code">${t('onboarding', 'businessCurrencyCodeLabel')}</label>
                  <input id="currency-code" name="currency-code" type="text" placeholder=" " required value="IDR" ?disabled=${formDisabled} />
                </div>
              </div>

              <div class="outlined-text-field">
                <div class="container">
                  <label for="currency-decimals">${t('onboarding', 'businessCurrencyDecimalsLabel')}</label>
                  <input id="currency-decimals" name="currency-decimals" type="number" placeholder=" " required value="0" ?disabled=${formDisabled} />
                </div>
              </div>

              <div class="outlined-text-field">
                <div class="container">
                  <label for="locale">${t('onboarding', 'businessLocaleLabel')}</label>
                  <input id="locale" name="locale" type="text" placeholder=" " required value="en-ID" ?disabled=${formDisabled} />
                </div>
              </div>

              <div class="outlined-text-field" style="anchor-name: --language-input-anchor;">
                <div class="container">
                  <label for="language-input">${t('onboarding', 'businessLanguageLabel')}</label>
                  <input
                    id="language-input"
                    type="button"
                    name="language-display"
                    value="${form.selectedLanguageDisplay}"
                    popovertarget="language-menu"
                    popovertargetaction="show"
                    placeholder=" "
                    ?disabled=${formDisabled}
                  />
                  <input type="hidden" name="language" value="${form.selectedLanguage}" />
                  <label for="language-input" class="trailing-icon">
                    <material-symbols name="arrow_drop_down"></material-symbols>
                  </label>
                </div>
              </div>
              <menu role="menu" popover id="language-menu" class="dropdown" style="position-anchor: --language-input-anchor;">
                <li>
                  <button
                    role="menuitemradio"
                    type="button"
                    @click=${handleLanguageSelection}
                    data-language="en"
                    data-display-name="English"
                    popovertarget="language-menu"
                    popovertargetaction="hide"
                    aria-checked="${form.selectedLanguage === 'en' ? 'true' : 'false'}"
                  >
                    ${form.selectedLanguage === 'en' ? html`<material-symbols name="check"></material-symbols>` : ''}
                    English
                  </button>
                </li>
                <li>
                  <button
                    role="menuitemradio"
                    type="button"
                    @click=${handleLanguageSelection}
                    data-language="id"
                    data-display-name="Bahasa Indonesia"
                    popovertarget="language-menu"
                    popovertargetaction="hide"
                    aria-checked="${form.selectedLanguage === 'id' ? 'true' : 'false'}"
                  >
                    ${form.selectedLanguage === 'id' ? html`<material-symbols name="check"></material-symbols>` : ''}
                    Bahasa Indonesia
                  </button>
                </li>
              </menu>

              <div class="outlined-text-field">
                <div class="container">
                  <label for="fiscal-year-start-month">${t('onboarding', 'businessFiscalYearStartMonthLabel')}</label>
                  <input id="fiscal-year-start-month" name="fiscal-year-start-month" type="number" min="1" max="12" placeholder=" " required value="1" ?disabled=${formDisabled} />
                </div>
              </div>
            </div>
          </form>
        </dialog>
      `);
    });
  }
}

defineWebComponent('onboarding-business-view', OnboardingBusinessViewElement);
