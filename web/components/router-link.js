import { html, render } from 'lit-html';
import { reactive } from '@vue/reactivity';
import { defineWebComponent } from '#web/component.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useAttributeChangedCallback } from '#web/hooks/use-lifecycle.js';
import { useRender } from '#web/hooks/use-render.js';
import { webStyleSheets } from '#web/styles.js';
import { conditionalAttr, conditionalClass } from '#web/tools/dom.js';

export class RouterLinkElement extends HTMLElement {
  static get observedAttributes() {
    return ['href', 'aria-current', 'replace'];
  }

  constructor() {
    super();

    const host = this;
    host.tabIndex = 0;
    host.role = host.role || 'link';

    const router = useContext(host, RouterContextElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const props = reactive({
      href: host.getAttribute('href'),
      replace: host.hasAttribute('replace'),
      dataActiveClass: host.getAttribute('data-active-class') || 'active',
    });

    useAttributeChangedCallback(host, function (name, oldValue, newValue) {
      if (name === 'href') props.href = newValue;
      if (name === 'replace') props.replace = this.hasAttribute('replace');
      if (name === 'data-active-class') props.dataActiveClass = newValue || 'active';
    });

    useEffect(host, function syncState() {
      const pathname = router.route.pathname;
      conditionalClass(host, pathname.startsWith(props.href), props.dataActiveClass);
      if (host.role === 'link') conditionalAttr(host, pathname === props.href, 'aria-current', 'page');
      else if (host.role === 'tab') host.setAttribute('aria-selected', pathname === props.href ? 'true' : 'false');
      else if (host.role === 'button') {/* no-op */}
      else throw new Error(`Unsupported role="${host.role}" on <router-link>`);
    });

    this.addEventListener('click', function triggerNavigationByClick(event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (props.href) router.navigate({
        pathname: props.href,
        replace: props.replace,
      });
    });

    this.addEventListener('keydown', function triggerNavigationByKey(event) {
      if (event.key === 'Enter') {
        if (props.href) router.navigate({
          pathname: props.href,
          replace: props.replace,
        });
      }
    });

    useEffect(host, function renderRouterLink() {
      render(html`
        <a
          href="${props.href || '#'}"
          style="
            display: contents;
            color: inherit;
            text-decoration: none;
          "
        ><slot></slot></a>
      `);
    });
  }
}

defineWebComponent('router-link', RouterLinkElement);
