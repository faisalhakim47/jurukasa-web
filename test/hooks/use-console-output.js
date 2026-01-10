import { EOL } from 'node:os';
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
      stdout.write(EOL);
    });
    context.addListener('requestfailed', function logFailedRequest(request) {
      stdout.write(`[request:failed] `);
      stdout.write(`${request.method()} ${request.url()}`);
      stdout.write(EOL);
    });
    context.addListener('page', function handleNewPage(page) {
      page.addListener('pageerror', function mapPageError(error) {
        stdout.write(`[page:error] `);
        stdout.write(error.stack);
        stdout.write(EOL);
      });
    });
  });
}
