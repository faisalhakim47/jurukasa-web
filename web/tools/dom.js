/**
 * @param {HTMLElement} element
 * @param {string} className
 * @param {boolean} condition
 */
export function conditionalClass(element, condition, className) {
  if (condition) element.classList.add(className);
  else element.classList.remove(className);
}

/**
 * @param {Element} element
 * @param {boolean} condition
 * @param {string} name
 * @param {string} [value]
 */
export function conditionalAttr(element, condition, name, value) {
  if (condition) element.setAttribute(name, value ?? '');
  else element.removeAttribute(name);
}

/** @type {Map<string, string>} */
const cachedMeta = new Map();

/**
 * @param {string} name
 * @param {string} defaultContent
 */
export function getMetaContent(name, defaultContent) {
  if (cachedMeta.has(name)) return cachedMeta.get(name) || defaultContent;
  else {
    const meta = document.head.querySelector(`meta[name="${name}"]`);
    cachedMeta.set(name, meta instanceof HTMLMetaElement ? meta.content : defaultContent);
    return cachedMeta.get(name) || defaultContent;
  }
}

/** @param {HTMLElement} element */
export function scrollIntoView(element) {
  const applicationEnvironment = getMetaContent('application-environment', 'production');
  element.scrollIntoView({
    behavior: applicationEnvironment === 'testing' ? 'instant' : 'smooth',
    block: 'nearest',
    inline: 'start',
  });
}

/**
 * @param {EventTarget} target
 * @param {string} eventName
 * @param {number} [timeout]
 * @returns {Promise<Event>}
 */
export async function waitForEvent(target, eventName, timeout = 5000) {
  return await new Promise(function listenerPromise(resolve, reject) {
    let settled = false;
    /** @param {Event} event */
    function eventListener(event) {
      if (settled) return;
      settled = true;
      target.removeEventListener(eventName, eventListener);
      resolve(event);
    };
    target.addEventListener(eventName, eventListener);
    setTimeout(function eventTimeout() {
      if (settled) return;
      settled = true;
      target.removeEventListener(eventName, eventListener);
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);
  });
}

