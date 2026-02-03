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

    useEffect(host, function evaluateOnboardingState() {
      console.debug('main-view', 'evaluateOnboardingState', router.route?.pathname, typeof router.route?.pathname === 'string', database.isReady, database.state);
      const pathname = router.route?.pathname;
      if (typeof pathname === 'string' && database.isReady && database.state === 'unconfigured') {
        // Only redirect to welcome if not already on an onboarding path
        // This allows navigation to /onboarding/database and other onboarding steps
        if (!pathname.startsWith('/onboarding')) {
          router.navigate({ pathname: '/onboarding/welcome', replace: true });
        }
      }
    });

    useEffect(host, function renderMainView() {
      const pathname = router.route?.pathname || '/';

      console.debug('main-view', 'renderMainView', pathname, device.isDesktop);

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
