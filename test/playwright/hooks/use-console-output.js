import { EOL } from 'node:os';
import { stdout } from 'node:process';
/** @import { ConsoleMessage, Page, test } from '@playwright/test' */

/** @param {ConsoleMessage} msg */
function eachLog(msg) {
  const type = msg.type();
  const text = msg.text();
  stdout.write(`[console.${type}] `);
  stdout.write(text);
  stdout.write(EOL);
}

/**
 * @param {typeof test} test
 */
export function useConsoleOutput(test) {
  const { beforeEach } = test;

  beforeEach(async function setupLogMapping({ context, browser }) {
    context.addListener('console', eachLog);
    const browserNewPage = browser.newPage;
    browser.newPage = async function newPage() {
      /** @type {Page} */
      const page = await browserNewPage.apply(browser);
      page.addListener('console', eachLog);
      return page;
    };
    // context.addListener('requestfailed', function eachFailedRequest(request) {
    //   stdout.write(`[request:failed] `);
    //   stdout.write(`${request.method()} ${request.url()}`);
    //   stdout.write(EOL);
    // });
    // context.addListener('page', function eachNewPage(page) {
    //   page.addListener('pageerror', function eachPageError(error) {
    //     stdout.write(`[page:error] `);
    //     stdout.write(error.stack);
    //     stdout.write(EOL);
    //   });
    // });
  });
}
