import { overrideWebComponentCallbacks } from '#web/hooks/use-lifecycle.js';

/**
 * @param {string} name
 * @param {CustomElementConstructor} constructor
 * @param {ElementDefinitionOptions} [options]
 */
export function defineWebComponent(name, constructor, options) {
  if (window.customElements.get(name)) {
    console.warn(`Web component: "${name}" already been defined.`)
    return;
  }
  const hookedWebComponent = overrideWebComponentCallbacks(constructor);
  window.customElements.define(name, hookedWebComponent, options);
}
