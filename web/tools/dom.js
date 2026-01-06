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
