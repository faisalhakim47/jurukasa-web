import { useConnectedCallback } from '#web/hooks/use-lifecycle.js';
import { hasRendered } from '#web/hooks/use-render.js';

/**
 * @param {HTMLElement} host
 * @param {function():void} callback
 */
export function useMounted(host, callback) {
  useConnectedCallback(host, function connectedBeforeMounted() {
    if (hasRendered(host)) queueMicrotask(function task() {
      try { callback(); }
      catch (error) { console.error('useMounted', 'task', 'error', error); }
    });
    else host.addEventListener('use-render:rendered', function readyBeforeMounted() {
      queueMicrotask(callback);
    }, { once: true });
  });
}
