import { defineWebComponent } from '#web/component.js';
import { useBusyStateResolver } from '#web/contexts/ready-context.js';
import { provideContext } from '#web/hooks/use-context.js';

export class FontContextElement extends HTMLElement {
  constructor() {
    super();

    provideContext(this);

    const host = this;
    const fontResolve = useBusyStateResolver(host);

    document.fonts.ready.then(fontResolve);
  }
}

defineWebComponent('font-context', FontContextElement);
