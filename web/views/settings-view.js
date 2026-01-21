import { html } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useReady } from '#web/contexts/ready-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useElement } from '#web/hooks/use-element.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useMounted } from '#web/hooks/use-mounted.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { scrollIntoView } from '#web/tools/dom.js';

import '#web/components/material-symbols.js';
import '#web/components/router-link.js';
import '#web/views/accounting-configuration-view.js';
import '#web/views/database-management-view.js';
import '#web/views/payment-methods-view.js';

export class SettingsViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const router = useContext(host, RouterContextElement);
    const t = useTranslator(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const accountingTabpanel = useElement(host, HTMLElement);
    const paymentsTabpanel = useElement(host, HTMLElement);
    const databaseTabpanel = useElement(host, HTMLElement);
    const notfoundDialog = useDialog(host);

    function syncRouteToTabpanel() {
      if (!(accountingTabpanel.value instanceof HTMLElement)) return;
      if (!(paymentsTabpanel.value instanceof HTMLElement)) return;
      if (!(databaseTabpanel.value instanceof HTMLElement)) return;

      notfoundDialog.open = false;
      const pathname = router.route.pathname;
      if (pathname === '/settings' || pathname === '/settings/') { /** evaluate default path on mounted */ }
      else if (pathname.startsWith('/settings/accounting')) scrollIntoView(accountingTabpanel.value);
      else if (pathname.startsWith('/settings/payments')) scrollIntoView(paymentsTabpanel.value);
      else if (pathname.startsWith('/settings/database')) scrollIntoView(databaseTabpanel.value);
      else {
        notfoundDialog.open = true;
      }
    }

    useEffect(host, syncRouteToTabpanel);
    useReady(host, syncRouteToTabpanel); // sync on ready for initial scrollIntoView to works
    useMounted(host, function evaluateDefaultRoute() {
      const pathname = router.route?.pathname;
      if (pathname === '/settings' || pathname === '/settings/') {
        router.navigate({ pathname: '/settings/accounting', replace: true });
      }
    });

    /** @param {Event} event */
    function handleTabpanelContainerScrollEnd(event) {
      const container = event.currentTarget;
      assertInstanceOf(HTMLElement, container);
      requestAnimationFrame(function makeSureScrollEndedByAnimationFrame() {
        requestIdleCallback(function makeSureScrollEndedByIdle() {
          const scrollLeft = container.scrollLeft;
          const containerWidth = container.clientWidth;
          const tabIndex = Math.round(scrollLeft / containerWidth);
          if (tabIndex === 0) router.navigate({ pathname: '/settings/accounting', replace: true });
          else if (tabIndex === 1) router.navigate({ pathname: '/settings/payments', replace: true });
          else if (tabIndex === 2) router.navigate({ pathname: '/settings/database', replace: true });
          else router.navigate({ pathname: '/settings/accounting', replace: true });
        });
      });
    }

    useEffect(host, function renderSettingsView() {
      render(html`
        <header class="app-bar" style="max-width: 1280px; margin: 0 auto; width: 100%; flex-shrink: 0;">
          <hgroup>
            <h1>${t('settings', 'settingsTitle')}</h1>
            <p>${t('settings', 'settingsDescription')}</p>
          </hgroup>
        </header>
        <nav
          role="tablist"
          aria-label="${t('settings', 'settingsSectionsAriaLabel')}"
          style="position: sticky; top: 0; z-index: 1; max-width: 1280px; margin: 0 auto; width: 100%; flex-shrink: 0;"
        >
          <router-link role="tab" aria-controls="accounting-panel" href="/settings/accounting" replace>
            <span class="content">
              <material-symbols name="settings" size="24"></material-symbols>
              ${t('settings', 'accountingConfigTabLabel')}
            </span>
          </router-link>
          <router-link role="tab" aria-controls="payments-panel" href="/settings/payments" replace>
            <span class="content">
              <material-symbols name="payments" size="24"></material-symbols>
              ${t('settings', 'paymentMethodsTabLabel')}
            </span>
          </router-link>
          <router-link role="tab" aria-controls="database-panel" href="/settings/database" replace>
            <span class="content">
              <material-symbols name="database" size="24"></material-symbols>
              ${t('settings', 'databaseTabLabel')}
            </span>
          </router-link>
        </nav>
        <main class="tabpanellist" style="max-width: 1280px;" @scrollend=${handleTabpanelContainerScrollEnd}>
          <accounting-configuration-view
            ${accountingTabpanel}
            id="accounting-panel"
            role="tabpanel"
            aria-label="${t('settings', 'accountingConfigTabLabel')}"
            aria-hidden="${router.route.pathname.startsWith('/settings/accounting') ? 'false' : 'true'}"
            tabindex="${router.route.pathname.startsWith('/settings/accounting') ? '0' : '-1'}"
            ?inert=${router.route.pathname.startsWith('/settings/accounting') === false}
          ></accounting-configuration-view>
          <payment-methods-view
            ${paymentsTabpanel}
            id="payments-panel"
            role="tabpanel"
            aria-label="${t('settings', 'paymentMethodsTabLabel')}"
            aria-hidden="${router.route.pathname.startsWith('/settings/payments') ? 'false' : 'true'}"
            tabindex="${router.route.pathname.startsWith('/settings/payments') ? '0' : '-1'}"
            ?inert=${router.route.pathname.startsWith('/settings/payments') === false}
          ></payment-methods-view>
          <database-management-view
            ${databaseTabpanel}
            id="database-panel"
            role="tabpanel"
            aria-label="${t('settings', 'databaseTabLabel')}"
            aria-hidden="${router.route.pathname.startsWith('/settings/database') ? 'false' : 'true'}"
            tabindex="${router.route.pathname.startsWith('/settings/database') ? '0' : '-1'}"
            ?inert=${router.route.pathname.startsWith('/settings/database') === false}
          ></database-management-view>
        </main>
        <dialog ${notfoundDialog.element} id="notfound-dialog">
          <div class="container">
            <header>
              <h2>${t('settings', 'pageNotFoundTitle')}</h2>
            </header>
            <section class="content">
              <p>${t('settings', 'pageNotFoundMessage')}</p>
            </section>
            <menu>
              <router-link
                href="/settings/accounting"
                replace
              >${t('settings', 'goToAccountingConfigButtonLabel')}</router-link>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('settings-view', SettingsViewElement);
