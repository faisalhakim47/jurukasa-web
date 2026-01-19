import { computed, reactive } from '@vue/reactivity';
import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { DeviceContextElement } from '#web/contexts/device-context.js';
import { useExposed } from '#web/hooks/use-exposed.js';
import { provideContext, useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
/** @import { EnTranslationPack } from '#web/lang/en.js' */

export class I18nContextElement extends HTMLElement {
  constructor() {
    super();

    provideContext(this);

    const host = this;
    const device = useContext(host, DeviceContextElement);
    const database = useContext(host, DatabaseContextElement);

    const config = reactive({
      currencyCode: 'IDR',
      currencyDecimals: 0,
    });

    useEffect(host, function loadConfig() {
      database.sql`SELECT value FROM config WHERE key in ('Currency Code', 'Currency Decimals');`
        .then(function setCurrencyConfig(result) {
          for (const row of result.rows) {
            const key = String(row.key);
            const value = String(row.value);
            if (key === 'Currency Code') {
              config.currencyCode = value || 'IDR';
            }
            else if (key === 'Currency Decimals') {
              const decimals = Number(value);
              config.currencyDecimals = Number.isInteger(decimals) && decimals >= 0 ? decimals : 0;
            }
          }
        });
    });

    this.date = useExposed(host, function createDateFormatter() {
      return new Intl.DateTimeFormat(device.locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    });

    this.time = useExposed(host, function createTimeFormatter() {
      return new Intl.DateTimeFormat(device.locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    });

    const currency = computed(function createNumberFormatter() {
      return new Intl.NumberFormat(device.locale, {
        style: 'currency',
        currency: config.currencyCode,
        minimumFractionDigits: config.currencyDecimals,
        maximumFractionDigits: config.currencyDecimals,
      });
    });

    this.currency = useExposed(host, currency);

    /**
     * @param {number} value in the lowest denomination (e.g., cents)
     */
    this.displayCurrency = function displayCurrency(value) {
      const normalDenominatedValue = value / Math.pow(10, config.currencyDecimals);
      return currency.value.format(normalDenominatedValue);
    };
  }
}

defineWebComponent('i18n-context', I18nContextElement);
