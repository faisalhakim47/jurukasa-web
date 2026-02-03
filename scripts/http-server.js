#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';
/** @import { ServerResponse } from 'node:http' */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const webRoot = join(__dirname, '../');
const workspaceUuid = randomUUID();

const [executable, script, ...args] = argv;
const [appIndex = 'index.html'] = args;

console.info(`Using appIndex: ${appIndex}`);

/** @type {Record<string, string>} */
const mimeType = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.wasm': 'application/wasm',
};

/** @param {string} filePath */
function getContentType(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  const mime = mimeType[ext] || 'application/octet-stream';
  return mime === 'text/html' ? 'text/html; charset=utf-8' : mime;
};

function getDefaultHeaders() {
  return {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  };
}

/** @param {ServerResponse} response */
function responseNotFound(response) {
  response.writeHead(404, { 'Content-Type': 'text/plain' });
  response.end('Not Found');
}

const server = createServer(async function requestHandler(request, response) {
  const url = new URL(request.url || '/', 'http://localhost:8000');
  const pathname = url.pathname;
  const file = !pathname.includes('.') ? appIndex : pathname;
  const filePath = join(webRoot, file);
  try {
    if (pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
      response.writeHead(200, {
        'Content-Type': 'application/json',
        ...getDefaultHeaders(),
      });
      response.write(JSON.stringify({
        workspace: {
          root: join(webRoot),
          uuid: workspaceUuid,
        },
      }));
      response.end();
      return;
    }
    const stats = await stat(filePath);
    if (stats.isFile()) {
      response.writeHead(200, {
        'Content-Type': getContentType(filePath),
        ...getDefaultHeaders(),
      });
      const stream = createReadStream(filePath);
      stream.pipe(response);
      stream.on('error', function onStreamError() {
        responseNotFound(response);
      });
    }
    else {
      const isPossibleFile = pathname.includes('.');
      if (isPossibleFile) responseNotFound(response);
      else {
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          ...getDefaultHeaders(),
        });
        const stream = createReadStream(join(webRoot, appIndex));
        stream.pipe(response);
        stream.on('error', function onStreamError() {
          responseNotFound(response);
        });
      }
    }
  }
  catch (error) {
    responseNotFound(response);
  }
});

server.listen(8000, '0.0.0.0', function onListening() {
  console.log('HTTP server listening on http://0.0.0.0:8000');
});
