import { reactive, readonly } from '@vue/reactivity';
import { defineWebComponent } from '#web/component.js';
import { provideContext } from '#web/hooks/use-context.js';
import { useWindowEventListener } from '#web/hooks/use-window-event-listener.js';

/** @import { DatabaseConfig } from '#web/contexts/database-context.js' */

/**
 * @typedef {object} PersistedRoute
 * @property {DatabaseConfig} [database]
 */

/**
 * @typedef {object} SessionRoute
 * @property {string} pathname
 * @property {string} [search]
 */

/**
 * @typedef {PersistedRoute & SessionRoute} Route
 */

/**
 * @typedef {Partial<Route & { replace?: boolean }>} RouteTarget
 */

export class RouterContextElement extends HTMLElement {
  constructor() {
    super();

    provideContext(this);

    const host = this;
    const persistedRoute = getPersistedRouteState();
    const initialRoute = (function evaluateInitialRoute() {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.has('initialRoute')) {
          const initialRouteTarget = JSON.parse(atob(searchParams.get('initialRoute')));
          searchParams.delete('initialRoute');
          return /** @type {RouteTarget} */ ({
            ...initialRouteTarget,
            search: searchParams.size === 0 ? '' : `?${searchParams.toString()}`,
            replace: true,
          });
        }
      }
      catch (error) {
        console.warn('router-context', 'evaluateInitialRoute', error);
        return {};
      }
    })();

    const route = reactive(/** @type {Route} */({
      pathname: initialRoute?.pathname || window.location.pathname,
      database: false
        || initialRoute?.database
        || persistedRoute?.database
        || window.history.state?.database,
    }));

    this.route = route;

    function syncNavigatorToRouter() {
      route.pathname = window.location.pathname;
      route.database = window.history.state?.database ?? route.database;
      console.debug('router-context', 'syncNavigatorToRouter', route?.pathname, route?.search, route?.database?.provider);
    };

    useWindowEventListener(host, 'popstate', syncNavigatorToRouter);
    useWindowEventListener(host, 'load', syncNavigatorToRouter);

    /** @param {RouteTarget} target */
    this.navigate = function navigate(target) {
      const nextSearch = target.search ?? route.search ?? window.location.search ?? '';
      const nextRoute = /** @type {Route} */ ({
        ...target,
        pathname: target.pathname ?? route.pathname ?? window.location.pathname,
        search: nextSearch.startsWith('?') ? nextSearch : nextSearch === '' ? '' : `?${nextSearch}`,
        database: { ...route.database, ...target.database },
      });

      persistRouteState(nextRoute);

      const url = `${nextRoute.pathname}${nextRoute.search}`;

      if (target?.replace === true) window.history.replaceState(nextRoute, '', url);
      else window.history.pushState(nextRoute, '', url);

      window.dispatchEvent(new PopStateEvent('popstate', { state: nextRoute }));

      console.debug('router-context', 'navigate', JSON.stringify(nextRoute), JSON.stringify(route.database));
    };
  }
}

defineWebComponent('router-context', RouterContextElement);


/** @returns {PersistedRoute} */
function getPersistedRouteState() {
  const persistedRouteStateJson = localStorage.getItem('persistedRouteState');
  const persistedRouteState = JSON.parse(persistedRouteStateJson);
  return persistedRouteState;
}

/**
 * @param {Route} route
 */
function persistRouteState(route) {
  const persistedRouteState = /** @type {PersistedRoute} */ ({
    database: route.database,
  });
  localStorage.setItem('persistedRouteState', JSON.stringify(persistedRouteState));
}
