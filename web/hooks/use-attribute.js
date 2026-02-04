import { useAttributeChangedCallback } from '#web/hooks/use-lifecycle.js';
import { readonly, ref } from '@vue/reactivity';
/** @import { Ref } from '@vue/reactivity' */

/**
 * @param {HTMLElement} host
 * @param {string} observedAttributeName The web component is required to add the attribute to its observedAttributes
 * @param {string} [defaultValue]
 * @returns {Readonly<Ref<string>>}
 */
export function useAttribute(host, observedAttributeName, defaultValue = null) {
  const attribute = ref(
    host.hasAttribute(observedAttributeName)
      ? host.getAttribute(observedAttributeName).trim()
      : defaultValue,
  );
  useAttributeChangedCallback(host, function watchAttributeChanges(name, oldValue, newValue) {
    if (name === observedAttributeName) attribute.value = typeof newValue === 'string'
      ? newValue.trim()
      : defaultValue;
  });
  return readonly(attribute);
}
