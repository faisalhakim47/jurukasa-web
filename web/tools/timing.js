import { getMetaContent } from '#web/tools/dom.js';

const applicationEnvironment = getMetaContent('application-environment', 'production');

/**
 * @param {number} duration
 * @returns {Promise<void>}
 */
export async function sleep(duration) {
  await new Promise(function sleepPromise(resolve) {
    setTimeout(function sleepTimeout() {
      queueMicrotask(function wakeupTask() {
        resolve();
      });
    }, duration);
  });
}

export async function nextTick() {
  await sleep(0);
  await new Promise(function nextMicrotask(resolve) {
    queueMicrotask(function resolveTask() {
      resolve();
    });
  });
}

/**
 * Helper function to add delay for very fast async operations to allow.
 * UI feedback to be perceivable by users.
 * No delay is added when in testing environment.
 */
export async function feedbackDelay() {
  if (applicationEnvironment === 'testing') {
    await new Promise(function nearInstantDelay(resolve) {
      requestAnimationFrame(function delayUntilNextFrame() {
        requestIdleCallback(function delayUntilIdle() {
          resolve();
        });
      });
    });
  }
  else await sleep(1500);
}
