import { expect, test } from '@playwright/test';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';

const { describe } = test;

async function setupUseLifecycleScenario() {
  const { defineWebComponent } = await import('#web/component.js');
  const { useConnectedCallback, useAttributeChangedCallback } = await import('#web/hooks/use-lifecycle.js');
  const { nextTick } = await import('#web/tools/timing.js');

  class TestElement extends HTMLElement {
    static get observedAttributes() {
      return ['test-attr'];
    }

    constructor() {
      super();
      const host = this;

      useConnectedCallback(host, function () {
        host.dispatchEvent(new CustomEvent('lifecycle-connected'));
        return function () {
          host.dispatchEvent(new CustomEvent('lifecycle-disconnected'));
        };
      });

      useAttributeChangedCallback(host, function (name, oldValue, newValue) {
        host.dispatchEvent(new CustomEvent('lifecycle-attribute-changed', {
          detail: { name, oldValue, newValue }
        }));
      });
    }

    connectedCallback() {
      this.dispatchEvent(new CustomEvent('original-connected'));
    }

    disconnectedCallback() {
      this.dispatchEvent(new CustomEvent('original-disconnected'));
    }

    /**
     * @param {string} name
     * @param {string} oldValue
     * @param {string} newValue
     */
    attributeChangedCallback(name, oldValue, newValue) {
      this.dispatchEvent(new CustomEvent('original-attribute-changed', {
        detail: { name, oldValue, newValue }
      }));
    }
  }

  defineWebComponent('test-lifecycle-element', TestElement);

  const testElement = document.createElement('test-lifecycle-element');
  const events = [];

  testElement.addEventListener('lifecycle-connected', () => events.push('lifecycle-connected'));
  testElement.addEventListener('lifecycle-disconnected', () => events.push('lifecycle-disconnected'));
  testElement.addEventListener('original-connected', () => events.push('original-connected'));
  testElement.addEventListener('original-disconnected', () => events.push('original-disconnected'));

  testElement.addEventListener('lifecycle-attribute-changed', function (event) {
    const detail = /** @type {Record<string, string>} */ (event.detail);
    events.push(`lifecycle-attribute-changed:${detail.name}:${detail.oldValue}:${detail.newValue}`);
  });
  testElement.addEventListener('original-attribute-changed', function (event) {
    const detail = /** @type {Record<string, string>} */ (event.detail);
    events.push(`original-attribute-changed:${detail.name}:${detail.oldValue}:${detail.newValue}`);
  });

  document.body.appendChild(testElement);
  await nextTick();
  testElement.setAttribute('test-attr', 'value1');
  await nextTick();
  document.body.removeChild(testElement);

  return events;
}

async function setupMultipleHooksScenario() {
  const { defineWebComponent } = await import('#web/component.js');
  const { useConnectedCallback } = await import('#web/hooks/use-lifecycle.js');

  class TestMultipleHooksElement extends HTMLElement {
    constructor() {
      super();
      const host = this;

      useConnectedCallback(host, function () {
        host.dispatchEvent(new CustomEvent('hook1-connected'));
        return function () {
          host.dispatchEvent(new CustomEvent('hook1-disconnected'));
        };
      });

      useConnectedCallback(host, function () {
        host.dispatchEvent(new CustomEvent('hook2-connected'));
        return function () {
          host.dispatchEvent(new CustomEvent('hook2-disconnected'));
        };
      });

      useConnectedCallback(host, function () {
        host.dispatchEvent(new CustomEvent('hook3-connected'));
        // No return value
      });
    }
  }

  defineWebComponent('test-multiple-hooks-element', TestMultipleHooksElement);

  const testElement = document.createElement('test-multiple-hooks-element');
  const events = [];

  testElement.addEventListener('hook1-connected', () => events.push('hook1-connected'));
  testElement.addEventListener('hook2-connected', () => events.push('hook2-connected'));
  testElement.addEventListener('hook3-connected', () => events.push('hook3-connected'));
  testElement.addEventListener('hook1-disconnected', () => events.push('hook1-disconnected'));
  testElement.addEventListener('hook2-disconnected', () => events.push('hook2-disconnected'));

  document.body.appendChild(testElement);
  await new Promise(resolve => setTimeout(resolve, 50));
  document.body.removeChild(testElement);
  await new Promise(resolve => setTimeout(resolve, 50));

  return events;
}

async function setupMultipleAttributeHooksScenario() {
  const { defineWebComponent } = await import('#web/component.js');
  const { useAttributeChangedCallback } = await import('#web/hooks/use-lifecycle.js');

  class TestMultipleAttributeHooksElement extends HTMLElement {
    static get observedAttributes() {
      return ['test-attr'];
    }
    constructor() {
      super();
      const host = this;

      useAttributeChangedCallback(host, function (name, oldValue, newValue) {
        host.dispatchEvent(new CustomEvent('attr-hook1', { detail: { name, oldValue, newValue } }));
      });

      useAttributeChangedCallback(host, function (name, oldValue, newValue) {
        host.dispatchEvent(new CustomEvent('attr-hook2', { detail: { name, oldValue, newValue } }));
      });
    }
  }

  defineWebComponent('test-multiple-attr-hooks-element', TestMultipleAttributeHooksElement);

  const testElement = document.createElement('test-multiple-attr-hooks-element');
  const events = [];

  testElement.addEventListener('attr-hook1', (event) => events.push(`hook1:${event.detail.newValue}`));
  testElement.addEventListener('attr-hook2', (event) => events.push(`hook2:${event.detail.newValue}`));

  document.body.appendChild(testElement);
  await new Promise(resolve => setTimeout(resolve, 50));

  testElement.setAttribute('test-attr', 'val');
  await new Promise(resolve => setTimeout(resolve, 50));

  return events;
}

async function setupErrorHandlingScenario() {
  const { defineWebComponent } = await import('#web/component.js');
  const { useConnectedCallback } = await import('#web/hooks/use-lifecycle.js');

  class TestErrorElement extends HTMLElement {
    constructor() {
      super();
      const host = this;

      useConnectedCallback(host, function () {
        throw new Error('Intentional error');
      });

      useConnectedCallback(host, function () {
        host.dispatchEvent(new CustomEvent('hook-success'));
      });
    }
  }

  defineWebComponent('test-error-element', TestErrorElement);

  const testElement = document.createElement('test-error-element');
  const events = [];

  testElement.addEventListener('hook-success', () => events.push('hook-success'));

  document.body.appendChild(testElement);
  await new Promise(resolve => setTimeout(resolve, 50));

  return events;
}

async function setupDoubleOverrideScenario() {
  const { overrideWebComponentCallbacks } = await import('#web/hooks/use-lifecycle.js');
  class TestDoubleOverrideElement extends HTMLElement { }
  overrideWebComponentCallbacks(TestDoubleOverrideElement);
  try {
    overrideWebComponentCallbacks(TestDoubleOverrideElement);
    return 'no-error';
  } catch (e) {
    return e.message;
  }
}

describe('useLifecycle', function () {
  // useConsoleOutput(test);

  test('it shall execute callbacks correctly', async function ({ page }) {
    await loadEmptyFixture(page);
    const events = await page.evaluate(setupUseLifecycleScenario);
    expect(events).toEqual([
      'original-connected',
      'lifecycle-connected',
      'original-attribute-changed:test-attr:null:value1',
      'lifecycle-attribute-changed:test-attr:null:value1',
      'original-disconnected',
      'lifecycle-disconnected'
    ]);
  });

  test('it shall support multiple hooks', async function ({ page }) {
    await loadEmptyFixture(page);
    const events = await page.evaluate(setupMultipleHooksScenario);
    // Order of hooks execution depends on Set iteration order, which is insertion order.
    expect(events).toEqual([
      'hook1-connected',
      'hook2-connected',
      'hook3-connected',
      'hook1-disconnected',
      'hook2-disconnected'
    ]);
  });

  test('it shall support multiple attribute changed hooks', async function ({ page }) {
    await loadEmptyFixture(page);
    const events = await page.evaluate(setupMultipleAttributeHooksScenario);
    expect(events).toEqual([
      'hook1:val',
      'hook2:val'
    ]);
  });

  test('it shall continue execution even if a callback throws error', async function ({ page }) {
    await loadEmptyFixture(page);
    const events = await page.evaluate(setupErrorHandlingScenario);
    expect(events).toEqual(['hook-success']);
  });

  test('it shall throw error when overriding callbacks twice', async function ({ page }) {
    await loadEmptyFixture(page);
    const result = await page.evaluate(setupDoubleOverrideScenario);
    expect(result).toContain('The web component is already overridden');
  });
});
