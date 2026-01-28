import { defineWebComponent } from '#web/component.js';
import { useBusyStateResolver } from '#web/contexts/ready-context.js';
import { useAttributeChangedCallback } from '#web/hooks/use-lifecycle.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { getMetaContent } from '#web/tools/dom.js';
import { reactive } from '@vue/reactivity';

/** @type {Map<string, Promise<HTMLTemplateElement>>} */
const svgTemplateMap = new Map();
const appEnv = getMetaContent('app-env', 'production');
const materialSymbolsProviderUrl = getMetaContent('material-symbols-provider-url', 'https://cdn.jsdelivr.net/npm/@material-symbols/svg-{WEIGHT}@0.40.2/{STYLE}/{NAME}{FILL}.svg');

export class MaterialSymbolsElement extends HTMLElement {
  static observedAttributes = ['provider-url', 'weight', 'style', 'fill', 'size', 'name', 'label'];

  constructor() {
    super();

    const host = this;
    const ready = useBusyStateResolver(host);

    const icon = reactive({
      providerUrl: this.getAttribute('provider-url') || materialSymbolsProviderUrl,
      weight: this.getAttribute('weight') || '400',
      style: this.getAttribute('style') || 'rounded',
      fill: this.getAttribute('fill') || 'true',
      size: this.getAttribute('size') || '',
      name: this.getAttribute('name') || 'home',
      label: this.getAttribute('label') || '',
    });

    const validWeights = ['100', '200', '300', '400', '500', '600', '700'];
    const validStyles = ['rounded', 'outlined', 'sharp'];

    /** @param {string} newValue */
    function setWeight(newValue) {
      if (validWeights.includes(newValue)) icon.weight = newValue;
      else icon.weight = '400';
    };

    /** @param {string} newValue */
    function setStyle(newValue) {
      if (validStyles.includes(newValue)) icon.style = newValue;
      else icon.style = 'rounded';
    };

    /** @param {string} newValue */
    function setFill(newValue) {
      icon.fill = newValue === 'true' ? 'true' : 'false';
    };

    useAttributeChangedCallback(host, function (name, _, newValue) {
      if (name === 'provider-url') icon.providerUrl = newValue;
      else if (name === 'weight') setWeight(newValue);
      else if (name === 'style') setStyle(newValue);
      else if (name === 'fill') setFill(newValue);
      else if (name === 'size') icon.size = newValue;
      else if (name === 'name') icon.name = newValue;
      else if (name === 'label') icon.label = newValue;
    });

    this.setAttribute('role', 'img');

    useEffect(host, function renderMaterialSymbols() {
      const fillSuffix = icon.fill === 'true' ? '-fill' : '';
      const iconUrl = icon.providerUrl
        .replace('{WEIGHT}', icon.weight)
        .replace('{STYLE}', icon.style)
        .replace('{NAME}', icon.name)
        .replace('{FILL}', fillSuffix);

      if (icon.label) {
        host.setAttribute('aria-label', icon.label);
        host.removeAttribute('aria-hidden');
      }
      else {
        host.removeAttribute('aria-label');
        host.setAttribute('aria-hidden', 'true');
      }

      if (icon.size) {
        host.style.width = `${icon.size}px`;
        host.style.height = `${icon.size}px`;
      }
      else {
        host.style.removeProperty('width');
        host.style.removeProperty('height');
      }

      const svgResponse = svgTemplateMap.has(iconUrl)
        ? svgTemplateMap.get(iconUrl)
        : (async function fetchSvg() {
          if (appEnv === 'development') {
            await Promise.resolve();
            const template = document.createElement('template');
            template.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>${icon.label || icon.name}</title><path fill="currentColor" d="M12 2L2 7v6c0 5 3.8 9.7 9 11 5.2-1.3 9-6 9-11V7l-10-5z"></path></svg>`;
            return template;
          }
          const svgResponse = fetch(iconUrl)
            .then(function (response) {
              if (response.ok) return response.text();
              else throw new Error(`Failed to load icon: ${response.status} ${response.statusText}`);
            })
            .then(function (svgText) {
              const preppedSvgText = svgText.replace('"><path', '"><title></title><path fill="currentColor"');
              const template = document.createElement('template');
              template.innerHTML = preppedSvgText;
              return template;
            });
          svgTemplateMap.set(iconUrl, svgResponse);
          return svgResponse;
        })();

      svgResponse
        .then(function (svgTemplate) {
          const clonedSvg = svgTemplate.content.cloneNode(true);
          while (host.firstChild) host.removeChild(host.firstChild);
          host.appendChild(clonedSvg);
          const svg = host.querySelector('svg');
          const title = svg.querySelector('title');
          svg.removeAttribute('width');
          svg.removeAttribute('height');
          if (title) title.textContent = icon.label || icon.name;
        })
        .finally(ready);

      return svgResponse;
    });
  }
}

defineWebComponent('material-symbols', MaterialSymbolsElement);
