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
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

import '#web/components/material-symbols.js';
import '#web/components/router-link.js';
import '#web/views/inventories-view.js';
import '#web/views/barcodes-view.js';
import '#web/views/stock-takings-view.js';
import '#web/views/stock-taking-creation-view.js';

export class StockViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const router = useContext(host, RouterContextElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const inventoriesTabpanel = useElement(host, HTMLElement);
    const barcodesTabpanel = useElement(host, HTMLElement);
    const stockTakingCreationTabpanel = useElement(host, HTMLElement);
    const stockTakingsTabpanel = useElement(host, HTMLElement);
    const notfoundDialog = useDialog(host);

    /** @param {HTMLElement} element */
    function scrollIntoView(element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }

    function syncRouteToTabpanel() {
      if (!(inventoriesTabpanel.value instanceof HTMLElement)) return;
      if (!(barcodesTabpanel.value instanceof HTMLElement)) return;
      if (!(stockTakingCreationTabpanel.value instanceof HTMLElement)) return;
      if (!(stockTakingsTabpanel.value instanceof HTMLElement)) return;

      notfoundDialog.open = false;
      const pathname = router.route.pathname;
      if (pathname === '/stock' || pathname === '/stock/') { /** evaluate default path on mounted */ }
      else if (pathname.startsWith('/stock/inventories')) scrollIntoView(inventoriesTabpanel.value);
      else if (pathname.startsWith('/stock/barcodes')) scrollIntoView(barcodesTabpanel.value);
      else if (pathname.startsWith('/stock/create-stock-taking')) scrollIntoView(stockTakingCreationTabpanel.value);
      else if (pathname.startsWith('/stock/stock-takings')) scrollIntoView(stockTakingsTabpanel.value);
      else {
        notfoundDialog.open = true;
      }
    }

    useEffect(host, syncRouteToTabpanel);
    useReady(host, syncRouteToTabpanel); // sync on ready for initial scrollIntoView to works
    useMounted(host, function evaluateDefaultRoute() {
      const pathname = router.route?.pathname;
      if (pathname === '/stock' || pathname === '/stock/') {
        router.navigate({ pathname: '/stock/inventories', replace: true });
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
          if (tabIndex === 0) router.navigate({ pathname: '/stock/inventories', replace: true });
          else if (tabIndex === 1) router.navigate({ pathname: '/stock/barcodes', replace: true });
          else if (tabIndex === 2) router.navigate({ pathname: '/stock/create-stock-taking', replace: true });
          else if (tabIndex === 3) router.navigate({ pathname: '/stock/stock-takings', replace: true });
          else router.navigate({ pathname: '/stock/inventories', replace: true });
        });
      });
    }

    useEffect(host, function renderStockView() {
      render(html`
        <div style="height: 100%; display: flex; flex-direction: column;">
          <header class="app-bar" style="max-width: 1280px; margin: 0 auto; width: 100%; flex-shrink: 0;">
            <hgroup>
              <h1>Stock Management</h1>
              <p>Manage your inventory and stock audits.</p>
            </hgroup>
          </header>
          <nav
            role="tablist"
            aria-label="Stock management sections"
            style="position: sticky; top: 0; z-index: 1; max-width: 1280px; margin: 0 auto; width: 100%; flex-shrink: 0;"
          >
            <router-link role="tab" id="inventories-tab" aria-controls="inventories-panel" href="/stock/inventories" replace>
              <span class="content">
                <material-symbols name="inventory_2" size="24"></material-symbols>
                Inventories
              </span>
            </router-link>
            <router-link role="tab" id="barcodes-tab" aria-controls="barcodes-panel" href="/stock/barcodes" replace>
              <span class="content">
                <material-symbols name="barcode" size="24"></material-symbols>
                Barcodes
              </span>
            </router-link>
            <router-link role="tab" id="stock-taking-creation-tab" aria-controls="stock-taking-creation-panel" href="/stock/create-stock-taking" replace>
              <span class="content">
                <material-symbols name="add_box" size="24"></material-symbols>
                New Stock Taking
              </span>
            </router-link>
            <router-link role="tab" id="stock-takings-tab" aria-controls="stock-takings-panel" href="/stock/stock-takings" replace>
              <span class="content">
                <material-symbols name="fact_check" size="24"></material-symbols>
                Stock Takings
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
            <inventories-view
              ${inventoriesTabpanel}
              id="inventories-panel"
              role="tabpanel"
              aria-labelledby="inventories-tab"
              aria-hidden="${router.route.pathname.startsWith('/stock/inventories') ? 'false' : 'true'}"
              tabindex="${router.route.pathname.startsWith('/stock/inventories') ? '0' : '-1'}"
              ?inert=${router.route.pathname.startsWith('/stock/inventories') === false}
              style="
                flex: 0 0 100%;
                width: 100%;
                min-width: 0;
                scroll-snap-align: start;
                scroll-snap-stop: always;
                overflow-y: auto;
              "
            ></inventories-view>
            <barcodes-view
              ${barcodesTabpanel}
              id="barcodes-panel"
              role="tabpanel"
              aria-labelledby="barcodes-tab"
              aria-hidden="${router.route.pathname.startsWith('/stock/barcodes') ? 'false' : 'true'}"
              tabindex="${router.route.pathname.startsWith('/stock/barcodes') ? '0' : '-1'}"
              ?inert=${router.route.pathname.startsWith('/stock/barcodes') === false}
              style="
                flex: 0 0 100%;
                width: 100%;
                min-width: 0;
                scroll-snap-align: start;
                scroll-snap-stop: always;
                overflow-y: auto;
              "
            ></barcodes-view>
            <stock-taking-creation-view
              ${stockTakingCreationTabpanel}
              id="stock-taking-creation-panel"
              role="tabpanel"
              aria-labelledby="stock-taking-creation-tab"
              aria-hidden="${router.route.pathname.startsWith('/stock/create-stock-taking') ? 'false' : 'true'}"
              tabindex="${router.route.pathname.startsWith('/stock/create-stock-taking') ? '0' : '-1'}"
              ?inert=${router.route.pathname.startsWith('/stock/create-stock-taking') === false}
              style="
                flex: 0 0 100%;
                width: 100%;
                min-width: 0;
                scroll-snap-align: start;
                scroll-snap-stop: always;
                overflow-y: auto;
              "
            ></stock-taking-creation-view>
            <stock-takings-view
              ${stockTakingsTabpanel}
              id="stock-takings-panel"
              role="tabpanel"
              aria-labelledby="stock-takings-tab"
              aria-hidden="${router.route.pathname.startsWith('/stock/stock-takings') ? 'false' : 'true'}"
              tabindex="${router.route.pathname.startsWith('/stock/stock-takings') ? '0' : '-1'}"
              ?inert=${router.route.pathname.startsWith('/stock/stock-takings') === false}
              style="
                flex: 0 0 100%;
                width: 100%;
                min-width: 0;
                scroll-snap-align: start;
                scroll-snap-stop: always;
                overflow-y: auto;
              "
            ></stock-takings-view>
          </main>
        </div>
        <dialog ${notfoundDialog.element} id="notfound-dialog">
          <div class="container">
            <header>
              <h2>Page Not Found</h2>
            </header>
            <section class="content">
              <p>The page you are looking for does not exist.</p>
            </section>
            <menu>
              <router-link
                href="/stock/inventories"
                replace
              >Go to Inventories</router-link>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('stock-view', StockViewElement);
