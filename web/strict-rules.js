import { _$LH } from 'lit-html';
/** @import { DirectiveParent } from 'lit-html' */

/**
 * This project follows strict rules regarding code style and practices.
 * Read AGENTS.md for complete guidelines. Each directory might have its own AGENTS.md. Everyone must follow all of them correctly.
 */

/**
 * Apply rules:
 * - Forbid anonymous functions and arrow functions as event listeners in lit-html EventParts.
 * - Forbid clickable table rows.
 */
litHtmlInternalLoop:
for (const key in _$LH) {
  const partConstructor = /** @type {unknown} */ (_$LH[key]);
  // Check whether partConstructor is the EventPart constructor
  if (typeof partConstructor === 'function' && 'prototype' in partConstructor && 'handleEvent' in partConstructor.prototype) {
    const constructorPrototype = /** @type {unknown} */ (partConstructor.prototype);
    eventPartPrototypeLoop:
    for (const methodName of Object.getOwnPropertyNames(constructorPrototype)) {
      // Check whether the method is the _$setValue
      if (methodName === 'constructor') continue eventPartPrototypeLoop;
      if (methodName === 'handleEvent') continue eventPartPrototypeLoop;
      const method = partConstructor.prototype[methodName];
      if (typeof method === 'function' && method.length === 1) {
        const originalSetValue = method;
        /**
         * @param {unknown} newListener
         * @param {DirectiveParent} [directiveParent]
         */
        partConstructor.prototype[methodName] = function _$setValue(newListener, directiveParent = this) {
          if (typeof newListener === 'function' && newListener.name.trim().length === 0) {
            console.trace('arrow function or anonymous functions are forbidden as event listener:', newListener);
            throw new Error('arrow function or anonymous functions are forbidden. Please use a predefined named function as web/AGENTS.md guidelines.');
          }
          else if (this.element instanceof HTMLTableRowElement && this.name === 'click') {
            console.trace('clickable table rows are forbidden:', this.element.cloneNode(false).outerHTML);
            throw new Error('clickable table rows are forbidden. The interactable elements must be inside cells. Alternatively, use cards/lists instead of tables for such use cases, especially on mobile.');
          }
          return originalSetValue.call(this, newListener, directiveParent);
        };
        break eventPartPrototypeLoop;
      }
    }
    break litHtmlInternalLoop;
  }
}

/**
 * Apply rules:
 * - Forbid two-ways data binding using .value
 */
litHtmlInternalLoop:
for (const key in _$LH) {
  const partConstructor = /** @type {unknown} */ (_$LH[key]);
  // Check whether partConstructor is the PropertyPart constructor
  if (typeof partConstructor === 'function' && partConstructor.toString().includes('this.type = 3')) {
    const constructorPrototype = /** @type {unknown} */ (partConstructor.prototype);
    propertyPartPrototypeLoop:
    for (const methodName of Object.getOwnPropertyNames(constructorPrototype)) {
      // Check whether the method is the _commitValue
      if (methodName === 'constructor') continue propertyPartPrototypeLoop;
      const method = partConstructor.prototype[methodName];
      if (method.toString().includes('this.element[this.name]')) {
        const originalCommitValue = method;
        /**
         * @param {unknown} value
         */
        partConstructor.prototype[methodName] = function _commitValue(value) {
          if (this.element instanceof HTMLInputElement && this.name === 'value') {
            throw new Error('Two-ways data binding using .value is forbidden. Use readValue directive to get the value as web/AGENTS.md guidelines.');
          }
          return originalCommitValue.call(this, value);
        };
        break propertyPartPrototypeLoop;
      }
    }
    break litHtmlInternalLoop;
  }
}
