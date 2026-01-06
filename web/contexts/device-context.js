import { reactive } from '@vue/reactivity';
import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { useExposed } from '#web/hooks/use-exposed.js';
import { provideContext, useContext } from '#web/hooks/use-context.js';
import { useWindowEventListener } from '#web/hooks/use-window-event-listener.js';
import { useEffect } from '#web/hooks/use-effect.js';

export class DeviceContextElement extends HTMLElement {
  constructor() {
    super();

    provideContext(this);

    const host = this;
    const database = useContext(host, DatabaseContextElement);

    const device = reactive({
      isDesktop: window.innerWidth > 768,
      isMobile: window.innerWidth <= 768,
      locale: navigator.language || 'en-US',
    });

    this.isDesktop = useExposed(host, function readIsDesktop() { return device.isDesktop; });
    this.isMobile = useExposed(host, function readIsMobile() { return device.isMobile; });
    this.locale = useExposed(host, function readLocale() { return device.locale; });

    useWindowEventListener(host, 'resize', function syncDeviceOnResize() {
      device.isDesktop = window.innerWidth > 768;
      device.isMobile = window.innerWidth <= 768;
      device.locale = navigator.language || 'en-US';
    });

    useEffect(host, function loadConfig() {
      database.sql`SELECT value FROM config WHERE key = 'Locale'`
        .then(function (result) {
          const configLocale = String(result[0]?.value || '');
          if (configLocale) device.locale = configLocale;
          else device.locale = navigator.language || 'en-US';
        });
    });
  }
}

defineWebComponent('device-context', DeviceContextElement);
