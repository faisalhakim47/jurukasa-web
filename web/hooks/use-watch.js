import { watch } from '@vue/reactivity';
/** @import { Ref } from '@vue/reactivity' */

import { useConnectedCallback } from '#web/hooks/use-lifecycle.js';

/**
 * @template T
 * @param {HTMLElement} host
 * @param {Ref<T>} ref
 * @param {(newValue: T, oldValue: T) => void} callback
 */
export function useWatch(host, ref, callback) {
  useConnectedCallback(host, function watchRef() {
    return watch(ref, callback);
  });
}
