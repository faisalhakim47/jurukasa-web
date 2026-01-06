import { html } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { DeviceContextElement } from '#web/contexts/device-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';

import '#web/components/router-link.js';
import '#web/views/books-view.js';
import '#web/views/dashboard-view.js';
import '#web/views/desktop-view.js';

export class MainViewElement extends HTMLElement {
  constructor() {
    super();
    const host = this;
    const device = useContext(host, DeviceContextElement);
    const render = useRender(host);

    useBusyStateUntil(host, function evaluateReady() {
      return true;
    });

    useEffect(host, function renderMainView() {
      if (device.isDesktop) render(html`<desktop-view></desktop-view>`);
      else if (device.isMobile) render(html`
        <div style="padding: 32px;">
          <h1>Woops!</h1>
          <p>The mobile support is yet to be implemented</p>
        </div>
      `);
      else render(html`
        <div style="padding: 32px;">
          <h1>What?</h1>
          <p>Something goes horibly wrong here...</p>
        </div>
      `);
    });
  }
}

defineWebComponent('main-view', MainViewElement);
