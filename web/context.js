/**
 * Read the `web/contexts/AGENTS.md` file for complete information
 */

/**
 * A context key is the constructor of Web Component Element (extended Element)
 * 
 * @template {Element} ValueType
 * @typedef {new () => ValueType} Context
 */

/**
 * A helper type, same as UnknownContext
 * 
 * @typedef {Context<Element>} AnyContext
 */

/**
 * An event fired by a context requester to signal it desires a named context.
 * 
 * A provider should inspect the `context` property of the event to determine if it has a value that can
 * satisfy the request, calling the `callback` with the requested value if so.
 * 
 * A provider must pass the same context value reference to all invocations of the `callback` for a given request to keep reactivity intact.
 * 
 * @template {AnyContext} Context
 */
export class ContextRequestEvent extends Event {
  /**
   * @param {Context} context
   * @param {(value: InstanceType<Context>) => void} callback
   * @param {boolean} [subscribe]
   */
  constructor(context, callback, subscribe) {
    super('context-request', { bubbles: true, composed: true });
    this.context = context;
    this.callback = callback;
    if (subscribe === true) console.warn('We decided to not support subscription for simplicity.');
  }
}

/**
 * Helper function to get context value
 * 
 * @template {HTMLElement} ValueType
 * @param {HTMLElement} host
 * @param {new () => ValueType} contextKey
 * @returns {ValueType}
 */
export function getContextValue(host, contextKey) {
  let context = /** @type {ValueType | undefined} */ (undefined);
  host.dispatchEvent(new ContextRequestEvent(contextKey, function contextReceiver(value) {
    context = value;
  }));
  if (context instanceof HTMLElement) {
    return /** @type {ValueType} */ (context);
  }
  throw new Error('No context provider found for the requested context: ' + contextKey.name);
}
