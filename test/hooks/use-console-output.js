import { stdout } from 'node:process';
/** @import { test } from '@playwright/test' */

/**
 * @param {typeof test} test
 */
export function useConsoleOutput(test) {
  const { beforeEach } = test;
  beforeEach(async function setupLogMapping({ context }) {
    context.addListener('console', function mapLog(msg) {
      const type = msg.type();
      const text = msg.text();
      stdout.write(`[console:${type}] `);
      stdout.write(text);
      stdout.write('\n');
    });
  });
}
