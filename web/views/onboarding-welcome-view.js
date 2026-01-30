import { reactive } from '@vue/reactivity';
import { html } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { DeviceContextElement } from '#web/contexts/device-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

import '#web/components/material-symbols.js';

export class OnboardingWelcomeViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const device = useContext(host, DeviceContextElement);
    const router = useContext(host, RouterContextElement);
    const t = useTranslator(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      selectedLanguage: 'en',
      selectedLanguageDisplay: 'English',
    });

    function goToDatabaseSetup() {
      device.setLanguage(state.selectedLanguage);
      router.navigate({ pathname: '/onboarding/database' });
    }

    /** @param {Event} event */
    function handleLanguageSelection(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      const selectedLanguage = event.currentTarget.value;
      const displayName = event.currentTarget.nextElementSibling.textContent.trim();
      state.selectedLanguage = selectedLanguage;
      state.selectedLanguageDisplay = displayName;
      device.setLanguage(selectedLanguage);
    }

    useEffect(host, function renderOnboardingWelcomeView() {
      render(html`
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
                        background-color: ${state.selectedLanguage === 'en' ? 'var(--md-sys-color-surface-container-high)' : 'var(--md-sys-color-surface-container-lowest)'};
                      ">
                      <input
                        type="radio"
                        name="language"
                        value="en"
                        @change=${handleLanguageSelection}
                        ?checked=${state.selectedLanguage === 'en'}
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
                      background-color: ${state.selectedLanguage === 'id' ? 'var(--md-sys-color-surface-container-high)' : 'var(--md-sys-color-surface-container-lowest)'};
                    ">
                      <input
                        type="radio"
                        name="language"
                        value="id"
                        @change=${handleLanguageSelection}
                        ?checked=${state.selectedLanguage === 'id'}
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
      `);
    });
  }
}

defineWebComponent('onboarding-welcome-view', OnboardingWelcomeViewElement);
