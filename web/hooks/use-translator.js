import { reactive } from '@vue/reactivity';
import { DeviceContextElement } from '#web/contexts/device-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
/** @import { EnLangPack as DefaultLangPack } from '#web/lang/en.js' */

/**
 * @template {keyof DefaultLangPack} BaseKey
 * @template {keyof DefaultLangPack[BaseKey]} TextKey
 * @typedef {(baseKey: BaseKey, textKey: TextKey, ...args: unknown[]) => string} TranslatorFunction
 */

/** @type {Map<string, DefaultLangPack | Promise<DefaultLangPack>>} */
const langPackCache = new Map();
const defaultLang = 'en';
const langPackImportMap = {
  async en() { return import('#web/lang/en.js'); },
  async id() { return import('#web/lang/id.js'); }
};

/**
 * @param {HTMLElement} host
 */
export function useTranslator(host) {
  const device = useContext(host, DeviceContextElement);
  const i18n = useContext(host, I18nContextElement);

  const state = reactive({
    isReady: false,
    defaultLangPack: /** @type {DefaultLangPack | null} */ (null),
    langPack: /** @type {DefaultLangPack | null} */ (null),
  });

  useEffect(host, function loadLangPacks() {
    Promise.all([getLangPack(defaultLang), getLangPack(device.language)])
      .then(function setTranslation([defaultLangPack, langPack]) {
        state.defaultLangPack = Object.freeze(defaultLangPack);
        state.langPack = Object.freeze(langPack);
      })
      .finally(function makeReady() {
        state.isReady = true;
      });
  });

  /**
   * @template {keyof DefaultLangPack} BaseKey
   * @template {keyof DefaultLangPack[BaseKey]} TextKey
   * @param {BaseKey} baseKey
   * @param {TextKey} textKey
   * @param {...Array<unknown>} args
   * @returns {string}
   */
  return function translate(baseKey, textKey, ...args) {
    if (!state.isReady) return '';
    if (!state.defaultLangPack) return '';

    const base = state.langPack?.[baseKey]
      ?? state.defaultLangPack?.[baseKey];

    if (!base) {
      console.warn(`translator: Missing base key '${baseKey}' in language pack`);
      return `[${baseKey}.${String(textKey)}]`;
    }

    let text = /** @type {string} */ (base?.[textKey]
      ?? state.defaultLangPack?.[baseKey]?.[textKey]);

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
     * 
     * @param {unknown} arg
     * @param {string} match
     * @param {string} precision
     * @param {string} specifier
     */
    function formatArg(arg, match, precision, specifier) {
      switch (specifier) {
        case 's':
          if (typeof arg === 'string') return arg;
          else if (arg instanceof Error) return arg.message;
          else return String(arg);
        case 'd':
          const maybeNumber = parseInt(String(arg), 10);
          const notNaN = Number.isNaN(maybeNumber) ? 0 : maybeNumber;
          const finiteNumber = Number.isFinite(maybeNumber) ? notNaN : 0;
          return String(finiteNumber);
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
    }
    let argIndex = 0;
    const interpolatedText = args.length > 0
      ? text.replace(/%(?:\.(\d+))?([sdcDT]|f)/g, function interpolatePlaceholder(match, precision, specifier) {
        if (argIndex >= args.length) return match; // Not enough arguments, keep placeholder
        const arg = args[argIndex++];
        const formattedArg = formatArg(arg, match, precision, specifier);
        // console.debug('text', { text, arg, formattedArg }, { match, precision, specifier });
        return formattedArg;
      })
      : text;

    return interpolatedText;
  };
}

/** @template {string} T @typedef {T | (string & {})} LiteralUnion */

/**
 * @param {HTMLElement} host
 */
export function useLiteral(host) {
  const translate = useTranslator(host);
  /**
   * @param {LiteralUnion<keyof DefaultLangPack['literal']>} textKey
   * @param {...Array<unknown>} args
   * @returns {string}
   */
  return function literal(textKey, ...args) {
    return translate(
      'literal',
      /** @type {any} mandatory any cast */ (textKey),
      ...args,
    );
  };
}

/**
 * @param {string} language
 * @returns {Promise<DefaultLangPack>}
 */
async function getLangPack(language) {
  // Normalize language code to just the primary language tag (e.g., 'en-US' -> 'en')
  const langCode = language.split('-')[0].toLowerCase();

  if (langPackCache.has(langCode)) {
    const cachedLangPack = langPackCache.get(langCode);
    if (cachedLangPack instanceof Promise) return cachedLangPack;
    return Promise.resolve(cachedLangPack);
  }

  const langPackPromise = (async function loadLangPack() {
    try {
      const { default: langPack } = await langPackImportMap[langCode]?.() ?? langPackImportMap[defaultLang]();
      langPackCache.set(langCode, langPack);
      return langPack;
    }
    catch {
      langPackCache.set(langCode, null);
      throw new Error(`Failed to load language pack for '${langCode}'`);
    }
  })();

  langPackCache.set(langCode, langPackPromise);

  return langPackPromise;
}
