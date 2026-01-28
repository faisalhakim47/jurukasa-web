import { reactive } from '@vue/reactivity';
import { html } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { DeviceContextElement } from '#web/contexts/device-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { feedbackDelay } from '#web/tools/timing.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

import '#web/components/material-symbols.js';

/** @import { LocalDatabaseConfig, TursoDatabaseConfig } from '#web/contexts/database-context.js' */

/** @typedef {'local'|'turso'} DatabaseProvider */

/**
 * Database Setup View handles the database configuration flow for adding new databases.
 * This is separate from onboarding and includes a back/cancel button to restore previous route state.
 *
 * Steps:
 * 1. Database connection setup
 * 2. Business information configuration
 * 3. Chart of accounts selection
 */
export class DatabaseSetupViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const device = useContext(host, DeviceContextElement);
    const router = useContext(host, RouterContextElement);
    const t = useTranslator(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const setup = reactive({
      step: /** @type {'database-setup'|'business-config'|'chart-of-accounts'|'complete'} */ ('database-setup'),
      templateNames: /** @type {string[]} */ ([]),
      selectedLanguage: 'en',
      selectedLanguageDisplay: 'English',
    });

    useEffect(host, function initialSetup() {
      setup.selectedLanguage = device.language || 'en';
      setup.selectedLanguageDisplay = device.language === 'id' ? 'Bahasa Indonesia' : 'English';
    });

    const databaseForm = reactive({
      state: /** @type {'ready'|'submitting'|'failure'|'success'} */ ('ready'),
      errorMessage: /** @type {string} */ (undefined),
      selectedProvider: /** @type {DatabaseProvider} */ ('local'),
    });

    const state = reactive({
      formState: /** @type {'ready'|'submitting'|'failure'|'success'} */ ('ready'),
      formErrorMessage: /** @type {string} */ (undefined),
    });

    const chartForm = reactive({
      state: /** @type {'ready'|'submitting'|'failure'|'success'} */ ('ready'),
      errorMessage: /** @type {string} */ (undefined),
    });

    function loadChartOfAccountsTemplates() {
      database.sql`SELECT name FROM chart_of_accounts_templates`
        .then(function assignTemplates(result) {
          setup.templateNames = result.rows.map(function rowToTemplateName(row) { return String(row.name); });
        });
    }

    function handleCancelSetup() {
      // Restore previous route state from sessionStorage
      const previousRouteJson = sessionStorage.getItem('previousRouteState');
      if (previousRouteJson) {
        try {
          const previousRoute = JSON.parse(previousRouteJson);
          sessionStorage.removeItem('previousRouteState');
          router.navigate({
            pathname: previousRoute?.pathname || '/settings/database',
            search: previousRoute?.search,
            database: previousRoute?.database,
            replace: true,
          });
        }
        catch (error) {
          console.error('Failed to parse previous route state', error);
          router.navigate({ pathname: '/settings/database', replace: true });
        }
      }
      else {
        router.navigate({ pathname: '/settings/database', replace: true });
      }
    }

    /** @param {Event} event */
    function handleDatabaseProviderChange(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      databaseForm.selectedProvider = /** @type {DatabaseProvider} */ (event.currentTarget.value);
    }

    /** @param {SubmitEvent} event */
    async function submitDatabaseConfig(event) {
      try {
        event.preventDefault();
        databaseForm.state = 'submitting';
        const formEl = /** @type {HTMLFormElement} */ (event.currentTarget);
        const provider = databaseForm.selectedProvider;

        if (provider === 'local') {
          const config = /** @type {LocalDatabaseConfig} */ ({
            provider: 'local',
            name: formEl.elements['database-name'].value,
          });
          await database.connect(config);
          databaseForm.state = 'success';
          await feedbackDelay();
          router.navigate({
            pathname: '/database-setup',
            database: config,
            replace: true,
          });
        }
        else if (provider === 'turso') {
          const config = /** @type {TursoDatabaseConfig} */ ({
            provider: 'turso',
            name: formEl.elements['database-name'].value,
            url: formEl.elements['turso-url'].value,
            authToken: formEl.elements['turso-auth-token'].value,
          });
          await database.connect(config);
          databaseForm.state = 'success';
          await feedbackDelay();
          router.navigate({
            pathname: '/database-setup',
            database: config,
            replace: true,
          });
        }

        // After database connection, proceed to business config
        setup.step = 'business-config';
      }
      catch (error) {
        databaseForm.state = 'failure';
        databaseForm.errorMessage = error.message;
        await feedbackDelay();
        databaseForm.state = 'ready';
      }
    }

    /** @param {SubmitEvent} event */
    async function submitBusinessConfig(event) {
      event.preventDefault();
      assertInstanceOf(HTMLFormElement, event.currentTarget);
      const form = event.currentTarget;
      const formData = new FormData(form);

      // Capture form data before changing state (which triggers re-render and disables fields)
      state.formState = 'submitting';
      state.formErrorMessage = undefined;

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
        state.formState = 'success';
        await feedbackDelay();

        setup.step = 'chart-of-accounts';

        loadChartOfAccountsTemplates();
      }
      catch (error) {
        console.error('Failed to save configuration', error);
        await tx.rollback();
        state.formState = 'failure';
        state.formErrorMessage = error.message;
        await feedbackDelay();
        state.formState = 'ready';
      }
    }

    /** @param {SubmitEvent} event */
    async function submitChartOfAccounts(event) {
      event.preventDefault();
      const form = /** @type {HTMLFormElement} */ (event.currentTarget);
      const formData = new FormData(form);

      // Capture form data before changing state (which triggers re-render and disables fields)
      chartForm.state = 'submitting';

      const tx = await database.transaction('write');
      try {
        await tx.sql`INSERT INTO chart_of_accounts_templates (name) VALUES (${formData.get('template-name')})`;
        await tx.commit();
        chartForm.state = 'success';
        await feedbackDelay();
        setup.step = 'complete';

        // Clear the previous route state
        sessionStorage.removeItem('previousRouteState');

        // Navigate to dashboard with the new database
        router.navigate({ pathname: '/dashboard', replace: true });
      }
      catch (error) {
        console.error('Failed to submit chart of accounts', error);
        try { await tx.rollback(); } catch (error) { console.error('Failed to rollback transaction', error); }
        chartForm.state = 'failure';
        chartForm.errorMessage = error.message;
        await feedbackDelay();
        chartForm.state = 'ready';
      }
    }

    /** @param {Event} event */
    function handleLanguageSelectionInBusinessConfig(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      const selectedLanguage = event.currentTarget.dataset.language;
      const displayName = event.currentTarget.dataset.displayName;
      event.currentTarget.form.elements['language'].value = selectedLanguage;
      event.currentTarget.form.elements['language-display'].value = displayName;
      for (const li of event.currentTarget.closest('[role="menu"]').children) {
        assertInstanceOf(HTMLButtonElement, li.firstChild);
        li.firstChild.setAttribute('aria-checked', selectedLanguage === li.firstChild.dataset.language ? 'true' : 'false');
      }
    }

    function renderDatabaseSetupStep() {
      const formState = databaseForm.state;
      const formDisabled = formState !== 'ready';
      const selectedProvider = databaseForm.selectedProvider;
      const submitButtonText = formState === 'ready' ? t('onboarding', 'databaseConfigSubmitLabel')
        : formState === 'submitting' ? t('onboarding', 'databaseConnectingLabel')
          : formState === 'success' ? t('onboarding', 'databaseConnectedLabel')
            : formState === 'failure' ? t('onboarding', 'databaseFailedLabel')
              : t('onboarding', 'databaseConfigSubmitLabel');
      return html`
        <dialog
          class="full-screen"
          aria-labelledby="configure-database-title"
          aria-describedby="configure-database-description"
          style="max-width: 600px; margin: 0 auto;"
          open
        >
          <form method="dialog" class="container" ?disabled=${formDisabled} @submit=${submitDatabaseConfig}>
            <header>
              <button
                role="button"
                type="button"
                class="text"
                @click=${handleCancelSetup}
              >
                <material-symbols name="close" label=${t('settings', 'databaseSetupBackButtonLabel')}></material-symbols>
              </button>
              <h3 id="configure-database-title">${t('settings', 'databaseSetupTitle')}</h3>
              <button role="button" type="submit">${submitButtonText}</button>
            </header>

            <div class="content">
              <p id="configure-database-description">${t('settings', 'databaseSetupDescription')}</p>

              <ul role="radiogroup" aria-label="${t('onboarding', 'databaseProviderLabel')}" style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 16px; margin-top: 24px;">
                <!-- Local SQLite Provider -->
                <li role="presentation" style="border: 1px solid var(--md-sys-color-outline); border-radius: var(--md-sys-shape-corner-small); overflow: hidden;">
                  <label style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                    padding: 16px;
                    background-color: ${selectedProvider === 'local' ? 'var(--md-sys-color-surface-container-high)' : 'var(--md-sys-color-surface-container-lowest)'};
                  ">
                    <input
                      type="radio"
                      name="database-provider"
                      value="local"
                      @change=${handleDatabaseProviderChange}
                      ?checked=${selectedProvider === 'local'}
                      ?disabled=${formDisabled}
                      style="margin: 0;"
                    />
                    <div style="flex: 1;">
                      <span style="font-weight: 500;">${t('onboarding', 'localDatabaseLabel')}</span>
                      <p style="margin: 4px 0 0; font-size: 0.875rem; color: var(--md-sys-color-on-surface-variant);">
                        ${t('onboarding', 'localDatabaseDescription')}
                      </p>
                    </div>
                  </label>
                  ${selectedProvider === 'local' ? html`
                    <div style="padding: 16px; display: flex; flex-direction: column; gap: 16px;">
                      <div class="outlined-text-field">
                        <div class="container">
                          <label for="database-name">${t('onboarding', 'localDatabaseNameLabel')}</label>
                          <input
                            id="database-name"
                            name="database-name"
                            type="text"
                            autocomplete="off"
                            required
                            ?disabled=${formDisabled}
                            placeholder="${t('onboarding', 'localDatabaseNamePlaceholder')}"
                          />
                        </div>
                        <p class="supporting-text">${t('onboarding', 'localDatabaseNameDescription')}</p>
                      </div>
                    </div>
                  ` : ''}
                </li>
                <!-- Remote Turso Provider -->
                <li role="presentation" style="border: 1px solid var(--md-sys-color-outline); border-radius: var(--md-sys-shape-corner-small); overflow: hidden;">
                  <label style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                    padding: 16px;
                    background-color: ${selectedProvider === 'turso' ? 'var(--md-sys-color-surface-container-high)' : 'var(--md-sys-color-surface-container-lowest)'};
                  ">
                    <input
                      type="radio"
                      name="database-provider"
                      value="turso"
                      @change=${handleDatabaseProviderChange}
                      ?checked=${selectedProvider === 'turso'}
                      ?disabled=${formDisabled}
                      style="margin: 0;"
                    />
                    <div style="flex: 1;">
                      <span style="font-weight: 500;">${t('onboarding', 'tursoDatabaseLabel')}</span>
                      <p style="margin: 4px 0 0; font-size: 0.875rem; color: var(--md-sys-color-on-surface-variant);">
                        ${t('onboarding', 'tursoDatabaseDescription')}
                      </p>
                    </div>
                  </label>
                  ${selectedProvider === 'turso' ? html`
                    <div style="padding: 16px; display: flex; flex-direction: column; gap: 16px;">
                      <div class="outlined-text-field">
                        <div class="container">
                          <label for="database-name">${t('onboarding', 'localDatabaseNameLabel')}</label>
                          <input
                            id="database-name"
                            name="database-name"
                            type="text"
                            autocomplete="off"
                            required
                            ?disabled=${formDisabled}
                            placeholder="${t('onboarding', 'localDatabaseNamePlaceholder')}"
                          />
                        </div>
                        <p class="supporting-text">${t('onboarding', 'localDatabaseNameDescription')}</p>
                      </div>
                      <div class="outlined-text-field">
                        <div class="container">
                          <label for="turso-url">${t('onboarding', 'tursoUrlLabel')}</label>
                          <input
                            id="turso-url"
                            name="turso-url"
                            type="text"
                            autocomplete="off"
                            required
                            ?disabled=${formDisabled}
                            placeholder="${t('onboarding', 'tursoUrlPlaceholder')}"
                          />
                        </div>
                        <p class="supporting-text">${t('onboarding', 'tursoUrlDescription')}</p>
                      </div>
                      <div class="outlined-text-field">
                        <div class="container">
                          <label for="turso-auth-token">${t('onboarding', 'tursoAuthTokenLabel')}</label>
                          <input
                            id="turso-auth-token"
                            name="turso-auth-token"
                            type="password"
                            autocomplete="off"
                            ?disabled=${formDisabled}
                            placeholder="${t('onboarding', 'tursoAuthTokenPlaceholder')}"
                          />
                        </div>
                        <p class="supporting-text">${t('onboarding', 'tursoAuthTokenDescription')}</p>
                      </div>
                    </div>
                  ` : ''}
                </li>
              </ul>

              ${databaseForm.errorMessage ? html`
                <p style="color: var(--md-sys-color-error); margin-top: 16px;">${databaseForm.errorMessage}</p>
              ` : ''}
            </div>
          </form>
        </dialog>
      `;
    }

    function renderBusinessConfigStep() {
      const formState = state.formState;
      const formDisabled = formState !== 'ready';
      return html`
        <dialog
          class="full-screen"
          aria-labelledby="business-config-title"
          style="max-width: 600px; margin: 0 auto;"
          open
        >
          <form class="container" ?disabled=${formDisabled} @submit=${submitBusinessConfig}>
            <header>
              <button
                role="button"
                type="button"
                class="text"
                @click=${handleCancelSetup}
              >${t('settings', 'databaseSetupBackButtonLabel')}</button>
              <h2 id="business-config-title" class="headline">${t('onboarding', 'businessConfigTitle')}</h2>
              <button role="button" class="text" type="submit">${t('onboarding', 'businessConfigSubmitLabel')}</button>
            </header>
            <div class="content">
              <div class="outlined-text-field">
                <div class="container">
                  <label for="business-name">${t('onboarding', 'businessNameLabel')}</label>
                  <input id="business-name" name="business-name" type="text" placeholder=" " required ?disabled=${formDisabled} />
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
                    value="${setup.selectedLanguageDisplay}"
                    popovertarget="language-menu"
                    popovertargetaction="show"
                    placeholder=" "
                    ?disabled=${formDisabled}
                  />
                  <input type="hidden" name="language" value="${setup.selectedLanguage}" />
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
                    @click=${handleLanguageSelectionInBusinessConfig}
                    data-language="en"
                    data-display-name="English"
                    popovertarget="language-menu"
                    popovertargetaction="hide"
                    aria-checked="${setup.selectedLanguage === 'en' ? 'true' : 'false'}"
                  >
                    ${setup.selectedLanguage === 'en' ? html`<material-symbols name="check"></material-symbols>` : ''}
                    English
                  </button>
                </li>
                <li>
                  <button
                    role="menuitemradio"
                    type="button"
                    @click=${handleLanguageSelectionInBusinessConfig}
                    data-language="id"
                    data-display-name="Bahasa Indonesia"
                    popovertarget="language-menu"
                    popovertargetaction="hide"
                    aria-checked="${setup.selectedLanguage === 'id' ? 'true' : 'false'}"
                  >
                    ${setup.selectedLanguage === 'id' ? html`<material-symbols name="check"></material-symbols>` : ''}
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
      `;
    }

    function renderChartOfAccountsStep() {
      const formState = chartForm.state;
      const formDisabled = formState !== 'ready';

      if (setup.templateNames.length === 0) {
        return html`
          <dialog
            class="full-screen"
            aria-labelledby="coa-title"
            style="max-width: 600px; margin: 0 auto;"
            open
          >
            <header>
              <h2 id="coa-title" class="headline">${t('onboarding', 'loadingIndicatorLabel')}</h2>
            </header>
            <div class="content" style="padding-top: 24px;">
              <p>${t('onboarding', 'loadingTemplatesIndicatorLabel')}</p>
            </div>
          </dialog>
        `;
      }

      return html`
        <dialog
          class="full-screen"
          aria-labelledby="coa-title"
          style="max-width: 600px; margin: 0 auto;"
          open
        >
          <form class="container" ?disabled=${formDisabled} @submit=${submitChartOfAccounts}>
            <header>
              <button
                role="button"
                type="button"
                class="text"
                @click=${handleCancelSetup}
              >${t('settings', 'databaseSetupBackButtonLabel')}</button>
              <h2 id="coa-title" class="headline">${t('onboarding', 'chartOfAccountsSetupTitle')}</h2>
              <button
                role="button"
                type="submit"
                class="text"
                ?disabled=${formDisabled}
              >${t('onboarding', 'chartOfAccountsSetupSubmitLabel')}</button>
            </header>
            <div class="content">
              <ul role="list">
                ${repeat(setup.templateNames, (t) => t, (templateName, index) => html`
                  <li role="listitem">
                    <span class="leading">
                      <input id=${`template-name-radio-${index}`} type="radio" name="template-name" value=${templateName} required ?disabled=${formDisabled} />
                    </span>
                    <label for="${`template-name-radio-${index}`}" class="content">
                      <span class="headline">${templateName}</span>
                    </label>
                  </li>
                `)}
              </ul>
            </div>
          </form>
        </dialog>
      `;
    }

    useEffect(host, function renderDatabaseSetupView() {
      if (setup.step === 'database-setup') render(renderDatabaseSetupStep());
      else if (setup.step === 'business-config') render(renderBusinessConfigStep());
      else if (setup.step === 'chart-of-accounts') render(renderChartOfAccountsStep());
      else if (setup.step === 'complete') render(html`<p>${t('onboarding', 'loadingIndicatorLabel')}</p>`);
      else render(html`<p>${t('onboarding', 'unknownState', setup.step)}</p>`);
    });
  }
}

defineWebComponent('database-setup-view', DatabaseSetupViewElement);
