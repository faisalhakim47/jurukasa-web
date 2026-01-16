import { reactive, readonly } from '@vue/reactivity';
import { defineWebComponent } from '#web/component.js';
import { provideContext } from '#web/hooks/use-context.js';
import { useWindowEventListener } from '#web/hooks/use-window-event-listener.js';

/**
 * @typedef {'local'|'turso'} DatabaseProvider
 * 
 * @typedef {object} LocalDatabaseConfig
 * @property {'local'} provider
 * 
 * @typedef {object} TursoDatabaseConfig
 * @property {'turso'} provider
 * @property {string} url
 * @property {string} [authToken]
 * 
 * @typedef {LocalDatabaseConfig|TursoDatabaseConfig} DatabaseConfig
 * 
 * @typedef {object} Route
 * @property {string} pathname
 * @property {DatabaseProvider} [databaseProvider]
 * @property {DatabaseConfig} [databaseConfig]
 */

export class RouterContextElement extends HTMLElement {
  constructor() {
    super();

    provideContext(this);

    const host = this;

    // Load persisted database configuration
    const persistedProvider = /** @type {DatabaseProvider|null} */ (localStorage.getItem('databaseProvider'));
    const persistedConfig = loadPersistedDatabaseConfig(persistedProvider);

    const route = reactive(/** @type {Route} */({
      pathname: window.location.pathname,
      databaseProvider: persistedProvider || window.history.state?.databaseProvider,
      databaseConfig: persistedConfig || window.history.state?.databaseConfig,
    }));

    this.route = readonly(route);

    function syncNavigatorToRouter() {
      route.pathname = window.location.pathname;
      route.databaseProvider = window.history.state?.databaseProvider;
      route.databaseConfig = window.history.state?.databaseConfig;
    };

    useWindowEventListener(host, 'popstate', syncNavigatorToRouter);
    useWindowEventListener(host, 'load', syncNavigatorToRouter);

    /**
     * @param {Partial<Route & { replace?: boolean }>} target
     */
    this.navigate = function navigate(target) {
      const state = /** @type {Route} */ ({
        databaseProvider: target.databaseProvider ?? route.databaseProvider,
        databaseConfig: {
          ...route.databaseConfig,
        },
        pathname: target.pathname ?? route.pathname,
      });

      // Persist database configuration
      if (state.databaseProvider && state.databaseConfig) {
        localStorage.setItem('databaseProvider', state.databaseProvider);
        persistDatabaseConfig(state.databaseConfig);
      }
      else clearDatabaseConfig();

      const url = (target.pathname ?? route.pathname);
      if (target?.replace === true) window.history.replaceState(state, '', url);
      else window.history.pushState(state, '', url);

      window.dispatchEvent(new PopStateEvent('popstate', { state }));
    };
  }
}

/**
 * @param {DatabaseProvider|null} provider
 * @returns {DatabaseConfig|undefined}
 */
function loadPersistedDatabaseConfig(provider) {
  if (provider === 'local') {
    return { provider: 'local' };
  }
  else if (provider === 'turso') {
    const url = localStorage.getItem('tursoUrl');
    const authToken = localStorage.getItem('tursoAuthToken') || undefined;
    if (!url) return undefined;
    return { provider: 'turso', url, authToken };
  }
  else return undefined;
}

/**
 * @param {DatabaseConfig} config
 */
function persistDatabaseConfig(config) {
  if (config.provider === 'local') {
    // No additional data needed for local storage
  }
  else if (config.provider === 'turso') {
    localStorage.setItem('tursoUrl', config.url);
    localStorage.setItem('tursoAuthToken', config.authToken || '');
  }
}

function clearDatabaseConfig() {
  localStorage.removeItem('databaseProvider');
  localStorage.removeItem('tursoUrl');
  localStorage.removeItem('tursoAuthToken');
}

defineWebComponent('router-context', RouterContextElement);
