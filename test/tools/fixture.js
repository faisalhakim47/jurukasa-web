/** @import { Page } from '@playwright/test' */

/** @param {Page} page */
export async function loadEmptyFixture(page) {
  await page.goto('/test/fixtures/empty.html', { waitUntil: 'domcontentloaded' });
  const coreElementTags = [
    'database-context',
    'router-context',
    'ready-context',
  ];
  await page.evaluate(async function waitUntilCoreElementsReady(coreElementTags) {
    try {
      await Promise.all(coreElementTags.map(function tagToWaiter(tag) {
        return customElements.whenDefined(tag);
      }));
    }
    catch (error) {
      console.error('Error while waiting for core elements to be defined:', error);
    }
  }, coreElementTags);
  await page.waitForFunction(function untilBeSureTheElementsAreReady(coreElementTags) {
    try {
      return coreElementTags.every(function tagIsReady(tag) {
        return typeof customElements.get(tag) === 'function';
      });
    }
    catch (error) {
      console.error('Error while checking if core elements are ready:', error);
      return false;
    }
  }, coreElementTags);
}
