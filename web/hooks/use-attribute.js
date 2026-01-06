import { useAttributeChangedCallback } from '#web/hooks/use-lifecycle.js';
import { readonly, ref } from '@vue/reactivity';
/** @import { Ref } from '@vue/reactivity' */

/**
 * @param {HTMLElement} host
 * @param {string} observedAttributeName The web component is required to add the attribute to its observedAttributes
 * @returns {Readonly<Ref<string>>}
 */
export function useAttribute(host, observedAttributeName) {
  const attribute = ref(null);
  useAttributeChangedCallback(host, function (name, oldValue, newValue) {
    if (name === observedAttributeName) attribute.value = newValue.trim() || null;
  });
  return readonly(attribute);
}
