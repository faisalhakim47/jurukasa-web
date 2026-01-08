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
import '#web/views/discounts-view.js';
import '#web/views/pos-view.js';
import '#web/views/sales-view.js';

export class SaleViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const router = useContext(host, RouterContextElement);
    const t = useTranslator(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const salesTabpanel = useElement(host, HTMLElement);
    const discountsTabpanel = useElement(host, HTMLElement);
    const notfoundDialog = useDialog(host);

    function syncRouteToTabpanel() {
      if (!(salesTabpanel.value instanceof HTMLElement)) return;
      if (!(discountsTabpanel.value instanceof HTMLElement)) return;
      notfoundDialog.open = false;
      const pathname = router.route.pathname;
      if (pathname === '/sale' || pathname === '/sale/') { /** evaluate default path on mounted */ }
      else if (pathname.startsWith('/sale/sales')) scrollIntoView(salesTabpanel.value);
      else if (pathname.startsWith('/sale/discounts')) scrollIntoView(discountsTabpanel.value);
      else notfoundDialog.open = true;
    }

    useEffect(host, syncRouteToTabpanel);
    useReady(host, syncRouteToTabpanel); // sync on ready for initial scrollIntoView to works
    useMounted(host, function evaluateDefaultRoute() {
      const pathname = router.route?.pathname;
      if (pathname === '/sale' || pathname === '/sale/') {
        router.navigate({ pathname: '/sale/sales', replace: true });
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
          if (tabIndex === 0) router.navigate({ pathname: '/sale/sales', replace: true });
          else if (tabIndex === 1) router.navigate({ pathname: '/sale/discounts', replace: true });
          else router.navigate({ pathname: '/sale/sales', replace: true });
        });
      });
    }

    useEffect(host, function renderSaleView() {
      render(html`
        <div style="height: 100%; display: flex; flex-direction: column;">
          <header class="app-bar" style="max-width: 1280px; margin: 0 auto; width: 100%; flex-shrink: 0;">
            <hgroup>
              <h1>${t('sale', 'saleViewTitle')}</h1>
              <p>${t('sale', 'saleViewDescription')}</p>
            </hgroup>
          </header>
          <nav
            role="tablist"
            aria-label="${t('sale', 'saleSectionsAriaLabel')}"
            style="position: sticky; top: 0; z-index: 1; max-width: 1280px; margin: 0 auto; width: 100%; flex-shrink: 0;"
          >
            <router-link role="tab" id="sales-tab" aria-controls="sales-panel" href="/sale/sales" replace>
              <span class="content">
                <material-symbols name="receipt_long" size="24"></material-symbols>
                ${t('sale', 'salesTabLabel')}
              </span>
            </router-link>
            <router-link role="tab" id="discounts-tab" aria-controls="discounts-panel" href="/sale/discounts" replace>
              <span class="content">
                <material-symbols name="percent" size="24"></material-symbols>
                ${t('sale', 'discountsTabLabel')}
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
            <sales-view
              ${salesTabpanel}
              id="sales-panel"
              role="tabpanel"
              aria-labelledby="sales-tab"
              aria-hidden="${router.route.pathname.startsWith('/sale/sales') ? 'false' : 'true'}"
              tabindex="${router.route.pathname.startsWith('/sale/sales') ? '0' : '-1'}"
              ?inert=${router.route.pathname.startsWith('/sale/sales') === false}
              style="
                flex: 0 0 100%;
                width: 100%;
                min-width: 0;
                scroll-snap-align: start;
                scroll-snap-stop: always;
                overflow-y: auto;
              "
            ></sales-view>
            <discounts-view
              ${discountsTabpanel}
              id="discounts-panel"
              role="tabpanel"
              aria-labelledby="discounts-tab"
              aria-hidden="${router.route.pathname.startsWith('/sale/discounts') ? 'false' : 'true'}"
              tabindex="${router.route.pathname.startsWith('/sale/discounts') ? '0' : '-1'}"
              ?inert=${router.route.pathname.startsWith('/sale/discounts') === false}
              style="
                flex: 0 0 100%;
                width: 100%;
                min-width: 0;
                scroll-snap-align: start;
                scroll-snap-stop: always;
                overflow-y: auto;
              "
            ></discounts-view>
          </main>
        </div>
        <dialog ${notfoundDialog.element} id="notfound-dialog">
          <div class="container">
            <header>
              <h2>${t('sale', 'pageNotFoundTitle')}</h2>
            </header>
            <section class="content">
              <p>${t('sale', 'pageNotFoundMessage')}</p>
            </section>
            <menu>
              <router-link
                href="/sale/sales"
                replace
              >${t('sale', 'goToSalesButtonLabel')}</router-link>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('sale-view', SaleViewElement);
