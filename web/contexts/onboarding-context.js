import { reactive } from '@vue/reactivity';
import { html } from 'lit-html';
import { defineWebComponent } from '#web/component.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { translator as t } from '#web/directives/translator.js';
import { provideContext, useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { webStyleSheets } from '#web/styles.js';

export class OnboardingContextElement extends HTMLElement {
  constructor() {
    super();

    provideContext(this);

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const onboarding = reactive({
      state: /** @type {'init'|'business-configuration'|'chart-of-accounts-selection'|'done'} */ ('init'),
      templateNames: /** @type {string[]} */ ([]),
    });

    useBusyStateUntil(host, function evaluateReady() {
      return onboarding.state === 'business-configuration'
        || onboarding.state === 'chart-of-accounts-selection'
        || onboarding.state === 'done';
    });

    useEffect(host, function evaluateOnboardingState() {
      if (onboarding.state === 'done') { /* nothing to do */ }
      else if (database.isReady && database.state === 'connected') {
        database.sql`SELECT value FROM config WHERE key = 'Business Name' LIMIT 1;`
          .then(function (result) {
            const row = result.rows[0];
            const isBusinessConfigured = String(row?.value || '').trim().length > 0;

            if (isBusinessConfigured) {
              database.sql`SELECT count(*) as count FROM accounts`
                .then(function (result) {
                  const count = Number(result.rows[0]?.count || 0);
                  if (count > 0) onboarding.state = 'done';
                  else {
                    onboarding.state = 'chart-of-accounts-selection';
                    database.sql`SELECT name FROM chart_of_accounts_templates`
                      .then(function (result) {
                        onboarding.templateNames = result.rows.map(function (row) { return String(row.name); });
                      });
                  }
                });
            }
            else onboarding.state = 'business-configuration';
          })
          .catch(function (error) {
            console.error('Failed to check configuration', error);
            onboarding.state = 'business-configuration';
          });
      }
      else if (database.isReady && database.state === 'unconfigured') {
        onboarding.state = 'business-configuration';
      }
    });

    /** @param {SubmitEvent} event */
    const submitConfiguration = async function (event) {
      event.preventDefault();
      const form = /** @type {HTMLFormElement} */ (event.target);
      const formData = new FormData(form);
      const tx = await database.transaction('write');
      try {
        await tx.sql`UPDATE config SET value = ${formData.get('business-name')} WHERE key = 'Business Name'`;
        await tx.sql`UPDATE config SET value = ${formData.get('business-type')} WHERE key = 'Business Type'`;
        await tx.sql`UPDATE config SET value = ${formData.get('currency-code')} WHERE key = 'Currency Code'`;
        await tx.sql`UPDATE config SET value = ${formData.get('currency-decimals')} WHERE key = 'Currency Decimals'`;
        await tx.sql`UPDATE config SET value = ${formData.get('locale')} WHERE key = 'Locale'`;
        await tx.sql`UPDATE config SET value = ${formData.get('fiscal-year-start-month')} WHERE key = 'Fiscal Year Start Month'`;
        await tx.commit();

        onboarding.state = 'chart-of-accounts-selection';
        const result = await database.sql`SELECT name FROM chart_of_accounts_templates`;
        onboarding.templateNames = result.rows.map(function (row) { return String(row.name); });
      }
      catch (error) {
        await tx.rollback();
        console.error('Failed to save configuration', error);
      }
    };

    /** @param {SubmitEvent} event */
    const submitChartOfAccounts = async function (event) {
      event.preventDefault();
      const form = /** @type {HTMLFormElement} */ (event.target);
      const formData = new FormData(form);
      const tx = await database.transaction('write');
      try {
        await tx.sql`INSERT INTO chart_of_accounts_templates (name) VALUES (${formData.get('template-name')})`;
        await tx.commit();
        onboarding.state = 'done';
      }
      catch (error) {
        await tx.rollback();
        console.error('Failed to save chart of accounts', error);
      }
    };

    useEffect(host, function renderOnboardingView() {
      if (onboarding.state === 'init') render(html`<p>${t('onboarding', 'loadingIndicatorLabel')}</p>`);
      else if (onboarding.state === 'business-configuration') {
        render(html`
          <dialog class="full-screen" aria-labelledby="onboarding-title" open>
            <form class="container" @submit=${submitConfiguration}>
              <header>
                <h2 id="onboarding-title" class="headline">${t('onboarding', 'businessConfigTitle')}</h2>
                <button role="button" class="text" type="submit">${t('onboarding', 'businessConfigSubmitLabel')}</button>
              </header>
              <div class="content">
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="business-name">${t('onboarding', 'businessNameLabel')}</label>
                    <input id="business-name" name="business-name" type="text" placeholder=" " required />
                  </div>
                </div>

                <div class="outlined-text-field">
                  <div class="container">
                    <label for="business-type">${t('onboarding', 'businessTypeLabel')}</label>
                    <input id="business-type" name="business-type" type="text" placeholder=" " required value="Small Business" />
                  </div>
                </div>

                <div class="outlined-text-field">
                  <div class="container">
                    <label for="currency-code">${t('onboarding', 'businessCurrencyCodeLabel')}</label>
                    <input id="currency-code" name="currency-code" type="text" placeholder=" " required value="IDR" />
                  </div>
                </div>

                <div class="outlined-text-field">
                  <div class="container">
                    <label for="currency-decimals">${t('onboarding', 'businessCurrencyDecimalsLabel')}</label>
                    <input id="currency-decimals" name="currency-decimals" type="number" placeholder=" " required value="0" />
                  </div>
                </div>

                <div class="outlined-text-field">
                  <div class="container">
                    <label for="locale">${t('onboarding', 'businessLocaleLabel')}</label>
                    <input id="locale" name="locale" type="text" placeholder=" " required value="en-ID" />
                  </div>
                </div>

                <div class="outlined-text-field">
                  <div class="container">
                    <label for="fiscal-year-start-month">${t('onboarding', 'businessFiscalYearStartMonthLabel')}</label>
                    <input id="fiscal-year-start-month" name="fiscal-year-start-month" type="number" min="1" max="12" placeholder=" " required value="1" />
                  </div>
                </div>

              </div>
            </form>
          </dialog>
        `);
      }
      else if (onboarding.state === 'chart-of-accounts-selection') {
        if (onboarding.templateNames.length === 0) render(html`
          <dialog class="full-screen" aria-labelledby="coa-title" open>
            <header>
              <h2 id="coa-title" class="headline">${t('onboarding', 'loadingIndicatorLabel')}</h2>
            </header>
            <div class="content" style="padding-top: 24px;">
              <p>${t('onboarding', 'loadingTemplatesIndicatorLabel')}</p>
            </div>
          </dialog>
        `);
        else render(html`
          <dialog class="full-screen" aria-labelledby="coa-title" open>
            <form class="container" @submit=${submitChartOfAccounts}>
              <header>
                <h2 id="coa-title" class="headline">${t('onboarding', 'chartOfAccountsSetupTitle')}</h2>
                <button
                  role="button"
                  type="submit"
                  class="text"
                >${t('onboarding', 'chartOfAccountsSetupSubmitLabel')}</button>
              </header>
              <div class="content">
                <ul role="list">
                  ${onboarding.templateNames.map((templateName, index) => html`
                    <li role="listitem">
                      <span class="leading">
                        <input id=${`template-name-radio-${index}`} type="radio" name="template-name" value=${templateName} required />
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
        `);
      }
      else if (onboarding.state === 'done') render(html`<slot></slot>`);
      else render(html`<p>${t('onboarding', 'unknownState', onboarding.state)}</p>`);
    });
  }
}

defineWebComponent('onboarding-context', OnboardingContextElement);
