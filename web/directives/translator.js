import { nothing } from 'lit-html';
import { AsyncDirective } from 'lit-html/async-directive.js';
import { directive, PartType } from 'lit-html/directive.js';
import { DeviceContextElement } from '#web/contexts/device-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { getContextValue } from '#web/context.js';
/** @import { Part, PartInfo } from 'lit-html/async-directive.js' */
/** @import { DirectiveResult } from 'lit-html/directive.js' */
/** @import { EnTranslationPack as DefaultTranslationPack } from '#web/lang/en/index.js' */

/** @type {Map<string, DefaultTranslationPack | Promise<DefaultTranslationPack>>} */
const translationPackCache = new Map();
const defaultLang = 'en';

/** @typedef {string | number | symbol} Prop */

/**
 * Get language pack for the given language code.
 * Uses caching to avoid redundant imports.
 * 
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
      const { default: translationpack } = await import(`#web/lang/${langCode}/index.js`);
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

/**
 * Substitute placeholders in a translation string with provided arguments.
 * Supports printf-like format specifiers:
 * - %s: string
 * - %d: integer
 * - %.Nf: localized numeric with N decimal places
 * - %c: displayed currency
 * - %D: formatted date
 * - %T: formatted time
 * 
 * @param {string} text
 * @param {unknown[]} args
 * @param {DeviceContextElement | null} device
 * @param {I18nContextElement | null} i18n
 * @returns {string}
 */
function interpolateText(text, args, device, i18n) {
  let argIndex = 0;
  return text.replace(/%(?:\.(\d+))?([sdcDT]|f)/g, function interpolatePlaceholder(match, precision, specifier) {
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
  });
}

/**
 * Get the host element from a directive's part.
 * Traverses up the part tree to find the root element.
 * 
 * @param {Part} part
 * @returns {Element | null}
 */
function getHostFromPart(part) {
  // For ChildPart, get the parent node
  if ('parentNode' in part && part.parentNode instanceof Element) {
    return part.parentNode;
  }
  // For AttributePart, get the element directly
  if ('element' in part && part.element instanceof Element) {
    return part.element;
  }
  return null;
}

class TranslatorDirective extends AsyncDirective {
  /** @type {string} */ baseKey;
  /** @type {string} */ textKey;
  /** @type {unknown[]} */ args = [];

  /**
   * @param {PartInfo} partInfo
   */
  constructor(partInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.CHILD && partInfo.type !== PartType.ATTRIBUTE) {
      throw new Error('translator directive can only be used in child or attribute parts');
    }
  }

  /**
   * @param {string} baseKey
   * @param {string} textKey
   * @param {...unknown} args
   */
  render(baseKey, textKey, ...args) {
    this.baseKey = baseKey;
    this.textKey = textKey;
    this.args = args;

    // Return nothing initially; the actual value will be set asynchronously
    return nothing;
  }

  /**
   * @param {Part} part
   * @param {[string, string, ...unknown[]]} props
   */
  update(part, [baseKey, textKey, ...args]) {
    this.baseKey = baseKey;
    this.textKey = textKey;
    this.args = args;

    this.loadAndSetValue(part);

    return nothing;
  }

  /**
   * @param {Part} part
   */
  async loadAndSetValue(part) {
    const host = getHostFromPart(part);

    if (!host) {
      console.warn('translator: Could not find host element from part');
      return;
    }

    let langCode = defaultLang;
    this.device = this.device
      ?? (function getDeviceContext() {
        try { return getContextValue(/** @type {HTMLElement} */(host), DeviceContextElement); }
        catch { return null; }
      })();
    this.i18n = this.i18n
      ?? (function getI18nContext() {
        try { return getContextValue(/** @type {HTMLElement} */(host), I18nContextElement); }
        catch { return null; }
      })();

    try {
      const [defaultTranslationPack, translationPack] = await Promise.all([
        getTranslationPack(defaultLang),
        getTranslationPack(langCode),
      ]);
      const base = translationPack?.[this.baseKey]
        ?? defaultTranslationPack?.[this.baseKey];

      if (!base) {
        console.warn(`translator: Missing base key '${this.baseKey}' in language pack`);
        this.setValue(`[${this.baseKey}.${this.textKey}]`);
        return;
      }

      const text = base?.[this.textKey]
        ?? defaultTranslationPack?.[this.baseKey]?.[this.textKey];

      if (typeof text !== 'string') {
        console.warn(`translator: Missing text key '${this.textKey}' in '${this.baseKey}'`);
        this.setValue(`[${this.baseKey}.${this.textKey}]`);
        return;
      }

      const interpolatedText = this.args.length > 0
        ? interpolateText(text, this.args, this.device, this.i18n)
        : text;

      this.setValue(interpolatedText);
    }
    catch (error) {
      console.error('translator: Failed to load translation', error);
      this.setValue(`[${this.baseKey}.${this.textKey}]`);
    }
  }

  disconnected() {
    // Clean up if needed
  }

  reconnected() {
    // Re-render when reconnected
    // Note: this.render will be called automatically by lit-html
  }
}

const translatorDirective = directive(TranslatorDirective);

/**
 * @template {keyof DefaultTranslationPack} BaseKey
 * @template {keyof DefaultTranslationPack[BaseKey]} TextKey
 * @param {BaseKey} baseKey
 * @param {TextKey} textKey
 * @param {...unknown} args
 * @returns {DirectiveResult<TranslatorDirective>}
 */
export function translator(baseKey, textKey, ...args) {
  return translatorDirective(baseKey, String(textKey), ...args);
}
