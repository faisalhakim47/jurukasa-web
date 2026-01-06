import { expect, test } from '@playwright/test';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';

const { describe } = test;

async function setupUseMountLifecycleScenario() {
  const { html } = await import('lit-html');
  const { defineWebComponent } = await import('#web/component.js');
  const { useEffect } = await import('#web/hooks/use-effect.js');
  const { useMounted } = await import('#web/hooks/use-mounted.js');
  const { useRender } = await import('#web/hooks/use-render.js');
  class TestElement extends HTMLElement {
    constructor() {
      super();
      const host = this;
      const render = useRender(host);
      useMounted(host, function () {
        host.dispatchEvent(new CustomEvent('mounted'));
      });
      useEffect(host, function () {
        render(html`<p>something</p>`);
        host.dispatchEvent(new CustomEvent('rendered'));
      });
    }
  }
  defineWebComponent('test-element', TestElement);
  const testElement = document.createElement('test-element');
  const eventTriggersSequence = /** @type {Array<string>} */ ([]);
  testElement.addEventListener('mounted', function () {
    eventTriggersSequence.push('mounted');
  });
  testElement.addEventListener('rendered', function () {
    eventTriggersSequence.push('rendered');
  });
  document.body.appendChild(testElement);
  async function wait() {
    return new Promise(function (resolve) {
      queueMicrotask(function () {
        setTimeout(resolve, 500);
      });
    });
  }
  while (true) {
    if (eventTriggersSequence.length === 2) break;
    await wait();
  }
  return eventTriggersSequence;
}

describe('useMounted', function () {
  // useConsoleOutput(test);

  test('it shall execute callback after first render', async function ({ page }) {
    await page.goto('/test/fixtures/empty.html', { waitUntil: 'load' });

    const eventTriggersSequence = await page.evaluate(setupUseMountLifecycleScenario);

    expect(eventTriggersSequence).toEqual(['rendered', 'mounted']);
  });
});
