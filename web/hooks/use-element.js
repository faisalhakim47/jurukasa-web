import { ref as createVueRef } from '@vue/reactivity';
import { ref as createLitRef } from 'lit-html/directives/ref.js';
/** @import { DirectiveResult } from 'lit-html/directive.js' */
/** @import { RefDirective } from 'lit-html/directives/ref.js' */

/**
 * @template {typeof HTMLElement} T
 * @param {HTMLElement} host for convention, currently not used
 * @param {T} expectedHTMLElementConstructor
 * @return {DirectiveResult<typeof RefDirective> & { value: InstanceType<T> | null }}
 */
export function useElement(host, expectedHTMLElementConstructor) {
  const elementToBe = createVueRef(null);
  const renderResult = createLitRef(function litElementCapturer(capturedElement) {
    if (capturedElement === undefined || capturedElement === null) return;
    if (capturedElement instanceof expectedHTMLElementConstructor) elementToBe.value = capturedElement;
    else throw new Error(`Expected element of type ${expectedHTMLElementConstructor.name}, but got ${capturedElement?.constructor.name}`);
  });
  Object.defineProperty(renderResult, 'value', {
    get() { return elementToBe.value; },
    enumerable: true,
    configurable: true,
  });
  return /** @type {object} */ (renderResult);
}
