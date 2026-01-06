import { effect, stop } from '@vue/reactivity';
import { useConnectedCallback } from '#web/hooks/use-lifecycle.js';

export const stopEffect = Symbol('stopEffect');

/**
 * @param {HTMLElement} host
 * @param {() => unknown} callback
 */
export function useEffect(host, callback) {
  useConnectedCallback(host, function setupEffect() {
    const runner = effect(function effectRunner() {
      const flag = callback();
      if (flag === stopEffect) queueMicrotask(cleanupRunner);
    });
    function cleanupRunner() { stop(runner); };
    return cleanupRunner;
  });
}
