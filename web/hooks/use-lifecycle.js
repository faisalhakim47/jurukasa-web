/**
 * This override mechanism is to accomodates jsdom and similar environments that caches web component's callbacks.
 * In such environments, once a web component is defined, its prototype's connectedCallback and disconnectedCallback
 * are cached and further modifications to the prototype's callbacks are ignored.
 * This makes it impossible to use the useConnectedCallback and useDisconnectedCallback hooks properly.
 */

/**
 * Helper function to call a callback with error handling.
 *
 * @param {Element} context
 * @param {Function} callback
 * @param {...unknown} args
 */
function tryCall(context, callback, ...args) {
  if (typeof callback === 'function') {
    try { return callback.call(context, ...args); }
    catch (error) { console.warn('Error calling web component callback:', error); }
  }
}

/**
 * These symbols are used as key of property to store the original connected and disconnected callbacks on the web component constructor.
 * Each constructor must be overridden directly. Inheritance/subclasses/mixed-realm constructors are NOT supported.
 */
const originalConnectedCallbackKey = Symbol('OverriddenConnectedCallback');
const originalDisconnectedCallbackKey = Symbol('OverriddenDisconnectedCallback');
const originalAttributeChangedCallbackKey = Symbol('OverriddenAttributeChangedCallback');

/**
 * These symbols are used as key of property to store the set of connected callbacks on the web component instance.
 * It is designed this way to simplify the callbacks memory management, as the callbacks will be automatically garbage collected along with the web component instance itself. No unsubscribe mechanism is needed.
 */
const connectedCallbackSetKey = Symbol('ConnectedCallbackSet');
const disconnectedCallbackSetKey = Symbol('DisconnectedCallbackSet');
const attributeChangedCallbackSetKey = Symbol('AttributeChangedCallbackSet');

/**
 * @param {CustomElementConstructor} constructor
 * @returns {CustomElementConstructor}
 */
export function overrideWebComponentCallbacks(constructor) {
  if (originalConnectedCallbackKey in constructor || originalDisconnectedCallbackKey in constructor || originalAttributeChangedCallbackKey in constructor) {
    throw new Error('The web component is already overridden. Please make sure to call overrideWebComponentCallbacks only once for each web component constructor.');
  }
  const connectedCallback = (constructor[originalConnectedCallbackKey] = constructor.prototype.connectedCallback)
    ?? function defaultConnectedCallback() { };
  const disconnectedCallback = (constructor[originalDisconnectedCallbackKey] = constructor.prototype.disconnectedCallback)
    ?? function defaultDisconnectedCallback() { };
  const attributeChangedCallback = (constructor[originalAttributeChangedCallbackKey] = constructor.prototype.attributeChangedCallback)
    ?? function defaultAttributeChangedCallback() { };

  constructor.prototype.connectedCallback = function overriddenConnectedCallback() {
    tryCall(this, connectedCallback);
    /** @type {Set<() => void | (() => void)>} */
    const connectedCallbackSet = this[connectedCallbackSetKey];
    if (connectedCallbackSet instanceof Set) for (const connectedCallback of Array.from(connectedCallbackSet)) {
      const disconnectedCallback = tryCall(this, connectedCallback);
      if (typeof disconnectedCallback === 'function') {
        (this[disconnectedCallbackSetKey] ??= new Set()).add(disconnectedCallback);
      }
    }
  };
  constructor.prototype.disconnectedCallback = function overriddenDisconnectedCallback() {
    tryCall(this, disconnectedCallback);
    /** @type {Set<() => void>} */
    const disconnectedCallbackSet = this[disconnectedCallbackSetKey];
    if (disconnectedCallbackSet instanceof Set) {
      for (const disconnectedCallback of Array.from(disconnectedCallbackSet)) tryCall(this, disconnectedCallback);
      disconnectedCallbackSet.clear();
    }
  };
  /**
   * @param {string} name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   */
  constructor.prototype.attributeChangedCallback = function overriddenAttributeChangedCallback(name, oldValue, newValue) {
    tryCall(this, attributeChangedCallback, name, oldValue, newValue);
    /** @type {Set<(name: string, oldValue: string | null, newValue: string | null) => void>} */
    const attributeChangedCallbackSet = this[attributeChangedCallbackSetKey];
    if (attributeChangedCallbackSet instanceof Set) {
      for (const callback of attributeChangedCallbackSet) {
        tryCall(this, callback, name, oldValue, newValue);
      }
    }
  };
  return constructor;
}

/**
 * @param {HTMLElement} host
 * @param {() => void | (() => void)} callback - The callback to execute on connect. Can optionally return a disconnected function that will be called on disconnect.
 */
export function useConnectedCallback(host, callback) {
  /** @type {Set<() => void>} */
  const connectedCallbackSet = (host[connectedCallbackSetKey] ??= new Set());
  connectedCallbackSet.add(callback);
}

/**
 * @param {HTMLElement} host
 * @param {(name: string, oldValue: string | null, newValue: string | null) => void} callback
 */
export function useAttributeChangedCallback(host, callback) {
  /** @type {Set<(name: string, oldValue: string | null, newValue: string | null) => void>} */
  const attributeChangedCallbackSet = (host[attributeChangedCallbackSetKey] ??= new Set());
  attributeChangedCallbackSet.add(callback);
}
