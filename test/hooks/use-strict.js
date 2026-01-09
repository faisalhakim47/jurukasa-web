/** @import { test } from '@playwright/test' */

/**
 * This is important hook that enforces strict test guidelines described in test/AGENTS.md file.
 * 
 * @param {typeof test} test
 */
export function useStrict(test) {
  const { beforeEach } = test;
  beforeEach(async function setupLogMapping({ context }) {
    context.addListener('page', async function onPage(page) {
      page.locator = function forbiddenLocator() {
        throw new Error('page.locator() is forbidden. Use accessibility selectors instead.');
      };
      page.waitForURL = function forbiddenWaitForURL() {
        throw new Error('page.waitForURL() is forbidden. Use accessibility selectors instead.');
      };

      page.waitForTimeout = function forbiddenWaitForTimeout() {
        throw new Error('page.waitForTimeout() indicates a flaky implementation and or test. Refactor the implementation or test then use UI visibility assertion. Playwright automatically waits for UI states.');
      };

      const getByRole = page.getByRole;
      page.getByRole = function strictGetByRole(role, options) {
        if (options && options.name && typeof options.name !== 'string') {
          throw new Error(`getByRole() name option must be a exact explicit string for better test correctness.`);
        }
        return getByRole.call(page, role, options);
      };

      const getByText = page.getByText;
      page.getByText = function strictGetByText(text, options) {
        if (typeof text !== 'string') {
          throw new Error(`getByText() text argument must be a exact explicit string for better test correctness.`);
        }
        return getByText.call(page, text, options);
      };

      const getByLabel = page.getByLabel;
      page.getByLabel = function strictGetByLabel(text, options) {
        if (typeof text !== 'string') {
          throw new Error(`getByLabel() text argument must be a exact explicit string for better test correctness.`);
        }
        return getByLabel.call(page, text, options);
      };
    });
  });
}
