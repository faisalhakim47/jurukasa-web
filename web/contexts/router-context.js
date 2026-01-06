import { reactive, readonly } from '@vue/reactivity';
import { defineWebComponent } from '#web/component.js';
import { provideContext } from '#web/hooks/use-context.js';
import { useWindowEventListener } from '#web/hooks/use-window-event-listener.js';

/**
 * @typedef {object} Route
 * @property {string} pathname
 * @property {string} [tursoDatabaseUrl]
 * @property {string} [tursoDatabaseKey]
 */

export class RouterContextElement extends HTMLElement {
  constructor() {
    super();

    provideContext(this);

    const host = this;
    const persistedTursoDatabaseUrl = localStorage.getItem('tursoDatabaseUrl');
    const persistedTursoDatabaseKey = localStorage.getItem('tursoDatabaseKey');

    const route = reactive(/** @type {Route} */({
      pathname: window.location.pathname,
      tursoDatabaseUrl: persistedTursoDatabaseUrl || window.history.state?.tursoDatabaseUrl,
      tursoDatabaseKey: persistedTursoDatabaseKey || window.history.state?.tursoDatabaseKey,
    }));

    this.route = route;
    // this.route = readonly(route);

    function syncNavigatorToRouter() {
      route.pathname = window.location.pathname;
      route.tursoDatabaseUrl = window.history.state?.tursoDatabaseUrl;
      route.tursoDatabaseKey = window.history.state?.tursoDatabaseKey;
    };

    useWindowEventListener(host, 'popstate', syncNavigatorToRouter);
    useWindowEventListener(host, 'load', syncNavigatorToRouter);

    /**
     * @param {Partial<Route & { replace?: boolean }>} target
     */
    this.navigate = function navigate(target) {
      const state = /** @type {Route} */ ({ ...route, ...target });
      if (state.tursoDatabaseUrl) {
        localStorage.setItem('tursoDatabaseUrl', state.tursoDatabaseUrl);
        localStorage.setItem('tursoDatabaseKey', state.tursoDatabaseKey || '');
      }
      else {
        localStorage.removeItem('tursoDatabaseUrl');
        localStorage.removeItem('tursoDatabaseKey');
      }
      const url = (target.pathname ?? route.pathname);
      if (target?.replace === true) window.history.replaceState(state, '', url);
      else window.history.pushState(state, '', url);
      window.dispatchEvent(new PopStateEvent('popstate', { state }));
    };
  }
}

defineWebComponent('router-context', RouterContextElement);
