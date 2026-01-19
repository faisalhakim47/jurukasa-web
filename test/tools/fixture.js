/** @import { Page } from '@playwright/test' */

import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filname = fileURLToPath(import.meta.url);
const __dirname = dirname(__filname);

/** @param {Page} page */
export async function loadEmptyFixture(page) {
  await page.goto('/test/fixtures/empty.html', { waitUntil: 'load' });
  const componentTags = [
    ...await listComponentTags(join(__dirname, '../../web/components')),
    ...await listComponentTags(join(__dirname, '../../web/contexts')),
    ...await listComponentTags(join(__dirname, '../../web/views')),
  ];
  await page.evaluate(async function waitUntilCoreElementsReady(coreElementTags) {
    try {
      await Promise.all(coreElementTags.map(async function tagToWaiter(tag) {
        await customElements.whenDefined(tag);
      }));
    }
    catch (error) {
      console.error('Error while waiting for core elements to be defined:', error);
    }
  }, componentTags);
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
  }, componentTags);
}

/** @param {string} dir */
async function listComponentTags(dir) {
  const tags = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) return;
    else if (entry.isFile() && entry.name.endsWith('.js')) {
      const tag = entry.name.split('.')[0];
      tags.push(tag);
    }
  }
  return tags.filter(function uniqueTags(value, index, self) {
    return self.indexOf(value) === index;
  });
}
