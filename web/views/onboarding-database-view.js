import { reactive } from '@vue/reactivity';
import { html } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { feedbackDelay } from '#web/tools/timing.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

/** @import { LocalDatabaseConfig, TursoDatabaseConfig } from '#web/contexts/database-context.js' */

/** @typedef {'local'|'turso'} DatabaseProvider */

export class OnboardingDatabaseViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const router = useContext(host, RouterContextElement);
    const t = useTranslator(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const form = reactive({
      state: /** @type {'ready'|'submitting'|'failure'|'success'} */ ('ready'),
      errorMessage: /** @type {string} */ (undefined),
      selectedProvider: /** @type {DatabaseProvider} */ ('local'),
    });

    /** @param {Event} event */
    function handleDatabaseProviderChange(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      form.selectedProvider = /** @type {DatabaseProvider} */ (event.currentTarget.value);
    }

    /** @param {SubmitEvent} event */
    async function submitDatabaseConfig(event) {
      try {
        event.preventDefault();
        form.state = 'submitting';
        const formEl = /** @type {HTMLFormElement} */ (event.currentTarget);
        const provider = form.selectedProvider;

        if (provider === 'local') {
          const config = /** @type {LocalDatabaseConfig} */ ({
            provider: 'local',
            name: formEl.elements['database-name'].value,
          });
          await database.connect(config);
        }
        else if (provider === 'turso') {
          const config = /** @type {TursoDatabaseConfig} */ ({
            provider: 'turso',
            name: formEl.elements['database-name'].value,
            url: formEl.elements['turso-url'].value,
            authToken: formEl.elements['turso-auth-token'].value,
          });
          await database.connect(config);
        }
      }
      catch (error) {
        form.state = 'failure';
        form.errorMessage = error.message;
        await feedbackDelay();
        form.state = 'ready';
      }
    }



    useEffect(host, function renderOnboardingDatabaseView() {
      const formState = form.state;
      const formDisabled = formState !== 'ready';
      const selectedProvider = form.selectedProvider;
      const submitButtonText = formState === 'ready' ? t('onboarding', 'databaseConfigSubmitLabel')
        : formState === 'submitting' ? t('onboarding', 'databaseConnectingLabel')
          : formState === 'success' ? t('onboarding', 'databaseConnectedLabel')
            : formState === 'failure' ? t('onboarding', 'databaseFailedLabel')
              : t('onboarding', 'databaseConfigSubmitLabel');

      render(html`
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
                            placeholder="${t('onboarding', 'localDatabaseNamePlaceholder')}" />
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
                            placeholder="${t('onboarding', 'localDatabaseNamePlaceholder')}" />
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
                            placeholder="${t('onboarding', 'tursoUrlPlaceholder')}" />
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
                            placeholder="${t('onboarding', 'tursoAuthTokenPlaceholder')}" />
                        </div>
                        <p class="supporting-text">${t('onboarding', 'tursoAuthTokenDescription')}</p>
                      </div>
                    </div>
                  ` : ''}
                </li>
              </ul>

              ${form.errorMessage ? html`
                <p style="color: var(--md-sys-color-error); margin-top: 16px;">${form.errorMessage}</p>
              ` : ''}
            </div>
          </form>
        </dialog>
      `);
    });
  }
}

defineWebComponent('onboarding-database-view', OnboardingDatabaseViewElement);
