import { reactive } from '@vue/reactivity';
import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { useExposed } from '#web/hooks/use-exposed.js';
import { useContext, provideContext } from '#web/hooks/use-context.js';
import { useWindowEventListener } from '#web/hooks/use-window-event-listener.js';
import { useEffect } from '#web/hooks/use-effect.js';

export class DeviceContextElement extends HTMLElement {
  constructor() {
    super();

    provideContext(this);

    const host = this;
    const database = useContext(host, DatabaseContextElement);

    const defaultOptions = new Intl.DateTimeFormat().resolvedOptions();
    const device = reactive({
      isDesktop: window.innerWidth > 768,
      isMobile: window.innerWidth <= 768,
      language: navigator.language || 'en-GB',
      locale: defaultOptions.locale || 'en-GB',
    });

    this.isDesktop = useExposed(host, function readIsDesktop() { return device.isDesktop; });
    this.isMobile = useExposed(host, function readIsMobile() { return device.isMobile; });
    this.language = useExposed(host, function readLocale() { return device.language; });
    this.locale = useExposed(host, function readLocale() { return device.locale; });

    /**
     * Set the application language
     * @param {string} languageCode - The language code to set (e.g., 'en', 'id')
     */
    this.setLanguage = function setLanguage(languageCode) {
      device.language = languageCode;
    };

    useWindowEventListener(host, 'resize', function syncDeviceOnResize() {
      const defaultOptions = new Intl.DateTimeFormat().resolvedOptions();
      device.isDesktop = window.innerWidth > 768;
      device.isMobile = window.innerWidth <= 768;
      device.language = navigator.language || 'en-US';
      device.locale = defaultOptions.locale || 'en-GB';
    });

    useEffect(host, function loadConfig() {
      database.sql`SELECT value FROM config WHERE key = 'Language'`
        .then(function resolvedConfig(result) {
          const configLanguage = String(result.rows[0]?.value || '');
          if (configLanguage) device.language = configLanguage;
          else device.language = navigator.language || 'en';
        })
        .catch(function handleError() {
          // If Language config doesn't exist yet, fall back to navigator language
          device.language = navigator.language || 'en';
        });
    });
  }
}

defineWebComponent('device-context', DeviceContextElement);
