import { defineWebComponent } from '#web/component.js';
import { useBusyStateResolver } from '#web/contexts/ready-context.js';
import { provideContext } from '#web/hooks/use-context.js';

export class FontContextElement extends HTMLElement {
  constructor() {
    super();

    const context = provideContext(this);
    const fontResolve = useBusyStateResolver(context);

    document.fonts.ready.then(fontResolve);
  }
}

defineWebComponent('font-context', FontContextElement);
