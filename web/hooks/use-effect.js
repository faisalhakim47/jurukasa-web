import { effect, ref, stop } from '@vue/reactivity';
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
