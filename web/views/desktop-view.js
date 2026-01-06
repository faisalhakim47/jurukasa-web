import { html } from 'lit-html';
import { defineWebComponent } from '#web/component.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { webStyleSheets } from '#web/styles.js';

import '#web/components/material-symbols.js';
import '#web/components/router-link.js';
import '#web/views/books-view.js';
import '#web/views/dashboard-view.js';
import '#web/views/pos-view.js';
import '#web/views/procurement-view.js';
import '#web/views/purchase-creation-view.js';
import '#web/views/sale-view.js';
import '#web/views/settings-view.js';
import '#web/views/stock-view.js';

/**
 * Material 3 Expressive Desktop Layout
 * 
 * Provides a two-column layout with:
 * 1. Persistent Navigation rail on the inline-start side (left)
 * 2. Main content area
 */
export class DesktopViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const router = useContext(host, RouterContextElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    useEffect(host, function initialRoute() {
      if (router.route.pathname === '/') {
        router.navigate({ pathname: '/dashboard', replace: true });
      }
    });

    function renderContent() {
      const pathname = router.route?.pathname;
      if (pathname === '/dashboard') return html`<dashboard-view></dashboard-view>`;
      else if (pathname.startsWith('/books')) return html`<books-view></books-view>`;
      else if (pathname.startsWith('/stock')) return html`<stock-view></stock-view>`;
      else if (pathname.startsWith('/procurement/purchase-creation')) return html`<purchase-creation-view></purchase-creation-view>`;
      else if (pathname.startsWith('/procurement')) return html`<procurement-view></procurement-view>`;
      else if (pathname.startsWith('/sale/point-of-sales')) return html`<pos-view></pos-view>`;
      else if (pathname.startsWith('/sale')) return html`<sale-view></sale-view>`;
      else if (pathname.startsWith('/settings')) return html`<settings-view></settings-view>`;
      else return html`
        <div style="padding: 32px;">
          <h1>404 - Page Not Found</h1>
          <p>The page you are looking for does not exist.</p>
        </div>
      `;
    }

    useEffect(host, function renderDesktopLayout() {
      const currentPath = router.route?.pathname || '/';
      render(html`
        <div style="display: flex; flex-direction: row; height: 100vh; width: 100vw;">
          <aside>
            <nav aria-label="Main Navigation">
              <router-link href="/dashboard" aria-current=${currentPath === '/' ? 'page' : 'false'}>
                <material-symbols name="dashboard"></material-symbols>
                <span>Dash</span>
              </router-link>
              <router-link href="/books" aria-current=${currentPath.startsWith('/books') ? 'page' : 'false'}>
                <material-symbols name="menu_book"></material-symbols>
                <span>Books</span>
              </router-link>
              <router-link href="/stock" aria-current=${currentPath.startsWith('/stock') ? 'page' : 'false'}>
                <material-symbols name="inventory_2"></material-symbols>
                <span>Stock</span>
              </router-link>
              <router-link href="/procurement" aria-current=${currentPath.startsWith('/procurement') ? 'page' : 'false'}>
                <material-symbols name="shopping_cart"></material-symbols>
                <span>Procure</span>
              </router-link>
              <router-link href="/sale" aria-current=${currentPath.startsWith('/sale') ? 'page' : 'false'}>
                <material-symbols name="receipt_long"></material-symbols>
                <span>Sale</span>
              </router-link>
              <div style="flex-grow: 1;"></div>
              <hr />
              <router-link href="/settings" aria-current=${currentPath === '/settings' ? 'page' : 'false'}>
                <material-symbols name="settings"></material-symbols>
                <span>Settings</span>
              </router-link>
            </nav>
          </aside>
          <div style="flex-grow: 1; overflow: auto;">
            ${renderContent()}
          </div>
        </div>
      `);
    });
  }
}

defineWebComponent('desktop-view', DesktopViewElement);
