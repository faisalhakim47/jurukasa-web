import { defineWebComponent } from '#web/component.js';
import { provideContext, useContext, useOptionalContext } from '#web/hooks/use-context.js';
import { useEffect, stopEffect } from '#web/hooks/use-effect.js';
import { useConnectedCallback } from '#web/hooks/use-lifecycle.js';
import { useWindowEventListener } from '#web/hooks/use-window-event-listener.js';

export class ReadyContextElement extends HTMLElement {
  constructor() {
    super();

    provideContext(this);

    const host = this;
    let shadowRoot = host.shadowRoot;
    if (shadowRoot instanceof ShadowRoot) {
      const existingBusyDialog = shadowRoot.querySelector('dialog[aria-busy="true"]');
      if (existingBusyDialog instanceof HTMLDialogElement) { /* the busy dialog is present, nothing to do. */ }
      else console.warn('ReadyContextElement: Declarative Shadow Root is detected, but no busy dialog found. This is not intended usage.');
    }
    // else console.warn('ReadyContextElement: should be used with Declarative Shadow DOM to show busy state.');

    let pendingResolvers = [];

    /**
     * This busy resolver can only be called after or on connectedCallback.
     * @returns {() => void}
     */
    this.createBusyResolver = function createBusyResolver() {
      /** @type {PromiseWithResolvers<void>} */
      const { promise, resolve } = Promise.withResolvers();
      // Only track resolvers if shadow root is present
      if (shadowRoot instanceof ShadowRoot) pendingResolvers.push(promise);
      return resolve;
    };

    useWindowEventListener(host, 'load', async function resolveBusyResolvers() {
      if (!(shadowRoot instanceof ShadowRoot)) return;
      while (pendingResolvers.length) {
        const resolves = pendingResolvers;
        pendingResolvers = [];
        await Promise.allSettled(resolves);
      }
      const dialog = shadowRoot.querySelector('dialog[aria-busy="true"]');
      if (dialog instanceof HTMLDialogElement) {
        dialog.removeAttribute('aria-busy');
        dialog.close();
      }
      else throw new Error('ReadyContextElement: Busy dialog not found in <ready-context>.');
      queueMicrotask(function readyTask() {
        requestAnimationFrame(function waitForAnimationToReady() {
          host.dispatchEvent(new CustomEvent('ready-context:ready', {
            bubbles: true,
            composed: false,
          }));
        });
      });
    });
  }
}

defineWebComponent('ready-context', ReadyContextElement);

/**
 * This busy resolver can only be called on constructor (component setup lifecycle).
 * @param {HTMLElement} host
 * @returns {() => void}
 */
export function useBusyStateResolver(host) {
  const ready = useOptionalContext(host, ReadyContextElement);
  /** @type {PromiseWithResolvers<void>} */
  const { resolve, promise } = Promise.withResolvers();
  /** busy state is optional behaviour */
  useConnectedCallback(host, function registeringBusyResolver() {
    if (typeof ready.createBusyResolver === 'function') {
      const resolveBusy = ready.createBusyResolver();
      promise.then(resolveBusy);
    } else console.warn('useBusyStateResolver:', 'ReadyContextElement not found from', host.constructor.name);
  });
  return resolve;
}

/**
 * @param {HTMLElement} host
 * @param {() => boolean} isReady vue reactive computed function
 */
export function useBusyStateUntil(host, isReady) {
  const ready = useBusyStateResolver(host);
  useEffect(host, function readyEffect() {
    if (isReady()) {
      ready();
      return stopEffect;
    }
  });
}

/**
 * @param {HTMLElement} host
 * @param {() => void} callback
 */
export function useReady(host, callback) {
  useConnectedCallback(host, function connectedBeforeReady() {
    window.addEventListener('ready-context:ready', callback, { once: true });
  });
}
