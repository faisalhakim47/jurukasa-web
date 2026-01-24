/** @import { Page } from '@playwright/test' */

import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filname = fileURLToPath(import.meta.url);
const __dirname = dirname(__filname);

/** @param {Page} page */
export async function loadEmptyFixture(page) {
  await page.goto('/test/playwright/fixtures/empty.html', { waitUntil: 'load' });
  await page.pause();
  const componentTags = [
    ...await listComponentTags(join(__dirname, '../../../web/components')),
    ...await listComponentTags(join(__dirname, '../../../web/contexts')),
    ...await listComponentTags(join(__dirname, '../../../web/views')),
  ];
  await page.evaluate(async function initializeTestContext(componentTags) {
    await new Promise(function waitComponetsOrTimeout(resolve, reject) {
      let settled = false;
      /** @type {Set<string>} */
      const definedComponents = new Set();
      Promise
        .all(componentTags.map(async function waitForComponent(componentTag) {
          await customElements.whenDefined(componentTag);
          if (settled) return;
          definedComponents.add(componentTag);
        }))
        .then(function componentsResolved() {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve();
        })
        .catch(function componentsError(error) {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          reject(new Error('Error while waiting for components definitions.', { cause: error }));
        });
      const timeout = setTimeout(function componentsTimeout() {
        if (settled) return;
        settled = true;
        const undefinedComponentTags = componentTags.filter(function undefinedComponent(componentTag) {
          return !definedComponents.has(componentTag);
        });
        reject(new Error(`Timeout while waiting for components definitions: ${undefinedComponentTags.join(', ')}`));
      }, /** this should be lower than test timeout */ (4000));
    });
  }, componentTags);
}

/** @param {string} dir */
async function listComponentTags(dir) {
  const tags = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.spec.js')) {
      const tag = entry.name.split('.')[0];
      tags.push(tag);
    }
  }
  return tags.filter(function uniqueTags(value, index, self) {
    return self.indexOf(value) === index;
  });
}
