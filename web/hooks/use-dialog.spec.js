import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';

const test = jurukasaTest;
const { describe } = test;

/**
 * @typedef {HTMLElement & {
 *   readState(): {
 *     open: boolean,
 *     contextLabel: string | null,
 *     nativeOpen: boolean,
 *   },
 *   shadowRoot: ShadowRoot | null,
 * }} TestUseDialogHost
 */

async function setupUseDialogScenario() {
  const { html } = await import('lit-html');
  const { defineWebComponent } = await import('#web/component.js');
  const { useDialog } = await import('#web/hooks/use-dialog.js');
  const { useEffect } = await import('#web/hooks/use-effect.js');
  const { useRender } = await import('#web/hooks/use-render.js');
  const { nextTick } = await import('#web/tools/timing.js');

  class TestUseDialogElement extends HTMLElement {
    constructor() {
      super();
      const host = this;
      const dialog = useDialog(host);
      const render = useRender(host);

      this.readState = function readState() {
        return {
          open: dialog.open,
          contextLabel: dialog.context?.textContent?.trim() ?? null,
          nativeOpen: dialog.element.value?.open ?? false,
        };
      };

      useEffect(host, function renderDialog() {
        render(html`
          <dialog ${dialog.element} aria-label="Hook Test Dialog">
            <form method="dialog">
              <p>Dialog body</p>
              <button value="confirm">Confirm</button>
            </form>
          </dialog>
        `);
      });
    }
  }

  defineWebComponent('test-use-dialog-element', TestUseDialogElement);

  document.body.innerHTML = `
    <button id="dialog-open" type="button" commandfor="test-use-dialog-host" command="--open">Open Hook Dialog</button>
    <button id="dialog-close" type="button" commandfor="test-use-dialog-host" command="--close">Close Hook Dialog</button>
    <test-use-dialog-element id="test-use-dialog-host"></test-use-dialog-element>
  `;

  await nextTick();
}

async function readUseDialogState() {
  const dialogHost = /** @type {TestUseDialogHost | null} */ (document.getElementById('test-use-dialog-host'));
  if (!(dialogHost instanceof HTMLElement)) throw new Error('Dialog host not found');
  return dialogHost.readState();
}

async function closeNativeDialog() {
  const dialogHost = /** @type {TestUseDialogHost | null} */ (document.getElementById('test-use-dialog-host'));
  if (!(dialogHost instanceof HTMLElement)) throw new Error('Dialog host not found');
  if (!(dialogHost.shadowRoot instanceof ShadowRoot)) throw new Error('Dialog host shadow root not found');
  const dialogElement = dialogHost.shadowRoot.querySelector('dialog');
  if (!(dialogElement instanceof HTMLDialogElement)) throw new Error('Native dialog not found');
  dialogElement.close();
}

async function setupDuplicateUseDialogScenario() {
  const { useDialog } = await import('#web/hooks/use-dialog.js');
  try {
    const host = document.createElement('div');
    useDialog(host);
    useDialog(host);
  }
  catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return 'no-error';
}

async function triggerCloseCommand() {
  const closeInvoker = document.getElementById('dialog-close');
  closeInvoker.click();
}

describe('useDialog', function () {
  useConsoleOutput(test);

  test('it shall open and close dialog state through invoker commands', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupUseDialogScenario);

    await page.getByRole('button', { name: 'Open Hook Dialog' }).click();

    await expect(page.getByRole('dialog', { name: 'Hook Test Dialog' }), 'it shall open the wrapped native dialog').toBeVisible();

    const openedState = await page.evaluate(readUseDialogState);
    expect(openedState, 'it shall track open state and invoker context when opened').toEqual({
      open: true,
      contextLabel: 'Open Hook Dialog',
      nativeOpen: true,
    });

    await page.evaluate(triggerCloseCommand);

    await expect(page.getByRole('dialog', { name: 'Hook Test Dialog' }), 'it shall close the wrapped native dialog').not.toBeVisible();

    const closedState = await page.evaluate(readUseDialogState);
    expect(closedState, 'it shall clear open state after close command').toEqual({
      open: false,
      contextLabel: 'Close Hook Dialog',
      nativeOpen: false,
    });
  });

  test('it shall sync hook state when the native dialog closes itself', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupUseDialogScenario);

    await page.getByRole('button', { name: 'Open Hook Dialog' }).click();
    await expect(page.getByRole('dialog', { name: 'Hook Test Dialog' }), 'it shall open dialog before native close').toBeVisible();

    await page.evaluate(closeNativeDialog);

    await expect(page.getByRole('dialog', { name: 'Hook Test Dialog' }), 'it shall close when the native dialog emits close').not.toBeVisible();

    await expect.poll(async function pollDialogState() {
      return page.evaluate(readUseDialogState);
    }, 'it shall sync hook state after native close').toEqual({
      open: false,
      contextLabel: 'Open Hook Dialog',
      nativeOpen: false,
    });
  });

  test('it shall reject multiple useDialog instances on one host', async function ({ page }) {
    await loadEmptyFixture(page);

    const errorMessage = await page.evaluate(setupDuplicateUseDialogScenario);

    expect(errorMessage, 'it shall throw when useDialog is called twice for the same host').toContain('only one useDialog instance is allowed per host element');
  });
});
