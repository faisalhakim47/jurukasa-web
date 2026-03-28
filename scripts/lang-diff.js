#!/usr/bin/env node
// @ts-check

import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { argv, exit, stdout, stderr } from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const [executable, script, ...args] = argv;
const [lang] = args;

if (!lang) {
  stderr.write('Please provide a language code as an argument.\n');
  stderr.write('Usage: node lang-diff.js <language-code>\n');
  stderr.write('Available language codes:\n');
  const langCodes = await getAvailableLangCodes();
  for (const langCode of langCodes) stderr.write(`- ${langCode}\n`);
  exit(1);
}

try {
  const [defaultLangPack, langPack] = await Promise.all([
    loadLangPack('en'),
    loadLangPack(lang),
  ]);

  const discrepancies = compareLangPacks(defaultLangPack, langPack);

  for (const discrepancy of discrepancies) {
    stdout.write(`${discrepancy}\n`);
  }
}
catch (error) {
  if (error instanceof Error) stderr.write(`${error.message}\n`);
  else stderr.write('Unknown error occurred while diffing language packs.\n');

  stderr.write('Available language codes:\n');
  const langCodes = await getAvailableLangCodes();
  for (const langCode of langCodes) stderr.write(`- ${langCode}\n`);
  exit(1);
}

/**
 * @param {string} languageCode
 */
async function loadLangPack(languageCode) {
  const moduleUrl = new URL(`../web/lang/${languageCode}.js`, import.meta.url);

  try {
    const langModule = await import(moduleUrl.href);
    return langModule.default;
  }
  catch {
    throw new Error(`Unknown language code: ${languageCode}`);
  }
}

async function getAvailableLangCodes() {
  const files = await readdir(join(__dirname, '../web/lang'));

  return files
    .filter(function isLangEntrypoint(file) {
      return file.endsWith('.js');
    })
    .map(function toLangCode(file) {
      return file.replace('.js', '');
    })
    .filter(function excludeDefaultLang(languageCode) {
      return languageCode !== 'en';
    })
    .sort();
}

/**
 * @param {Record<string, unknown>} defaultLangPack
 * @param {Record<string, unknown>} langPack
 */
function compareLangPacks(defaultLangPack, langPack) {
  /** @type {Array<string>} */
  const discrepancies = [];

  compareLangObjects(defaultLangPack, langPack, '', discrepancies);

  return discrepancies;
}

/**
 * @param {Record<string, unknown>} defaultObject
 * @param {Record<string, unknown>} langObject
 * @param {string} parentPath
 * @param {Array<string>} discrepancies
 */
function compareLangObjects(defaultObject, langObject, parentPath, discrepancies) {
  const defaultKeys = Object.keys(defaultObject).sort();
  const langKeys = Object.keys(langObject).sort();

  for (const key of defaultKeys) {
    const path = parentPath ? `${parentPath}.${key}` : key;

    if (!(key in langObject)) {
      discrepancies.push(`- ${path}`);
      continue;
    }

    const defaultValue = defaultObject[key];
    const langValue = langObject[key];
    const defaultIsObject = isRecord(defaultValue);
    const langIsObject = isRecord(langValue);

    if (defaultIsObject && langIsObject) {
      compareLangObjects(defaultValue, langValue, path, discrepancies);
      continue;
    }

    if (defaultIsObject !== langIsObject) {
      discrepancies.push(`- ${path}`);
      discrepancies.push(`+ ${path}`);
    }
  }

  for (const key of langKeys) {
    if (key in defaultObject) continue;

    const path = parentPath ? `${parentPath}.${key}` : key;
    discrepancies.push(`+ ${path}`);
  }
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value);
}
