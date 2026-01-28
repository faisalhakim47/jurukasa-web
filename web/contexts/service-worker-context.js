import { reactive } from '@vue/reactivity';
import { defineWebComponent } from '#web/component.js';
import { useBusyStateResolver } from '#web/contexts/ready-context.js';
import { provideContext } from '#web/hooks/use-context.js';
import { useConnectedCallback } from '#web/hooks/use-lifecycle.js';
import { useWatch } from '#web/hooks/use-watch.js';
import { getMetaContent } from '#web/tools/dom.js';
import { waitForValue } from '#web/tools/reactivity.js';

const appPrefix = getMetaContent('app-prefix', '/');
const appIndex = getMetaContent('app-index', 'index.html');
const materialSymbolsProviderUrl = getMetaContent('material-symbols-provider-url', 'https://cdn.jsdelivr.net/npm/@material-symbols/svg-{WEIGHT}@0.40.2/{STYLE}/{NAME}{FILL}.svg');

export class ServiceWorkerContextElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    provideContext(host);

    const state = reactive({
      registration: /** @type {ServiceWorkerRegistration} */ (undefined),
      registrationError: /** @type {unknown} */ (undefined),
      serviceWorker: /** @type {ServiceWorker} */ (undefined),
      messageId: 0,
    });

    const resolveReady = useBusyStateResolver(host);

    useConnectedCallback(host, function registerServiceWorker() {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(function registered(registration) {
          state.registration = registration;
        })
        .catch(function registrationFailed(error) {
          state.registrationError = error;
        });
    });

    useWatch(host, state, 'registration', async function handleRegistrationError(registration) {
      // console.debug('handleRegistration', 'check', registration);
      if (registration) {
        /**
         * Our service worker registration strategy is all or nothing.
         * Either a page is controlled by service worker or not at all. No in-between.
         * The service worker does not claims any pages on activation.
         * 
         * So, what we do here are:
         * - if registration is active, we are good to go. Nothing to do.
         * - if registration is not active, we request pre-caching current version for next visit.
         */
        if (registration.active) {
          // console.debug('handleRegistration', 'controlled', 'yes');
          state.serviceWorker = registration.active;
        }
        else {
          // console.debug('handleRegistration', 'controlled', 'no');
          state.serviceWorker = false
            || registration.installing
            || registration.waiting;
          const links = document.querySelectorAll('link');
          const relFiles = Array.from(links)
            .map(function linkToObject(link) {
              return { rel: link.rel, href: link.href };
            })
            .filter(function linkFilter(link) {
              const acceptableRels = ['manifest', 'icon', 'stylesheet', 'prefetch'];
              return acceptableRels.includes(link.rel);
            })
            .map(function linkToUrl(link) {
              return link.href;
            });
          const importmapJson = JSON.parse(document.querySelector('script[type="importmap"]').textContent);
          const importmapFiles = Object.values(importmapJson?.imports ?? {})
            .filter(function notDirectory(entry) {
              return typeof entry === 'string' && !entry.endsWith('/');
            });
          // console.debug('handleRegistration', 'importmapFiles', importmapFiles);
          const additionalFiles = [
            appIndex,
            ...relFiles,
            ...importmapFiles,
          ];
          await sendMessage({ command: 'init-cache', appPrefix, additionalFiles, materialSymbolsProviderUrl }, 30 * 1000);
          await sendMessage({ command: 'set-cache', appPrefix, appIndex }, 3 * 1000);
        }
        resolveReady();
      }
      else state.serviceWorker = undefined;
    });

    /**
     * @param {object} payload
     * @param {number} [duration]
     * @returns {Promise<unknown>}
     */
    async function sendMessage(payload, duration = 3000) {
      await waitForValue(function waitForServiceWorker() {
        return state.serviceWorker instanceof ServiceWorker;
      }, 3000);
      return new Promise(function responsePromise(resolve, reject) {
        const deadline = Date.now() + duration;
        const messageId = state.messageId++;
        /** @param {MessageEvent} event */
        function clientInBound(event) {
          // console.debug('sendMessage', 'clientInBound', event.data);
          if (event.data.messageId === messageId) {
            clearTimeout(timeout);
            navigator.serviceWorker.removeEventListener('message', clientInBound);
            resolve(event.data);
          }
        }
        navigator.serviceWorker.addEventListener('message', clientInBound);
        const timeout = setTimeout(function inBoundTimeout() {
          navigator.serviceWorker.removeEventListener('message', clientInBound);
          reject(new Error(`ServiceWorker message timeout: ${duration}ms`));
        }, duration);
        // console.debug('service-worker-context', 'postMessage', messageId, payload?.command);
        state.serviceWorker.postMessage({
          ...payload,
          messageId,
          deadline,
        });
        // console.debug('sendMessage', payload);
      });
    }
    this.sendMessage = sendMessage;

    async function hotfixSqlite3OpfsAsyncProxy() {
      await sendMessage({ command: 'hotfix-sqlite3-opfs-async-proxy' }, 5 * 1000);
    }
    this.hotfixSqlite3OpfsAsyncProxy = hotfixSqlite3OpfsAsyncProxy;
  }
}

defineWebComponent('service-worker-context', ServiceWorkerContextElement);
