import { writeFile } from 'node:fs/promises';
import { test } from '@playwright/test';
import { TerminalReporter } from 'playwright/lib/reporters/base';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { formatAXTree } from '#test/playwright/tools/playwright.js';
/** @import { TestCase, TestResult } from '@playwright/test/reporter' */
/** @import { Protocol } from '../../node_modules/playwright-core/types/protocol.d.ts' */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectDir = join(__dirname, '../../');

const formatFailure = TerminalReporter.prototype.formatFailure;
/**
 * @param {TestCase} [test]
 * @param {number} [index]
 */
TerminalReporter.prototype.formatFailure = function overriddenformatFailure(test, index) {
  for (const result of test.results) {
    result.attachments = result.attachments?.filter(function withoutErrorContext(attachment) {
      return attachment.name !== 'error-context';
    });
  }
  return formatFailure.bind(this)(test, index);
};

const onTestEnd = TerminalReporter.prototype.onTestEnd;
/**
 * @param {TestCase} test
 * @param {TestResult} result
 */
TerminalReporter.prototype.onTestEnd = function overriddenOnTestEnd(test, result) {
  onTestEnd.bind(this)(test, result);
  for (const result of test.results) {
    for (const error of result.errors) {
      error.stack = error.stack.replace(projectDir, '');
    }
  }
};

export const jurukasaTest = test.extend({
  async page({ context, page }, use, testInfo) {
    await use(page);
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      const cdpClient = await context.newCDPSession(page);
      await cdpClient.send('Accessibility.enable');
      const fullAXTree = await cdpClient.send('Accessibility.getFullAXTree');
      const accessibilityTreePath = testInfo.outputPath('accessibility-tree.md');
      await writeFile(accessibilityTreePath, formatAXTree(fullAXTree));
      await writeFile(testInfo.outputPath('accessibility-tree.json'), JSON.stringify(fullAXTree, null, 2));
      const accessibilityRelativePath = accessibilityTreePath.replace(projectDir, '');
      await testInfo.attach('Accessibility Tree', {
        contentType: 'text/plain',
        body: `file: ${accessibilityRelativePath}`,
      });
    }
  },
});
