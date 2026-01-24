#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const appDir = resolve(join(__dirname, '../'));

/** @param {string} dir */
async function *includeFiles(dir) {
  const files = await readdir(dir, { recursive: true, withFileTypes: true });
  for (const file of files) {
    if (file.isFile()) yield `${file.parentPath.replace(`${appDir}/`, '')}/${file.name}`;
  }
}

/** @type {Array<string>} */
const includedFiles = [];

fileLoop:
for await (const file of includeFiles(join(__dirname, '../web'))) {
  if (file.endsWith('.md')) continue fileLoop;
  if (file.endsWith('.spec.js')) continue fileLoop;
  if (file.endsWith('.test.js')) continue fileLoop;
  includedFiles.push(file);
}
includedFiles.push('index.html');
includedFiles.push('manifest.json');
includedFiles.push('sw.js');

includedFiles.push('README.md');
includedFiles.push('LICENSE');

const packageJson = JSON.parse(await readFile(join(__dirname, '../package.json'), { encoding: 'utf-8' }));
packageJson['files'] = includedFiles;

await writeFile(join(__dirname, '../package.json'), JSON.stringify(packageJson, null, 2), { encoding: 'utf-8' });
