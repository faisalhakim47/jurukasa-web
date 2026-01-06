import { render as litRender } from 'lit-html';
/** @import { TemplateResult } from 'lit-html' */

const renderedHosts = new WeakSet();

/**
 * @param {HTMLElement} host
 * @returns {boolean}
 */
export function hasRendered(host) {
  return renderedHosts.has(host);
}

/**
 * @param {HTMLElement} host
 * @returns {(value: TemplateResult<1>) => void}
 */
export function useRender(host) {
  const shadowRoot = host.shadowRoot || host.attachShadow({ mode: 'open' });
  return function render(value) {
    litRender(value, shadowRoot);
    if (!renderedHosts.has(host)) {
      renderedHosts.add(host);
      host.dispatchEvent(new CustomEvent('use-render:rendered', { bubbles: false, composed: false }));
    }
  };
}
