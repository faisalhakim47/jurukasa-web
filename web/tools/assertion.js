/**
 * @template T 
 * @param {new (...args: Array<unknown>) => T} constructor 
 * @param {unknown} value
 * @returns {asserts value is T}
 */
export function assertInstanceOf(constructor, value) {
  if (!(value instanceof constructor)) {
    throw new TypeError(`Expected value to be an instance of ${constructor.name}. Got: ${value}`);
  }
}


/**
 * @param {unknown} query
 * @returns {asserts query is TemplateStringsArray}
 */
export function assertTemplateStringsArray(query) {
  if (!Array.isArray(query)) throw new TypeError('Expected TemplateStringsArray as the first argument.');
}
