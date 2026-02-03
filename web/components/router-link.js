import { defineWebComponent } from '#web/component.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useAttribute } from '#web/hooks/use-attribute.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { conditionalAttr, conditionalClass } from '#web/tools/dom.js';
import { webStyleSheets } from '#web/styles.js';

export class RouterLinkElement extends HTMLAnchorElement {
  static get observedAttributes() {
    return ['href', 'replace', 'data-active-class'];
  }

  constructor() {
    super();

    const host = this;
    host.tabIndex = 0;

    const router = useContext(host, RouterContextElement);

    const href = useAttribute(host, 'href');
    const replace = useAttribute(host, 'data-replace');
    const activeClass = useAttribute(host, 'data-active-class', 'active');

    function navigateToHref() {
      if (href.value) {
        const url = new URL(href.value, window.location.origin);
        router.navigate({
          pathname: url.pathname,
          search: url.search,
          replace: replace.value !== null,
        });
      }
    }

    useEffect(host, function syncState() {
      const pathname = router.route.pathname;
      conditionalClass(host, pathname.startsWith(href.value), activeClass.value);
      conditionalAttr(host, pathname === href.value, 'aria-current', 'page');
      if (host.role === 'tab') host.setAttribute('aria-selected', pathname === href.value ? 'true' : 'false');
      else host.removeAttribute('aria-selected');
    });

    host.addEventListener('click', function triggerNavigationByClick(event) {
      assertInstanceOf(MouseEvent, event);
      assertInstanceOf(HTMLAnchorElement, event.currentTarget);
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigateToHref();
    });

    host.addEventListener('keydown', function triggerNavigationByKey(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        navigateToHref();
      }
    });
  }
}

defineWebComponent('router-link', RouterLinkElement, { extends: 'a' });
