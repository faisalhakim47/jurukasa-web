/**
 * @see https://github.com/microsoft/TypeScript/issues/36554#issuecomment-2181940265
 *
 * There are 2 cases where Array.prototype.includes is used in real-world code bases:
 * 1. You're using the string to check something about the array. e.g. if(colorArray.includes("red"))
 * 2. You're using the array to check something about the string. e.g. if(["red", "blue", "green"].includes(maybeColor))
 *
 * The Array.prototype.includes method handle first case correctly, but not the second case.
 * This helper function handle the second case by asserting the type of value is T when it is found in the array.
 *
 * @template T
 * @param {Array<T>|ReadonlyArray<T>} array 
 * @param {unknown} value 
 * @returns {value is T}
 */
export function includes(array, value) {
  return array.includes(
    /** @type {any} mandatory to works */
    (value)
  );
}
