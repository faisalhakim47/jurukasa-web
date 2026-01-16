import { getContextValue } from '#web/context.js';
import { useConnectedCallback } from '#web/hooks/use-lifecycle.js';

/**
 * @template {HTMLElement} ValueType
 * @param {ValueType} host
 * @returns {ValueType} reactive ValueType
 */
export function provideContext(host) {
  host.addEventListener('context-request', function contextProvider(event) {
    if (event.context === host.constructor) {
      event.stopImmediatePropagation();
      // No try-catch here
      // The callback implementor is responsible for keeping error-free function
      event.callback(host);
    }
  });
  return host;
}

const contextValue = Symbol('ContextValue');

/**
 * @template {HTMLElement} ValueType
 * @param {HTMLElement} host
 * @param {new () => ValueType} contextKey
 * @returns {ValueType}
 */
export function useContext(host, contextKey) {
  let isConnected = false;
  let context = /** @type {ValueType} */ (undefined);
  const contextProxy = new Proxy(/** @type {object} as placeholder */ ({}), {
    // Note: context value in this app is always an instance of HTMLElement subclass. Each context class is responsible to provide portable/standalone method functions. This proxy is not responsible to bind "this" context.
    get(_, prop) {
      if (isConnected && context instanceof contextKey) return context[prop];
      else if (isConnected) throw new Error(`
        Context Provider for type ${contextKey.name} is not available. There are two posible issues:
          1. The provider is not in the DOM ancestor tree of the requestor element.
          2. The context getter function is called in a wrong scope (before the connected callback is fired). This getter should be called by minimum on useConnectedCallback hook or later. This getter is always save to call inside any hooks such as useEffect.
      `);
      else throw new Error(`Cannot access context of type ${contextKey.name} on disconnected element ${host.tagName.toLowerCase()}.`);
    },
    set() {
      throw new Error('Context state is read-only.');
    },
    has(_, prop) {
      if (isConnected) return context instanceof contextKey && prop in context;
      else throw new Error('Cannot check context state on disconnected element.');
    },
  });
  useConnectedCallback(host, function usingContext() {
    isConnected = true;
    context = getContextValue(host, contextKey);
    // For debugging purposes. To expose exact context instance to be inspected in devtools.
    if (context instanceof contextKey) {
      Object.defineProperty(contextProxy, contextValue, {
        value: context,
        writable: false,
        enumerable: false,
        configurable: false,
      });
    }
    return function removeContext() {
      isConnected = false;
      context = undefined;
    };
  });
  return contextProxy;
}

/**
 * It is recommended to use useContext instead of this optional version for better type safety.
 * 
 * @template {HTMLElement} ValueType
 * @param {HTMLElement} host
 * @param {new () => ValueType} contextKey
 * @returns {ValueType | undefined}
 */
export function useOptionalContext(host, contextKey) {
  let context = /** @type {ValueType | undefined} */ (undefined);
  useConnectedCallback(host, function handleConnected() {
    context = getContextValue(host, contextKey);
    return function handleDisconnected() { context = undefined; };
  });
  return new Proxy(/** @type {object} as placeholder */ ({}), {
    get(_, prop) { return context?.[prop]; },
    set() { throw new Error('Context state is read-only.'); },
    has(_, prop) { return context !== undefined && prop in context; },
  });
}
