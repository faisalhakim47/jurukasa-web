import { computed, isReactive, isRef, watch } from '@vue/reactivity';
/** @import { Ref } from '@vue/reactivity' */

import { useConnectedCallback } from '#web/hooks/use-lifecycle.js';

/**
 * @template T
 * @typedef {function(HTMLElement, Ref<T>, (newValue: T, oldValue: T) => void): void} UseWatchRefCallback
 */

/**
 * @template T
 * @template {keyof T} K
 * @typedef {function(HTMLElement, T, keyof T, (newValue: T[K], oldValue: T[K]) => void): void} UseWatchReactiveCallback
 */

/**
 * @template T
 * @template R
 * @template {keyof R} K
 * @param {HTMLElement} host
 * @param {Ref<T> | R} refOrReactive
 * @param {((newValue: T, oldValue: T) => void) | K} callbackOrReactiveKey
 * @param {(newValue: R[K], oldValue: R[K]) => void} [maybeCallback]
 * @returns {void}
 */
export function useWatch(host, refOrReactive, callbackOrReactiveKey, maybeCallback) {
  const ref = (function evaluateRef() {
    if (isRef(refOrReactive)) return refOrReactive;
    if (isReactive(refOrReactive) && typeof callbackOrReactiveKey === 'string') return computed(function readReactiveKey() {
      return refOrReactive[callbackOrReactiveKey];
    });
    else throw new TypeError('Expected a Ref or reactive object with key');
  })();

  const callback = (function evaluateCallback() {
    if (typeof callbackOrReactiveKey === 'function') return callbackOrReactiveKey;
    else if (typeof maybeCallback === 'function') return maybeCallback;
    else throw new TypeError('Expected a callback function');
  })();

  useConnectedCallback(host, function watchRef() {
    return watch(ref, callback);
  });
}
