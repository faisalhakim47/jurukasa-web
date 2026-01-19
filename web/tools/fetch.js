/**
 * @param {function(RequestInfo,RequestInit,Response?,Error?):void} each 
 */
export function createWatchedFetch(each) {
  /**
   * @param {RequestInfo} input
   * @param {RequestInit} [init]
   * @returns {Promise<Response>}
   */
  return async function watchedFetch(input, init) {
    const clonedInput = input instanceof Request ? input.clone() : input;
    try {
      const response = await globalThis.fetch(input, init);
      const clonedResponse = response.clone();
      each(clonedInput, init, clonedResponse, null);
      return response;
    }
    catch (error) {
      each(clonedInput, init, null, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  };
} 
