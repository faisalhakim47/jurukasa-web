import { html } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useReady } from '#web/contexts/ready-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useMounted } from '#web/hooks/use-mounted.js';
import { useContext } from '#web/hooks/use-context.js';
import { useElement } from '#web/hooks/use-element.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { scrollIntoView } from '#web/tools/dom.js';

import '#web/components/material-symbols.js';
import '#web/components/router-link.js';
import '#web/views/account-reconciliation-list-view.js';
import '#web/views/cash-count-list-view.js';

export class ReconciliationViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const router = useContext(host, RouterContextElement);
    const t = useTranslator(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const accountReconciliationTabpanel = useElement(host, HTMLElement);
    const cashCountTabpanel = useElement(host, HTMLElement);

    function syncRouteToTabpanel() {
      if (!(accountReconciliationTabpanel.value instanceof HTMLElement)) return;
      if (!(cashCountTabpanel.value instanceof HTMLElement)) return;

      const pathname = router.route.pathname;
      if (pathname === '/reconciliation' || pathname === '/reconciliation/') { /** evaluate default path on mounted */ }
      else if (pathname.startsWith('/reconciliation/account-reconciliation')) scrollIntoView(accountReconciliationTabpanel.value);
      else if (pathname.startsWith('/reconciliation/cash-count')) scrollIntoView(cashCountTabpanel.value);
    }

    useEffect(host, syncRouteToTabpanel);
    useReady(host, syncRouteToTabpanel); // sync on ready for initial scrollIntoView to works
    useMounted(host, function evaluateDefaultRoute() {
      const pathname = router.route?.pathname;
      if (pathname === '/reconciliation' || pathname === '/reconciliation/') {
        router.navigate({ pathname: '/reconciliation/account-reconciliation', replace: true });
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
          if (tabIndex === 0) router.navigate({ pathname: '/reconciliation/account-reconciliation', replace: true });
          else if (tabIndex === 1) router.navigate({ pathname: '/reconciliation/cash-count', replace: true });
          else router.navigate({ pathname: '/reconciliation/account-reconciliation', replace: true });
        });
      });
    }

    useEffect(host, function renderReconciliationView() {
      const pathname = router.route.pathname;
      render(html`
        <div style="height: 100%; display: flex; flex-direction: column; max-width: 1280px; margin: 0 auto;">
          <header class="app-bar" style="width: 100%; flex-shrink: 0;">
            <hgroup>
              <h1>${t('reconciliation', 'reconciliationTitle')}</h1>
              <p>${t('reconciliation', 'reconciliationDescription')}</p>
            </hgroup>
          </header>
          <nav
            role="tablist"
            aria-label="${t('reconciliation', 'reconciliationSectionsAriaLabel')}"
            style="position: sticky; top: 0; z-index: 1; width: 100%; flex-shrink: 0;"
          >
            <router-link role="tab" id="account-reconciliation-tab" aria-controls="account-reconciliation-panel" href="/reconciliation/account-reconciliation" replace>
              <span class="content">
                <material-symbols name="rule" size="24"></material-symbols>
                ${t('reconciliation', 'accountReconciliationTabLabel')}
              </span>
            </router-link>
            <router-link role="tab" id="cash-count-tab" aria-controls="cash-count-panel" href="/reconciliation/cash-count" replace>
              <span class="content">
                <material-symbols name="payments" size="24"></material-symbols>
                ${t('reconciliation', 'cashCountTabLabel')}
              </span>
            </router-link>
          </nav>
          <main
            @scrollend=${handleTabpanelContainerScrollEnd}
            style="
              flex: 1;
              display: flex;
              flex-direction: row;
              width: 100%;
              max-width: 1280px;
              margin: 0 auto;
              overflow-x: auto;
              overflow-y: hidden;
              overscroll-behavior-x: contain;
              scroll-snap-type: x mandatory;
              scroll-behavior: smooth;
              scrollbar-width: none;
            "
          >
            <account-reconciliation-list-view
              ${accountReconciliationTabpanel}
              id="account-reconciliation-panel"
              role="tabpanel"
              aria-labelledby="account-reconciliation-tab"
              aria-hidden="${pathname.startsWith('/reconciliation/account-reconciliation') ? 'false' : 'true'}"
              tabindex="${pathname.startsWith('/reconciliation/account-reconciliation') ? '0' : '-1'}"
              ?inert=${pathname.startsWith('/reconciliation/account-reconciliation') === false}
              style="
                flex: 0 0 100%;
                width: 100%;
                min-width: 0;
                scroll-snap-align: start;
                scroll-snap-stop: always;
                overflow-y: auto;
              "
            ></account-reconciliation-list-view>
            <cash-count-list-view
              ${cashCountTabpanel}
              id="cash-count-panel"
              role="tabpanel"
              aria-labelledby="cash-count-tab"
              aria-hidden="${pathname.startsWith('/reconciliation/cash-count') ? 'false' : 'true'}"
              tabindex="${pathname.startsWith('/reconciliation/cash-count') ? '0' : '-1'}"
              ?inert=${pathname.startsWith('/reconciliation/cash-count') === false}
              style="
                flex: 0 0 100%;
                width: 100%;
                min-width: 0;
                scroll-snap-align: start;
                scroll-snap-stop: always;
                overflow-y: auto;
              "
            ></cash-count-list-view>
          </main>
        </div>
      `);
    });
  }
}

defineWebComponent('reconciliation-view', ReconciliationViewElement);
