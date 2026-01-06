/**
 * @param {HTMLElement} host
 * @param {CSSStyleSheet[]} sheets
 */
export function useAdoptedStyleSheets(host, sheets) {
  const shadowRoot = host.shadowRoot || host.attachShadow({ mode: 'open' });
  shadowRoot.adoptedStyleSheets = [
    ...shadowRoot.adoptedStyleSheets,
    ...sheets,
  ];
}
