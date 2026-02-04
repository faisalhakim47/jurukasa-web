import { effect, ref, stop } from '@vue/reactivity';
import { useConnectedCallback } from '#web/hooks/use-lifecycle.js';

export const StopEffectFlag = Symbol('StopEffectFlag');

/**
 * @param {HTMLElement} host
 * @param {function():unknown} callback
 */
export function useEffect(host, callback) {
  let cleanup = /** @type {Function} */ (undefined);
  useConnectedCallback(host, function setupEffect() {
    const runner = effect(function effectRunner() {
      try {
        if (typeof cleanup === 'function') cleanup();
        cleanup = undefined;
        const result = callback();
        if (result === StopEffectFlag) queueMicrotask(stopEffect);
        else if (typeof result === 'function') {
          if (typeof cleanup === 'function') cleanup();
          cleanup = result;
        }
      }
      catch (error) {
        console.error('useEffect', 'effectRunner', host.tagName, error);
        throw error;
      }
    });
    function stopEffect() { stop(runner); };
    return stopEffect;
  });
}

/**
 * @param {HTMLElement} host
 * @param {function(HTMLElement, function():unknown):void} useHook
 * @param {function():unknown} callback
 */
export function useEffectAfterHook(host, useHook, callback) {
  let active = ref(false);
  useHook(host, function evaluateAfter() {
    active.value = true;
  });
  useEffect(host, function effectAfterHook() {
    if (active.value === true) return callback();
  });
}
