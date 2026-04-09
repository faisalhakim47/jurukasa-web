import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';

import { defineWebComponent } from '#web/component.js';
import { SessionContextElement } from '#web/contexts/session-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/desktop/styles.js';

import '#web/desktop/components/material-symbols.js';

export class SessionSelectorViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const session = useContext(host, SessionContextElement);
    const router = useContext(host, RouterContextElement);
    const t = useTranslator(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    function handleSessionClick(sessionId) {
      session.selectSession(sessionId);
      router.navigate({ pathname: '/dashboard', replace: true });
    }

    function handleGoToOnboarding() {
      router.navigate({ pathname: '/onboarding/welcome' });
    }

    useEffect(host, function renderSessionSelectorView() {
      const sessions = session.sessions || [];
      const hasSessions = sessions.length > 0;

      render(html`
        <div style="padding: 24px; max-width: 600px; margin: 0 auto;">
          <header style="margin-bottom: 24px;">
            <h2>${t('session', 'sessionSelectorTitle')}</h2>
          </header>

          ${hasSessions ? html`
            <ul role="list" style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 12px;">
              ${repeat(sessions, (s) => s.id, (sessionItem) => html`
                <li role="listitem">
                  <button
                    role="button"
                    type="button"
                    class="outlined"
                    style="width: 100%; display: flex; align-items: center; gap: 12px; padding: 16px; justify-content: flex-start;"
                    @click=${() => handleSessionClick(sessionItem.id)}
                  >
                    <material-symbols name="database"></material-symbols>
                    <div style="text-align: left;">
                      <div style="font-weight: 500;">${sessionItem.database.name}</div>
                      <div style="font-size: 0.875rem; color: var(--md-sys-color-on-surface-variant);">
                        ${sessionItem.database.provider === 'local' ? t('session', 'localProviderLabel') : t('session', 'tursoProviderLabel')}
                      </div>
                    </div>
                  </button>
                </li>
              `)}
            </ul>
          ` : html`
            <div style="text-align: center; padding: 48px 24px;">
              <material-symbols name="folder_off" size="48" style="color: var(--md-sys-color-on-surface-variant);"></material-symbols>
              <h3 style="margin-top: 16px;">${t('session', 'sessionSelectorNoSessions')}</h3>
              <p style="margin-top: 8px; color: var(--md-sys-color-on-surface-variant);">
                ${t('session', 'sessionSelectorNoSessionsMessage')}
              </p>
              <button
                role="button"
                type="button"
                class="filled"
                @click=${handleGoToOnboarding}
                style="margin-top: 24px;"
              >${t('session', 'sessionSelectorGoToOnboarding')}</button>
            </div>
          `}

          ${hasSessions ? html`
            <div style="margin-top: 24px; text-align: center;">
              <button
                role="button"
                type="button"
                class="text"
                @click=${handleGoToOnboarding}
              >${t('session', 'sessionSelectorCreateNew')}</button>
            </div>
          ` : nothing}
        </div>
      `);
    });
  }
}

defineWebComponent('session-selector-view', SessionSelectorViewElement);
