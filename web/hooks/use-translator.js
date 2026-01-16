import { reactive } from '@vue/reactivity';
import { DeviceContextElement } from '#web/contexts/device-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
/** @import { EnTranslationPack as DefaultTranslationPack } from '#web/lang/en.js' */

/**
 * @template {keyof DefaultTranslationPack} BaseKey
 * @template {keyof DefaultTranslationPack[BaseKey]} TextKey
 * @typedef {(baseKey: BaseKey, textKey: TextKey, ...args: unknown[]) => string} TranslatorFunction
 */

/**
 * @param {HTMLElement} host
 */
export function useTranslator(host) {
  const device = useContext(host, DeviceContextElement);
  const i18n = useContext(host, I18nContextElement);

  const state = reactive({
    isReady: false,
    defaultTranslationPack: /** @type {DefaultTranslationPack | null} */ (null),
    translationPack: /** @type {DefaultTranslationPack | null} */ (null),
  });

  useEffect(host, function loadTranslationPacks() {
    Promise.all([getTranslationPack(defaultLang), getTranslationPack(device.language)])
      .then(function setTranslation([defaultTranslationPack, translationPack]) {
        state.defaultTranslationPack = Object.freeze(defaultTranslationPack);
        state.translationPack = Object.freeze(translationPack);
      })
      .finally(function makeReady() {
        state.isReady = true;
      });
  });

  /**
   * @template {keyof DefaultTranslationPack} BaseKey
   * @template {keyof DefaultTranslationPack[BaseKey]} TextKey
   * @param {BaseKey} baseKey
   * @param {TextKey} textKey
   * @param {...Array<unknown>} args
   * @returns {string}
   */
  return function translate(baseKey, textKey, ...args) {
    if (!state.isReady) return '';
    if (!state.defaultTranslationPack) return '';

    const base = state.translationPack?.[baseKey]
      ?? state.defaultTranslationPack?.[baseKey];

    if (!base) {
      console.warn(`translator: Missing base key '${baseKey}' in language pack`);
      return `[${baseKey}.${String(textKey)}]`;
    }

    let text = /** @type {string} */ (base?.[textKey]
      ?? state.defaultTranslationPack?.[baseKey]?.[textKey]);

    if (typeof text === 'string' && text.length > 0) { /* no-op, text is valid */ }
    else if (typeof text === 'boolean' && text === true) text = String(textKey); // literal translation support
    else {
      console.warn(`translator: Missing text key '${String(textKey)}' in '${baseKey}'`);
      return `[${baseKey}.${String(textKey)}]`;
    }

    /**
     * Supports printf-like format specifiers:
     * - %s: string
     * - %d: integer
     * - %.Nf: localized numeric with N decimal places
     * - %c: displayed currency
     * - %D: formatted date
     * - %T: formatted time
     */
    let argIndex = 0;
    const interpolatedText = args.length > 0
      ? text.replace(/%(?:\.(\d+))?([sdcDT]|f)/g, function interpolatePlaceholder(match, precision, specifier) {
        if (argIndex >= args.length) return match; // Not enough arguments, keep placeholder
        const arg = args[argIndex++];
        switch (specifier) {
          case 's':
            return String(arg);
          case 'd':
            return String(Math.floor(Number(arg)));
          case 'f':
            const num = Number(arg);
            const decimals = precision ? parseInt(precision, 10) : 2;
            const locale = device?.locale || 'en-GB';
            return new Intl.NumberFormat(locale, {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            }).format(num);
          case 'c':
            return i18n?.displayCurrency(Number(arg)) ?? String(arg);
          case 'D':
            return arg instanceof Date
              ? i18n?.date.format(arg) ?? String(arg)
              : String(arg);
          case 'T':
            return arg instanceof Date
              ? i18n?.time.format(arg) ?? String(arg)
              : String(arg);
          default:
            return match;
        }
      })
      : text;

    return interpolatedText;
  };
}

/**
 * @param {HTMLElement} host
 */
export function useLiteral(host) {
  const translate = useTranslator(host);
  /**
   * @param {keyof DefaultTranslationPack['literal']} textKey
   * @param {...Array<unknown>} args
   * @returns {string}
   */
  return function literal(textKey, ...args) {
    return translate('literal', textKey, ...args);
  };
}

/** @type {Map<string, DefaultTranslationPack | Promise<DefaultTranslationPack>>} */
const translationPackCache = new Map();
const defaultLang = 'en';
const langImportMap = {
  async en() { return import('#web/lang/en.js'); },
  async id() { return import('#web/lang/id.js'); }
};

/**
 * @param {string} language
 * @returns {Promise<DefaultTranslationPack>}
 */
async function getTranslationPack(language) {
  // Normalize language code to just the primary language tag (e.g., 'en-US' -> 'en')
  const langCode = language.split('-')[0].toLowerCase();

  if (translationPackCache.has(langCode)) {
    const cachedTranslationPack = translationPackCache.get(langCode);
    if (cachedTranslationPack instanceof Promise) return cachedTranslationPack;
    return Promise.resolve(cachedTranslationPack);
  }

  const translationPackPromise = (async function loadTranslationPack() {
    try {
      const { default: translationpack } = await langImportMap[langCode]?.() ?? langImportMap[defaultLang]();
      translationPackCache.set(langCode, translationpack);
      return translationpack;
    }
    catch {
      translationPackCache.set(langCode, null);
      throw new Error(`Failed to load language pack for '${langCode}'`);
    }
  })();

  translationPackCache.set(langCode, translationPackPromise);

  return translationPackPromise;
}
