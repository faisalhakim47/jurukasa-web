#!/usr/bin/env node
// @ts-check

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { exit, stdout, stderr } from 'node:process';
import { fileURLToPath } from 'node:url';
import defaultLangPack from '../web/lang/en.js';

/**
 * @typedef {{ kind: 'resolved', baseKey: string } | { kind: 'missing', baseKey: string } | { kind: 'dynamic' }} BaseResolution
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoDir = join(__dirname, '..');
const webDir = join(__dirname, '../web');
const ignoredDirectories = new Set(['lang']);
const ignoredFileSuffixes = ['.spec.js', '.test.js'];
const translationCallPattern = /\bt\s*\(/g;
const stringLiteralPattern = /'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`/g;

stdout.on('error', handleOutputError);
stderr.on('error', handleOutputError);

main().catch(function handleFatalError(error) {
	stderr.write(`${formatError(error)}\n`);
	exit(1);
});

async function main() {
	const translationIndex = createTranslationIndex(defaultLangPack);
	const sourceFiles = await collectSourceFiles(webDir);
	const usage = await analyzeSourceFiles(sourceFiles, translationIndex);
	const unusedCodes = findUnusedCodes(translationIndex, usage.usedCodes);

	printSummary(sourceFiles.length, translationIndex.allCodes.size, usage.usedCodes.size, usage.dynamicCallSites.length);
	printMissingCodes(usage.missingCodes);
	printUnusedCodes(unusedCodes);
}

/**
 * @param {typeof defaultLangPack} langPack
 */
function createTranslationIndex(langPack) {
	/** @type {Map<string, Set<string>>} */
	const keysByBase = new Map();
	/** @type {Set<string>} */
	const allCodes = new Set();

	for (const [baseKey, translationGroup] of Object.entries(langPack)) {
		if (baseKey === 'literal') continue;

		const keys = new Set(Object.keys(translationGroup));
		keysByBase.set(baseKey, keys);

		for (const textKey of keys) {
			allCodes.add(toCode(baseKey, textKey));
		}
	}

	return { keysByBase, allCodes };
}

/**
 * @param {string} dirPath
 * @returns {Promise<string[]>}
 */
async function collectSourceFiles(dirPath) {
	/** @type {string[]} */
	const files = [];
	const entries = await readdir(dirPath, { withFileTypes: true });

	for (const entry of entries.toSorted(function compareByName(a, b) {
		return a.name.localeCompare(b.name);
	})) {
		const entryPath = join(dirPath, entry.name);

		if (entry.isDirectory()) {
			if (ignoredDirectories.has(entry.name)) continue;
			files.push(...await collectSourceFiles(entryPath));
			continue;
		}

		if (!entry.isFile()) continue;
		if (!entry.name.endsWith('.js')) continue;
		if (ignoredFileSuffixes.some(function isIgnoredSuffix(suffix) { return entry.name.endsWith(suffix); })) continue;

		files.push(entryPath);
	}

	return files;
}

/**
 * @param {string[]} sourceFiles
 * @param {{ keysByBase: Map<string, Set<string>>, allCodes: Set<string> }} translationIndex
 */
async function analyzeSourceFiles(sourceFiles, translationIndex) {
	/** @type {Set<string>} */
	const usedCodes = new Set();
	/** @type {Map<string, Set<string>>} */
	const missingCodes = new Map();
	/** @type {string[]} */
	const dynamicCallSites = [];

	for (const filePath of sourceFiles) {
		const source = await readFile(filePath, 'utf8');
		const sourceContext = buildSourceContext(source);

		for (const call of extractTranslationCalls(source)) {
			const location = formatLocation(filePath, source, call.startIndex);
			const args = splitTopLevelArguments(call.argumentSource);
			if (args.length < 2) continue;

			const baseResult = resolveBaseKey(args[0], translationIndex.keysByBase);
			if (baseResult.kind === 'missing') {
				const missingKeyCandidates = extractStringLiterals(args[1]).filter(looksLikeTranslationKey);
				for (const textKey of missingKeyCandidates) {
					addLocation(missingCodes, toCode(baseResult.baseKey, textKey), location);
				}
				continue;
			}
			if (baseResult.kind !== 'resolved') {
				dynamicCallSites.push(location);
				continue;
			}

			const definedKeys = translationIndex.keysByBase.get(baseResult.baseKey);
			if (!definedKeys) continue;

			const resolvedUsage = resolveTranslationKeys(args[1], sourceContext, definedKeys);
			for (const textKey of resolvedUsage.usedKeys) {
				usedCodes.add(toCode(baseResult.baseKey, textKey));
			}
			for (const textKey of resolvedUsage.missingKeys) {
				addLocation(missingCodes, toCode(baseResult.baseKey, textKey), location);
			}

			if (resolvedUsage.usedKeys.size === 0 && resolvedUsage.missingKeys.size === 0) {
				dynamicCallSites.push(location);
			}
		}
	}

	return { usedCodes, missingCodes, dynamicCallSites };
}

/**
 * @param {string} source
 */
function buildSourceContext(source) {
	/** @type {Map<string, string>} */
	const objectBodies = new Map();
	/** @type {Map<string, string>} */
	const functionBodies = new Map();

	const objectPattern = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g;
	for (const match of source.matchAll(objectPattern)) {
		const name = match[1];
		const braceIndex = match.index + match[0].lastIndexOf('{');
		const block = extractBalancedBlock(source, braceIndex, '{', '}');
		if (!block) continue;
		objectBodies.set(name, block.content);
	}

	const functionPattern = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;
	for (const match of source.matchAll(functionPattern)) {
		const name = match[1];
		const paramsStart = match.index + match[0].lastIndexOf('(');
		const paramsBlock = extractBalancedBlock(source, paramsStart, '(', ')');
		if (!paramsBlock) continue;

		let bodyStart = paramsBlock.endIndex + 1;
		while (bodyStart < source.length && /\s/.test(source[bodyStart])) bodyStart += 1;
		if (source[bodyStart] !== '{') continue;

		const bodyBlock = extractBalancedBlock(source, bodyStart, '{', '}');
		if (!bodyBlock) continue;
		functionBodies.set(name, bodyBlock.content);
	}

	return { objectBodies, functionBodies };
}

/**
 * @param {string} source
 */
function extractTranslationCalls(source) {
	/** @type {Array<{ argumentSource: string, startIndex: number }>} */
	const calls = [];

	for (const match of source.matchAll(translationCallPattern)) {
		const openParenIndex = match.index + match[0].lastIndexOf('(');
		const callBlock = extractBalancedBlock(source, openParenIndex, '(', ')');
		if (!callBlock) continue;
		calls.push({ argumentSource: callBlock.content, startIndex: match.index });
	}

	return calls;
}

/**
 * @param {string} expression
 * @param {{ objectBodies: Map<string, string>, functionBodies: Map<string, string> }} sourceContext
 * @param {Set<string>} definedKeys
 * @param {Set<string>} [visited]
 */
function resolveTranslationKeys(expression, sourceContext, definedKeys, visited = new Set()) {
	/** @type {Set<string>} */
	const usedKeys = new Set();
	/** @type {Set<string>} */
	const missingKeys = new Set();

	for (const value of extractStringLiterals(expression)) {
		if (!looksLikeTranslationKey(value)) continue;
		if (definedKeys.has(value)) usedKeys.add(value);
		else missingKeys.add(value);
	}

	for (const objectName of extractReferencedObjectNames(expression)) {
		const visitKey = `object:${objectName}`;
		if (visited.has(visitKey)) continue;
		visited.add(visitKey);

		const objectBody = sourceContext.objectBodies.get(objectName);
		if (!objectBody) continue;

		const resolvedObject = resolveTranslationKeys(objectBody, sourceContext, definedKeys, visited);
		mergeSets(usedKeys, resolvedObject.usedKeys);
		mergeSets(missingKeys, resolvedObject.missingKeys);
	}

	for (const functionName of extractReferencedFunctionNames(expression)) {
		const visitKey = `function:${functionName}`;
		if (visited.has(visitKey)) continue;
		visited.add(visitKey);

		const functionBody = sourceContext.functionBodies.get(functionName);
		if (!functionBody) continue;

		const resolvedFunction = resolveTranslationKeys(functionBody, sourceContext, definedKeys, visited);
		mergeSets(usedKeys, resolvedFunction.usedKeys);
		mergeSets(missingKeys, resolvedFunction.missingKeys);
	}

	return { usedKeys, missingKeys };
}

/**
 * @param {string} expression
 * @param {Map<string, Set<string>>} keysByBase
 * @returns {BaseResolution}
 */
function resolveBaseKey(expression, keysByBase) {
	const literalBaseKeys = extractStringLiterals(expression).filter(function isKnownBaseKey(value) {
		return keysByBase.has(value);
	});

	if (literalBaseKeys.length === 1) {
		return { kind: 'resolved', baseKey: literalBaseKeys[0] };
	}

	if (literalBaseKeys.length > 1) {
		return { kind: 'dynamic' };
	}

	const unknownLiteralBaseKeys = extractStringLiterals(expression).filter(looksLikeTranslationKey);
	if (unknownLiteralBaseKeys.length === 1) {
		return { kind: 'missing', baseKey: unknownLiteralBaseKeys[0] };
	}

	return { kind: 'dynamic' };
}

/**
 * @param {{ keysByBase: Map<string, Set<string>>, allCodes: Set<string> }} translationIndex
 * @param {Set<string>} usedCodes
 */
function findUnusedCodes(translationIndex, usedCodes) {
	return [...translationIndex.allCodes].filter(function isUnused(code) {
		return !usedCodes.has(code);
	}).toSorted();
}

/**
 * @param {number} fileCount
 * @param {number} definedCodeCount
 * @param {number} usedCodeCount
 * @param {number} dynamicCallSiteCount
 */
function printSummary(fileCount, definedCodeCount, usedCodeCount, dynamicCallSiteCount) {
	stdout.write(`Scanned ${fileCount} source files.\n`);
	stdout.write(`Resolved ${usedCodeCount} used translation codes out of ${definedCodeCount} defined default-language codes.\n`);
	stdout.write(`Skipped ${dynamicCallSiteCount} dynamic call sites that could not be resolved statically.\n\n`);
}

/**
 * @param {Map<string, Set<string>>} missingCodes
 */
function printMissingCodes(missingCodes) {
	const entries = [...missingCodes.entries()].toSorted(function compareMissingCodes(a, b) {
		return a[0].localeCompare(b[0]);
	});

	if (entries.length === 0) {
		stdout.write('Missing translation codes: none\n\n');
		return;
	}

	stdout.write('Missing translation codes:\n');
	for (const [code, locations] of entries) {
		stdout.write(`- ${code}\n`);
		for (const location of [...locations].toSorted()) {
			stdout.write(`  ${location}\n`);
		}
	}
	stdout.write('\n');
}

/**
 * @param {string[]} unusedCodes
 */
function printUnusedCodes(unusedCodes) {
	if (unusedCodes.length === 0) {
		stdout.write('Unused translation codes: none\n');
		return;
	}

	stdout.write('Unused translation codes:\n');
	for (const code of unusedCodes) {
		stdout.write(`- ${code}\n`);
	}
}

/**
 * @param {string} source
 * @param {number} startIndex
 * @param {string} openChar
 * @param {string} closeChar
 */
function extractBalancedBlock(source, startIndex, openChar, closeChar) {
	if (source[startIndex] !== openChar) return null;

	let depth = 0;
	let quote = null;
	let isEscaped = false;

	for (let index = startIndex; index < source.length; index += 1) {
		const char = source[index];

		if (quote !== null) {
			if (isEscaped) {
				isEscaped = false;
				continue;
			}
			if (char === '\\') {
				isEscaped = true;
				continue;
			}
			if (char === quote) {
				quote = null;
			}
			continue;
		}

		if (char === '\'' || char === '"' || char === '`') {
			quote = char;
			continue;
		}
		if (char === openChar) {
			depth += 1;
			continue;
		}
		if (char === closeChar) {
			depth -= 1;
			if (depth === 0) {
				return {
					content: source.slice(startIndex + 1, index),
					endIndex: index,
				};
			}
		}
	}

	return null;
}

/**
 * @param {string} argumentSource
 */
function splitTopLevelArguments(argumentSource) {
	/** @type {string[]} */
	const args = [];
	let startIndex = 0;
	let parenDepth = 0;
	let bracketDepth = 0;
	let braceDepth = 0;
	let quote = null;
	let isEscaped = false;

	for (let index = 0; index < argumentSource.length; index += 1) {
		const char = argumentSource[index];

		if (quote !== null) {
			if (isEscaped) {
				isEscaped = false;
				continue;
			}
			if (char === '\\') {
				isEscaped = true;
				continue;
			}
			if (char === quote) quote = null;
			continue;
		}

		if (char === '\'' || char === '"' || char === '`') {
			quote = char;
			continue;
		}
		if (char === '(') {
			parenDepth += 1;
			continue;
		}
		if (char === ')') {
			parenDepth -= 1;
			continue;
		}
		if (char === '[') {
			bracketDepth += 1;
			continue;
		}
		if (char === ']') {
			bracketDepth -= 1;
			continue;
		}
		if (char === '{') {
			braceDepth += 1;
			continue;
		}
		if (char === '}') {
			braceDepth -= 1;
			continue;
		}

		if (char === ',' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
			args.push(argumentSource.slice(startIndex, index).trim());
			startIndex = index + 1;
		}
	}

	const lastArg = argumentSource.slice(startIndex).trim();
	if (lastArg) args.push(lastArg);
	return args;
}

/**
 * @param {string} source
 */
function extractStringLiterals(source) {
	return [...source.matchAll(stringLiteralPattern)].map(function toLiteralValue(match) {
		return decodeSimpleEscapes(match[1] ?? match[2] ?? match[3] ?? '');
	});
}

/**
 * @param {string} expression
 */
function extractReferencedObjectNames(expression) {
	const matches = expression.matchAll(/\b([A-Za-z_$][\w$]*)\s*\[/g);
	return new Set([...matches].map(function toObjectName(match) { return match[1]; }));
}

/**
 * @param {string} expression
 */
function extractReferencedFunctionNames(expression) {
	const functionNames = new Set();
	const matches = expression.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g);

	for (const match of matches) {
		const name = match[1];
		if (name === 't') continue;
		functionNames.add(name);
	}

	return functionNames;
}

/**
 * @param {Map<string, Set<string>>} target
 * @param {string} code
 * @param {string} location
 */
function addLocation(target, code, location) {
	if (!target.has(code)) target.set(code, new Set());
	target.get(code)?.add(location);
}

/**
 * @param {Set<string>} target
 * @param {Set<string>} source
 */
function mergeSets(target, source) {
	for (const value of source) {
		target.add(value);
	}
}

/**
 * @param {string} filePath
 * @param {string} source
 * @param {number} index
 */
function formatLocation(filePath, source, index) {
	const relativePath = relative(repoDir, filePath);
	const line = source.slice(0, index).split('\n').length;
	return `${relativePath}:${line}`;
}

/**
 * @param {string} value
 */
function looksLikeTranslationKey(value) {
	return /^[a-z][A-Za-z0-9]*$/.test(value) && /[A-Z]/.test(value);
}

/**
 * @param {string} baseKey
 * @param {string} textKey
 */
function toCode(baseKey, textKey) {
	return `${baseKey}.${textKey}`;
}

/**
 * @param {string} value
 */
function decodeSimpleEscapes(value) {
	return value
		.replace(/\\'/g, "'")
		.replace(/\\"/g, '"')
		.replace(/\\`/g, '`')
		.replace(/\\\\/g, '\\');
}

/**
 * @param {unknown} error
 */
function formatError(error) {
	if (error instanceof Error) return error.stack || error.message;
	return String(error);
}

/**
 * @param {NodeJS.ErrnoException} error
 */
function handleOutputError(error) {
	if (error.code === 'EPIPE') {
		exit(0);
	}
	throw error;
}
