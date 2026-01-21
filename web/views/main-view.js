import { reactive } from '@vue/reactivity';
import { html } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { DeviceContextElement } from '#web/contexts/device-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';

import '#web/components/router-link.js';
import '#web/views/books-view.js';
import '#web/views/dashboard-view.js';
import '#web/views/database-setup-view.js';
import '#web/views/desktop-view.js';
import '#web/views/onboarding-view.js';

export class MainViewElement extends HTMLElement {
  constructor() {
    super();
    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const device = useContext(host, DeviceContextElement);
    const router = useContext(host, RouterContextElement);
    const t = useTranslator(host);
    const render = useRender(host);

    const onboarding = reactive({
      state: /** @type {'init'|'needs-database'|'needs-business-config'|'needs-chart-of-accounts'|'complete'} */ ('init'),
    });

    useBusyStateUntil(host, function evaluateReady() {
      return onboarding.state !== 'init';
    });

    useEffect(host, function evaluateOnboardingState() {
      if (onboarding.state === 'complete') { /* nothing to do */ }
      else if (database.isReady && database.state === 'unconfigured') {
        onboarding.state = 'needs-database';
      }
      else if (database.isReady && database.state === 'connected') {
        database.sql`SELECT value FROM config WHERE key = 'Business Name' LIMIT 1;`
          .then(function handleBusinessName(result) {
            const row = result.rows[0];
            const isBusinessConfigured = String(row?.value || '').trim().length > 0;
            if (isBusinessConfigured) {
              database.sql`SELECT COUNT(*) AS count FROM accounts`
                .then(function handleAccountsCount(result) {
                  const count = Number(result.rows[0]?.count || 0);
                  if (count > 0) onboarding.state = 'complete';
                  else onboarding.state = 'needs-chart-of-accounts';
                });
            }
            else onboarding.state = 'needs-business-config';
          })
          .catch(function (error) {
            console.error('Failed to check configuration', error);
            onboarding.state = 'needs-business-config';
          });
      }
    });

    useEffect(host, function handleOnboardingRedirect() {
      const pathname = router.route?.pathname || '/';
      const needsOnboarding = onboarding.state === 'needs-database'
        || onboarding.state === 'needs-business-config'
        || onboarding.state === 'needs-chart-of-accounts';
      const isComplete = onboarding.state === 'complete';

      if (needsOnboarding && !pathname.startsWith('/onboarding') && !pathname.startsWith('/database-setup')) {
        router.navigate({ pathname: '/onboarding', replace: true });
      }
      else if (isComplete && pathname.startsWith('/onboarding')) {
        router.navigate({ pathname: '/dashboard', replace: true });
      }
    });

    useEffect(host, function renderMainView() {
      const pathname = router.route?.pathname || '/';

      if (pathname.startsWith('/onboarding')) {
        render(html`<onboarding-view></onboarding-view>`);
        return;
      }

      if (pathname.startsWith('/database-setup')) {
        render(html`<database-setup-view></database-setup-view>`);
        return;
      }

      if (device.isDesktop) render(html`<desktop-view></desktop-view>`);
      else if (device.isMobile) render(html`
        <div style="padding: 32px;">
          <h1>${t('common', 'mobileNotSupportedTitle')}</h1>
          <p>${t('common', 'mobileNotSupportedMessage')}</p>
        </div>
      `);
      else render(html`
        <div style="padding: 32px;">
          <h1>${t('common', 'unknownDeviceTitle')}</h1>
          <p>${t('common', 'unknownDeviceMessage')}</p>
        </div>
      `);
    });
  }
}

defineWebComponent('main-view', MainViewElement);
