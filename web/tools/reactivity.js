import { effect } from '@vue/reactivity';

/**
 * @param {function():boolean} condition
 * @param {number} [duration] the timeout duration
 * @returns {Promise<void>}
 */
export async function waitForValue(condition, duration = 5000) {
  return await new Promise(function waitForValuePromise(resolve, reject) {
    let settled = false;
    const timeout = setTimeout(function timeout() {
      if (settled) return;
      settled = true;
      reject(new Error('Timeout waiting for value'));
    }, duration);
    effect(function waitForValueEffect() {
      const result = condition();
      if (result === true) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve();
      }
    });
  });
}
