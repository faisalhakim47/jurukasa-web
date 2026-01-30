import { EOL } from 'node:os';
import { env, stdout } from 'node:process';
/** @import { ConsoleMessage, Page, test } from '@playwright/test' */

const consoleOutput = env.CONSOLE_OUTPUT === '1';
const consoleOutputFilter = env.CONSOLE_OUTPUT_INCLUDES
  ? new RegExp(env.CONSOLE_OUTPUT_INCLUDES)
  : null;

/** @param {ConsoleMessage} msg */
function eachLog(msg) {
  if (consoleOutput) {
    const type = msg.type();
    const text = msg.text();
    if (!(consoleOutputFilter instanceof RegExp) || consoleOutputFilter.test(text)) {
      stdout.write(`[console.${type}] `);
      stdout.write(text);
      stdout.write(EOL);
    }
  }
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
    context.addListener('requestfailed', function eachFailedRequest(request) {
      stdout.write(`[request:failed] `);
      stdout.write(`${request.method()} ${request.url()}`);
      stdout.write(EOL);
    });
    context.addListener('page', function eachNewPage(page) {
      page.addListener('pageerror', function eachPageError(error) {
        stdout.write(`[page:error] `);
        stdout.write(error.message);
        stdout.write(error.stack);
        stdout.write(EOL);
      });
    });
  });
}
