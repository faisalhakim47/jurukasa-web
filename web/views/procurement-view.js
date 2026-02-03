import { html } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useReady } from '#web/contexts/ready-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useElement } from '#web/hooks/use-element.js';
import { useEffect, useEffectAfterHook } from '#web/hooks/use-effect.js';
import { useMounted } from '#web/hooks/use-mounted.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { scrollIntoView } from '#web/tools/dom.js';

import '#web/components/material-symbols.js';
import '#web/components/router-link.js';
import '#web/views/purchases-view.js';
import '#web/views/suppliers-view.js';

export class ProcurementViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const router = useContext(host, RouterContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const purchasesTabpanel = useElement(host, HTMLElement);
    const suppliersTabpanel = useElement(host, HTMLElement);
    const notfoundDialog = useDialog(host);

    function syncRouteToTabpanel() {
      if (!(purchasesTabpanel.value instanceof HTMLElement)) return;
      if (!(suppliersTabpanel.value instanceof HTMLElement)) return;

      notfoundDialog.open = false;
      const pathname = router.route.pathname;
      if (pathname === '/procurement' || pathname === '/procurement/') { /** evaluate default path on mounted */ }
      else if (pathname.startsWith('/procurement/purchases')) scrollIntoView(purchasesTabpanel.value);
      else if (pathname.startsWith('/procurement/suppliers')) scrollIntoView(suppliersTabpanel.value);
      else {
        notfoundDialog.open = true;
      }
    }

    useEffect(host, syncRouteToTabpanel);
    useReady(host, syncRouteToTabpanel); // sync on ready for initial scrollIntoView to works
    useEffectAfterHook(host, useMounted, function evaluateDefaultRoute() {
      const pathname = router.route?.pathname;
      if (pathname === '/procurement' || pathname === '/procurement/') {
        router.navigate({ pathname: '/procurement/purchases', replace: true });
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
          if (tabIndex === 0) router.navigate({ pathname: '/procurement/purchases', replace: true });
          else if (tabIndex === 1) router.navigate({ pathname: '/procurement/suppliers', replace: true });
          else router.navigate({ pathname: '/procurement/purchases', replace: true });
        });
      });
    }

    useEffect(host, function renderProcurementView() {
      render(html`
        <div style="height: 100%; display: flex; flex-direction: column;">
          <header class="app-bar" style="max-width: 1280px; margin: 0 auto; width: 100%; flex-shrink: 0;">
            <hgroup>
              <h1>${t('common', 'procurementTitle')}</h1>
              <p>${t('common', 'procurementDescription')}</p>
            </hgroup>
          </header>
          <nav
            role="tablist"
            aria-label=${t('common', 'procurementSectionsAriaLabel')}
            style="position: sticky; top: 0; z-index: 1; max-width: 1280px; margin: 0 auto; width: 100%; flex-shrink: 0;"
          >
            <a is="router-link" role="tab" id="purchases-tab" aria-controls="purchases-panel" href="/procurement/purchases" data-replace>
              <span class="content">
                <material-symbols name="shopping_cart" size="24"></material-symbols>
                ${t('common', 'purchasesTabLabel')}
              </span>
            </a>
            <a is="router-link" role="tab" id="suppliers-tab" aria-controls="suppliers-panel" href="/procurement/suppliers" data-replace>
              <span class="content">
                <material-symbols name="local_shipping" size="24"></material-symbols>
                ${t('common', 'suppliersTabLabel')}
              </span>
            </a>
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
            <purchases-view
              ${purchasesTabpanel}
              id="purchases-panel"
              role="tabpanel"
              aria-labelledby="purchases-tab"
              aria-hidden="${router.route.pathname.startsWith('/procurement/purchases') ? 'false' : 'true'}"
              tabindex="${router.route.pathname.startsWith('/procurement/purchases') ? '0' : '-1'}"
              ?inert=${router.route.pathname.startsWith('/procurement/purchases') === false}
            ></purchases-view>
            <suppliers-view
              ${suppliersTabpanel}
              id="suppliers-panel"
              role="tabpanel"
              aria-labelledby="suppliers-tab"
              aria-hidden="${router.route.pathname.startsWith('/procurement/suppliers') ? 'false' : 'true'}"
              tabindex="${router.route.pathname.startsWith('/procurement/suppliers') ? '0' : '-1'}"
              ?inert=${router.route.pathname.startsWith('/procurement/suppliers') === false}
            ></suppliers-view>
          </main>
        </div>
        <dialog ${notfoundDialog.element} id="notfound-dialog">
          <div class="container">
            <header>
              <h2>${t('common', 'pageNotFoundTitle')}</h2>
            </header>
            <section class="content">
              <p>${t('common', 'pageNotFoundMessage')}</p>
            </section>
            <menu>
              <a
                is="router-link"
                href="/procurement/purchases"
                data-replace
              >${t('common', 'goToPurchasesButtonLabel')}</a>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('procurement-view', ProcurementViewElement);
