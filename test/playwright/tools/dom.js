/** @import { Page } from '@playwright/test' */

/**
 * @param {Page} page
 * @param {string} selector
 * @param {string} eventName
 * @param {number} [timeout]
 */
export async function waitForDOMCustomEventDetail(page, selector, eventName, timeout = 5000) {
  return await page.evaluate(async function waitForCustomEvent({ selector, eventName, timeout }) {
    return await new Promise(function eventPromise(resolve, reject) {
      const element = document.querySelector(selector);
      if (element instanceof Element) {
        /** @param {Event} event */
        function eventListener(event) {
          clearTimeout(waiterTimeout);
          element.removeEventListener(eventName, eventListener);
          if (event instanceof CustomEvent) resolve(event.detail);
          else reject(new Error('waitForCustomEvent: Event is not CustomEvent'));
        }
        element.addEventListener(eventName, eventListener);
        const waiterTimeout = setTimeout(function () {
          element.removeEventListener(eventName, eventListener);
          reject(new Error('waitForCustomEvent: Timeout'));
        }, timeout);
      }
      else reject(new Error('waitForCustomEvent: Element not found'));
    });
  }, { selector, eventName, timeout });
}
