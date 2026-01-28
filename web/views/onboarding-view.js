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

/** @typedef {'local'|'turso'} DatabaseProvider */

/**
 * Onboarding View handles the complete application setup flow:
 * 1. Welcome screen with feature highlights
 * 2. Database connection setup
 * 3. Business information configuration
 * 4. Chart of accounts selection
 */
export class OnboardingViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const device = useContext(host, DeviceContextElement);
    const router = useContext(host, RouterContextElement);
    const t = useTranslator(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const onboarding = reactive({
      step: /** @type {'welcome'|'database-setup'|'business-config'|'chart-of-accounts'|'complete'} */ ('welcome'),
      templateNames: /** @type {string[]} */ ([]),
      isInitialized: false,
      selectedLanguage: 'en',
      selectedLanguageDisplay: 'English',
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

    useEffect(host, function evaluateInitialStep() {
      // Only evaluate initial step once
      if (onboarding.isInitialized) return;

      // Determine which step to show based on current state
      if (database.state === 'unconfigured') {
        onboarding.step = 'welcome';
        onboarding.isInitialized = true;
      }
      else if (database.state === 'connected') {
        // Check if business is configured
        database.sql`SELECT value FROM config WHERE key = 'Business Name' LIMIT 1;`
          .then(function handleBusinessName(result) {
            if (onboarding.isInitialized) return; // Already initialized by user action
            const row = result.rows[0];
            const isBusinessConfigured = String(row?.value || '').trim().length > 0;
            if (!isBusinessConfigured) {
              onboarding.step = 'business-config';
              onboarding.isInitialized = true;
            }
            else {
              database.sql`SELECT count(*) as count FROM accounts`
                .then(function handleAccountsCount(result) {
                  if (onboarding.isInitialized) return; // Already initialized by user action
                  const count = Number(result.rows[0]?.count || 0);
                  if (count > 0) {
                    onboarding.step = 'complete';
                    onboarding.isInitialized = true;
                    // Redirect to main application
                    router.navigate({ pathname: '/dashboard', replace: true });
                  }
                  else {
                    onboarding.step = 'chart-of-accounts';
                    onboarding.isInitialized = true;
                    loadChartOfAccountsTemplates();
                  }
                });
            }
          })
          .catch(function (error) {
            if (onboarding.isInitialized) return;
            console.error('Failed to check configuration', error);
            onboarding.step = 'business-config';
            onboarding.isInitialized = true;
          });
      }
    });

    function loadChartOfAccountsTemplates() {
      database.sql`SELECT name FROM chart_of_accounts_templates`
        .then(function assignTemplates(result) {
          onboarding.templateNames = result.rows.map(function rowToTemplateName(row) { return String(row.name); });
        });
    }

    function goToDatabaseSetup() {
      // Apply the selected language from welcome screen
      device.setLanguage(onboarding.selectedLanguage);
      onboarding.step = 'database-setup';
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
          await database.connect({ provider: 'local' });
          databaseForm.state = 'success';
          await feedbackDelay();
          router.navigate({
            pathname: '/onboarding',
            databaseProvider: 'local',
            database: { provider: 'local' },
            replace: true,
          });
        }
        else if (provider === 'turso') {
          const tursoUrl = formEl.elements['turso-url'].value;
          const tursoAuthToken = formEl.elements['turso-auth-token'].value;
          await database.connect({ provider: 'turso', url: tursoUrl, authToken: tursoAuthToken });
          databaseForm.state = 'success';
          await feedbackDelay();
          router.navigate({
            pathname: '/onboarding',
            databaseProvider: 'turso',
            database: { provider: 'turso', url: tursoUrl, authToken: tursoAuthToken },
            replace: true,
          });
        }

        // After database connection, check business config
        onboarding.step = 'business-config';
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

      // console.debug('submitBusinessConfig', 'begin');
      const tx = await database.transaction('write');
      try {
        // console.debug('submitBusinessConfig', Array.from(formData.entries()));

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

        onboarding.step = 'chart-of-accounts';
        onboarding.isInitialized = true;

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
        onboarding.step = 'complete';
        // Navigate to dashboard - main-view will detect completion and redirect if needed
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

    /** @param {Event} event */
    function handleLanguageSelectionInWelcome(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      const selectedLanguage = event.currentTarget.value;
      const displayName = event.currentTarget.nextElementSibling.textContent.trim();
      onboarding.selectedLanguage = selectedLanguage;
      onboarding.selectedLanguageDisplay = displayName;
      device.setLanguage(selectedLanguage);
    }

    function renderWelcomeStep() {
      return html`
        <dialog class="full-screen" aria-labelledby="welcome-title" open>
          <div class="container" style="max-width: 600px; margin: 0 auto;">
            <header>
              <h2 id="welcome-title" class="headline">${t('onboarding', 'welcomeTitle')}</h2>
            </header>
            <div class="content" style="text-align: center; padding: 24px;">
              <p style="margin-bottom: 24px;">${t('onboarding', 'welcomeMessage')}</p>
              
              <div style="text-align: left; margin-bottom: 32px;">
                <h3 style="margin-bottom: 16px;">${t('onboarding', 'featuresTitle')}</h3>
                <ul style="list-style: none; padding: 0;">
                  <li style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <material-symbols name="receipt_long"></material-symbols>
                    <span>${t('onboarding', 'featurePOS')}</span>
                  </li>
                  <li style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <material-symbols name="inventory_2"></material-symbols>
                    <span>${t('onboarding', 'featureInventory')}</span>
                  </li>
                  <li style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <material-symbols name="menu_book"></material-symbols>
                    <span>${t('onboarding', 'featureAccounting')}</span>
                  </li>
                  <li style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <material-symbols name="analytics"></material-symbols>
                    <span>${t('onboarding', 'featureReports')}</span>
                  </li>
                </ul>
              </div>

              <div style="text-align: left; margin-bottom: 32px;">
                <h3 style="margin-bottom: 16px;">${t('onboarding', 'selectLanguageLabel')}</h3>
                <ul role="radiogroup" style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 12px;">
                  <li role="presentation">
                    <label
                      style="
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        cursor: pointer;
                        padding: 12px;
                        border: 1px solid var(--md-sys-color-outline);
                        border-radius: var(--md-sys-shape-corner-extra-small);
                        background-color: ${onboarding.selectedLanguage === 'en' ? 'var(--md-sys-color-surface-container-high)' : 'var(--md-sys-color-surface-container-lowest)'};
                      ">
                      <input
                        type="radio"
                        name="language"
                        value="en"
                        @change=${handleLanguageSelectionInWelcome}
                        ?checked=${onboarding.selectedLanguage === 'en'}
                        style="margin: 0;"
                      />
                      <span>English</span>
                    </label>
                  </li>
                  <li role="presentation">
                    <label style="
                      display: flex;
                      align-items: center;
                      gap: 12px;
                      cursor: pointer;
                      padding: 12px;
                      border: 1px solid var(--md-sys-color-outline);
                      border-radius: var(--md-sys-shape-corner-extra-small);
                      background-color: ${onboarding.selectedLanguage === 'id' ? 'var(--md-sys-color-surface-container-high)' : 'var(--md-sys-color-surface-container-lowest)'};
                    ">
                      <input
                        type="radio"
                        name="language"
                        value="id"
                        @change=${handleLanguageSelectionInWelcome}
                        ?checked=${onboarding.selectedLanguage === 'id'}
                        style="margin: 0;"
                      />
                      <span>Bahasa Indonesia</span>
                    </label>
                  </li>
                </ul>
              </div>

              <button
                role="button"
                type="button"
                class="filled"
                @click=${goToDatabaseSetup}
              >${t('onboarding', 'getStartedButton')}</button>
            </div>
          </div>
        </dialog>
      `;
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
              <h3 id="configure-database-title">${t('onboarding', 'databaseConfigTitle')}</h3>
              <button role="button" type="submit">${submitButtonText}</button>
            </header>

            <div class="content">
              <p id="configure-database-description">${t('onboarding', 'databaseConfigDescription')}</p>

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
                    value="${onboarding.selectedLanguageDisplay}"
                    popovertarget="language-menu"
                    popovertargetaction="show"
                    placeholder=" "
                    ?disabled=${formDisabled}
                  />
                  <input type="hidden" name="language" value="${onboarding.selectedLanguage}" />
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
                    aria-checked="${onboarding.selectedLanguage === 'en' ? 'true' : 'false'}"
                  >
                    ${onboarding.selectedLanguage === 'en' ? html`<material-symbols name="check"></material-symbols>` : ''}
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
                    aria-checked="${onboarding.selectedLanguage === 'id' ? 'true' : 'false'}"
                  >
                    ${onboarding.selectedLanguage === 'id' ? html`<material-symbols name="check"></material-symbols>` : ''}
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

      if (onboarding.templateNames.length === 0) {
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
                ${repeat(onboarding.templateNames, (t) => t, (templateName, index) => html`
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

    useEffect(host, function renderOnboardingView() {
      if (onboarding.step === 'welcome') render(renderWelcomeStep());
      else if (onboarding.step === 'database-setup') render(renderDatabaseSetupStep());
      else if (onboarding.step === 'business-config') render(renderBusinessConfigStep());
      else if (onboarding.step === 'chart-of-accounts') render(renderChartOfAccountsStep());
      else if (onboarding.step === 'complete') render(html`<p>${t('onboarding', 'loadingIndicatorLabel')}</p>`);
      else render(html`<p>${t('onboarding', 'unknownState', onboarding.step)}</p>`);
    });
  }
}

defineWebComponent('onboarding-view', OnboardingViewElement);
