import { noChange } from 'lit-html';
import { directive, Directive } from 'lit-html/directive.js';
/** @import { Part, DirectiveResult } from 'lit-html/directive.js' */

/**
 * Our application implements one-way data flow. In this case the data flow is going upwards.
 * 
 * @type {<T>(reactive: T, key: keyof T) => DirectiveResult}
 */
export const readValue = directive(class ValueReaderDirective extends Directive {
  render() { return noChange; }

  /**
   * @param {Part} part
   * @param {[NonNullable<unknown>, string]} args
   */
  update(part, [reactive, key]) {
    if (this.removeListener) this.removeListener();
    if ('element' in part && part.element instanceof Element) {
      const element = part.element;
      if (element instanceof HTMLInputElement) {
        function valueUpdater() {
          if (element instanceof HTMLInputElement) {
            reactive[key] = element.type === 'number' ? element.valueAsNumber
              : element.type === 'checkbox' ? element.checked
                : element.value;
          }
        };
        element.addEventListener('input', valueUpdater);
        this.removeListener = function removeListener() {
          element.removeEventListener('input', valueUpdater);
        };
      }
      else throw new Error('ValueReaderDirective can only be used on textual <input> elements');
    }
    else throw new Error('ValueReaderDirective can only be used in element parts');
  }
});
