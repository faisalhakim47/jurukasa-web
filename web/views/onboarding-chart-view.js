import { reactive } from '@vue/reactivity';
import { html } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';

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

export class OnboardingChartViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const router = useContext(host, RouterContextElement);
    const t = useTranslator(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      templateNames: /** @type {string[]} */ ([]),
      formState: /** @type {'ready'|'submitting'|'failure'|'success'} */ ('ready'),
      errorMessage: /** @type {string} */ (undefined),
    });

    function loadChartOfAccountsTemplates() {
      database.sql`SELECT name FROM chart_of_accounts_templates`
        .then(function assignTemplates(result) {
          state.templateNames = result.rows.map(function rowToTemplateName(row) { return String(row.name); });
        });
    }

    /** @param {SubmitEvent} event */
    async function submitChartOfAccounts(event) {
      event.preventDefault();
      const form = /** @type {HTMLFormElement} */ (event.currentTarget);
      const formData = new FormData(form);

      state.formState = 'submitting';

      const tx = await database.transaction('write');
      try {
        await tx.sql`INSERT INTO chart_of_accounts_templates (name) VALUES (${formData.get('template-name')})`;
        await tx.commit();
        state.formState = 'success';
        await feedbackDelay();
        router.navigate({ pathname: '/dashboard', replace: true });
      }
      catch (error) {
        console.error('Failed to submit chart of accounts', error);
        try { await tx.rollback(); } catch (error) { console.error('Failed to rollback transaction', error); }
        state.formState = 'failure';
        state.errorMessage = error.message;
        await feedbackDelay();
        state.formState = 'ready';
      }
    }

    useEffect(host, function loadTemplatesOnMount() {
      loadChartOfAccountsTemplates();
    });

    useEffect(host, function renderOnboardingChartView() {
      const formState = state.formState;
      const formDisabled = formState !== 'ready';

      if (state.templateNames.length === 0) {
        render(html`
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
        `);
        return;
      }

      render(html`
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
                ${repeat(state.templateNames, (t) => t, (templateName, index) => html`
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
              ${state.errorMessage ? html`
                <p style="color: var(--md-sys-color-error); margin-top: 16px;">${state.errorMessage}</p>
              ` : ''}
            </div>
          </form>
        </dialog>
      `);
    });
  }
}

defineWebComponent('onboarding-chart-view', OnboardingChartViewElement);
