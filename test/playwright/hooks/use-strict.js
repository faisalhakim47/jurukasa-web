/** @import { Page, Locator, test } from '@playwright/test' */

/** IMPORTANT: Use this key symbol for debugging purpose only. */
export const bypassForbiddenLocator = /** @type {'locator'} */ (/** @type {any} */ (Symbol('BypassForbiddenLocator')));

/**
 * This is important hook that enforces strict test guidelines described in test/AGENTS.md file.
 * 
 * @param {typeof test} test
 */
export function useStrict(test) {
  const { beforeEach } = test;
  beforeEach(async function setupLogMapping({ context }) {
    context.addListener('page', async function onPage(page) {
      page.waitForURL = function forbiddenWaitForURL() {
        throw new Error('page.waitForURL() is forbidden. Use accessibility selectors instead.');
      };

      page.waitForTimeout = function forbiddenWaitForTimeout() {
        throw new Error('page.waitForTimeout() indicates a flaky implementation and or test. Refactor the implementation or test then use UI visibility assertion. Playwright automatically waits for UI states.');
      };

      applyStrictLocator(page);
    });
  });
}

/**
 * @param {Page | Locator} locator
 */
function applyStrictLocator(locator) {
  if ('evaluate' in locator && typeof locator.evaluate === 'function') {
    const evaluate = locator.evaluate;
    locator.evaluate = function describedEvaluate(pageFunction, ...args) {
      if (typeof pageFunction === 'function' && !pageFunction.name) {
        throw new Error('evaluate() pageFunction argument must describe their purpose with the name of the function in concince manner. Evaluate method is used in some special use cases that require direct access to DOM API. Do not use evaluate method to simulate any UI interaction.');
      }
      return evaluate.call(locator, pageFunction, ...args);
    };
  }

  if (typeof locator.locator === 'function') {
    locator[bypassForbiddenLocator] = locator.locator;
    locator.locator = function forbiddenLocator(selector, options) {
      if (selector.startsWith('internal:')) {
        return locator[bypassForbiddenLocator](selector, options);
      }
      throw new Error('.locator() is forbidden. Use accessibility selectors instead.');
    };
  }

  if (typeof locator.getByRole === 'function') {
    const getByRole = locator.getByRole;
    locator.getByRole = function strictGetByRole(role, options) {
      if (options && options.name && typeof options.name !== 'string') {
        throw new Error(`getByRole() name option must be a exact literal string instead of regex, for better test correctness.`);
      }
      const childLocator = getByRole.call(locator, role, options);
      applyStrictLocator(childLocator);
      return childLocator;
    };
  }

  if (typeof locator.getByText === 'function') {
    const getByText = locator.getByText;
    locator.getByText = function strictGetByText(text, options) {
      if (typeof text !== 'string') {
        throw new Error(`getByText() text argument must be a exact literal string instead of regex for better test correctness.`);
      }
      const childLocator = getByText.call(locator, text, options);
      applyStrictLocator(childLocator);
      return childLocator;
    };
  }

  if (typeof locator.getByLabel === 'function') {
    const getByLabel = locator.getByLabel;
    locator.getByLabel = function strictGetByLabel(text, options) {
      if (typeof text !== 'string') {
        throw new Error(`getByLabel() text argument must be a exact explicit string for better test correctness.`);
      }
      const childLocator = getByLabel.call(locator, text, options);
      applyStrictLocator(childLocator);
      return childLocator;
    };
  }
}
