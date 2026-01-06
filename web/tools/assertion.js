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
