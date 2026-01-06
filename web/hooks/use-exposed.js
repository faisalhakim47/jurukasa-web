import { useConnectedCallback } from '#web/hooks/use-lifecycle.js';
import { computed } from '@vue/reactivity';
/** @import { ComputedRef } from '@vue/reactivity' */

/**
 * Usage:
 * - the useExposed hook is to assign reactive computed property on HTMLElement instance
 * ```
 * this.someExposedProperty = useExposed(this, function readValue() {
 *   return someRef.value + 10;
 * });
 * this.someExposedProperty; // won't works, will return placeholder Symbol instead
 * useConnectedCallback(this, function handleConnected() {
 *   this.someExposedProperty; // works here
 * });
 * ```
 * - the `this.someExposedProperty` variable can only be used after connectedCallback lifecycle similar to `useContext` hook
 * 
 * @template T
 * @param {HTMLElement} host
 * @param {(() => T)|ComputedRef<T>} computeFnOrRef
 * @returns {T}
 */
export function useExposed(host, computeFnOrRef) {
  const symbol = Symbol('ComputedPlaceholder');
  useConnectedCallback(host, function initExposed() {
    for (const key in host) {
      if (host[key] === symbol) {
        const ref = typeof computeFnOrRef === 'function'
          ? computed(computeFnOrRef)
          : computeFnOrRef;
        Object.defineProperty(host, key, {
          get() { return ref.value; },
        });
      }
    }
  });
  return /** @type {object} workaround, this ref will be replaced after connectedCallback */ (symbol);
}
