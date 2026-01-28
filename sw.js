const sw = /** @type {ServiceWorkerGlobalScope} */ (
  /** @type {any} mandatory 'any' workaround */
  (self)
);

/** @return {Promise<IDBDatabase>} */
async function idbConnect() {
  return new Promise(function databasePromise(resolve, reject) {
    const idbOpenRequest = sw.indexedDB.open('jurukasa-web:sw', 1);
    /** @param {Event} event */
    function idbMigration(event) {
      const idb = 'result' in event.target ? event.target.result : undefined;
      if (idb instanceof IDBDatabase) {
        idb.createObjectStore('sw:config', { keyPath: 'name' });
      }
      else rejectWithError(new Error(`Failed to migrate IndexedDB: Expect IDBDatabase, got ${idb?.constructor.name} instead.`));
    }
    /** @param {Event} event */
    function idbOpened(event) {
      const idb = 'result' in event.target ? event.target.result : undefined;
      if (idb instanceof IDBDatabase) resolve(idb);
      else rejectWithError(new Error(`Failed to open IndexedDB: Expect IDBDatabase, got ${idb?.constructor.name} instead.`));
    }
    /** @param {Event} event */
    function idbOpenError(event) {
      rejectWithError(new Error('Failed to open IndexedDB', { cause: event }));
    }
    /** @param {Error} error */
    function rejectWithError(error) {
      idbOpenRequest.removeEventListener('upgradeneeded', idbMigration);
      idbOpenRequest.removeEventListener('success', idbOpened);
      idbOpenRequest.removeEventListener('error', idbOpenError);
      reject(error);
    }
    idbOpenRequest.addEventListener('upgradeneeded', idbMigration);
    idbOpenRequest.addEventListener('success', idbOpened);
    idbOpenRequest.addEventListener('error', idbOpenError);
  });
}

/**
 * @param {IDBDatabase} idb
 * @param {Array<string>} storeNames
 * @param {function(IDBTransaction):void} writer
 */
async function idbWrite(idb, storeNames, writer) {
  return new Promise(function transactionPromise(resolve, reject) {
    const transaction = idb.transaction(storeNames, 'readwrite', { durability: 'strict' });
    transaction.addEventListener('complete', function transactionCompleted() {
      resolve();
    });
    transaction.addEventListener('abort', function transactionAborted(event) {
      reject(new Error('Transaction aborted', { cause: event }));
    });
    transaction.addEventListener('error', function transactionError(event) {
      reject(new Error('Transaction error', { cause: event }));
    });
    writer(transaction);
    transaction.commit();
  });
}

/**
 * @template T
 * @param {IDBDatabase} idb
 * @param {Array<string>} storeNames
 * @param {function(IDBTransaction):T|Promise<T>} reader
 * @returns {Promise<T>}
 */
async function idbRead(idb, storeNames, reader) {
  return new Promise(function transactionPromise(resolve, reject) {
    const transaction = idb.transaction(storeNames, 'readonly', { durability: 'strict' });
    let result;
    transaction.addEventListener('complete', function transactionCompleted() {
      if (result instanceof Promise) result.then(resolve);
      else resolve(result);
    });
    transaction.addEventListener('abort', function transactionAborted(event) {
      reject(new Error('Read transaction aborted', { cause: event }));
    });
    transaction.addEventListener('error', function transactionError(event) {
      reject(new Error('Read transaction error', { cause: event }));
    });
    result = reader(transaction);
    transaction.commit();
  });
}

/**
 * @param {IDBObjectStore} objectStore
 * @param {IDBValidKey | IDBKeyRange} query
 * @returns {Promise<unknown>}
 */
async function idbGet(objectStore, query) {
  const objectRequest = objectStore.get(query);
  return new Promise(function getPromise(resolve, reject) {
    objectRequest.addEventListener('success', function getSuccess(event) {
      if ('result' in event.target) resolve(event.target.result);
      else throw reject(new Error('IndexedDB get result not found', { cause: event }));
    });
    objectRequest.addEventListener('error', function getError(event) {
      reject(new Error('IndexedDB get error', { cause: event }));
    });
  });
}

/**
 * @param {IDBObjectStore} objectStore
 * @returns {Promise<Array<unknown>>}
 */
async function idbGetAll(objectStore) {
  const objectRequest = objectStore.getAll();
  return new Promise(function getAllPromise(resolve, reject) {
    objectRequest.addEventListener('success', function getAllSuccess(event) {
      if ('result' in event.target) resolve(/** @type {Array<unknown>} */(event.target.result));
      else throw reject(new Error('IndexedDB getAll result not found', { cause: event }));
    });
    objectRequest.addEventListener('error', function getAllError(event) {
      reject(new Error('IndexedDB getAll error', { cause: event }));
    });
  });
}

/**
 * this promised app directory function must not throw error
 */
async function getAppConfig() {
  try {
    const idb = await idbConnect();
    const appConfig = await idbRead(idb, ['sw:config'], async function (transaction) {
      const configStore = transaction.objectStore('sw:config');
      const [appDirConfig, appIndexConfig] = await Promise.all([
        idbGet(configStore, 'appDir'),
        idbGet(configStore, 'appIndex'),
      ]);
      /** @param {unknown} config */
      function getValue(config) {
        return true
          && (typeof config === 'object' && config !== null)
          && ('value' in config && typeof config.value === 'string')
          ? config.value : null;
      }
      return {
        appDir: getValue(appDirConfig),
        appIndex: getValue(appIndexConfig),
      };
    });
    // console.debug('getAppConfig', 'result', appConfig);
    return appConfig;
  }
  catch (error) {
    // console.debug('sw', 'getAppDir', error);
    return { appDir: null, appIndex: null };
  }
}

let promisedAppConfig = getAppConfig();

/**
 * @param {ExtendableMessageEvent} event
 * @param {object} payload
 */
function responseMessage(event, payload) {
  console.debug('sw', 'responseMessage', event.data?.messageId, payload);
  if (Date.now() <= event.data.deadline) event.source.postMessage({
    ...payload,
    messageId: event.data.messageId,
  });
}

/** @param {InBoundMessage} data */
function checkDeadline(data) {
  if (Date.now() > data.deadline) {
    throw new Error(`ServiceWorker message timeout [${data.messageId}]:`);
  }
}

/**
 * We do some hotfix for sqlite3-opfs-async-proxy module which improperly configured or improperly transpiled es module.
 * - the caller does not set type to module
 * - the sqlite3-opfs-async-proxy use `export {};`
 * Our solution is to remove the `export {};`
 * 
 * I hope sqlite wasm can do better. Really, it was mess integrating with them.
 * 
 * @param {string} url
 * @returns {Promise<Response>}
 */
async function hotfixSqlite3OpfsAsyncProxy(url) {
  const response = await fetch(url);
  const body = await response.text();
  const fixedBody = body.replace('export {};', '');
  const fixedResponse = new Response(fixedBody, response);
  // console.debug('hotfixSqlite3OpfsAsyncProxy', await fixedResponse.clone().text());
  return fixedResponse;
}

/**
 * For consistency our structure list all resources from package.json, including the html files.
 * For this reason, the html is included in caching process. But, the cache is come from some CDN.
 * Most CDN would forbid to serve HTML by invalidating Content-Type header. We need to fix this.
 * 
 * @param {string} url
 */
async function fixCDNToServeHTML(url) {
  if (url.endsWith('.html')) {
    const response = await fetch(url);
    return new Response(response.body, {
      status: 200,
      headers: {
        ...Array.from(response.headers.entries())
          .reduce(function compileHeaders(headers, [key, value]) {
            headers[key] = value;
            return headers;
          }, {}),
        'Content-Type': 'text/html; charset=utf-8',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    });
  }
  else return await fetch(url);
}

/**
 * @param {Cache} cache
 * @param {Array<string>} urls
 */
async function addImmutableCacheUrls(cache, urls) {
  await Promise.all(urls.map(async function addImmutableCacheUrl(url) {
    const response = await cache.match(url);
    if (response instanceof Response) {
      // console.debug('sw', 'cache', 'immutable', url);
      /** no-op */
    }
    else {
      // console.debug('sw', 'cache', 'add', url);
      if (url.endsWith('dist/sqlite3-opfs-async-proxy.js')) {
        await cache.put(url, await hotfixSqlite3OpfsAsyncProxy(url));
      }
      else if (url.endsWith('.html')) {
        // console.debug('sw', 'cache', 'add', 'html', url);
        await cache.put(url, await fixCDNToServeHTML(url));
      }
      else await cache.add(url).catch(function logCacheAddError(error) {
        // console.debug('sw', 'cache', 'add', 'error', url, error.message);
        throw error;
      });
    }
  }));
}

sw.addEventListener('install', function handleInstall(event) {
  event.waitUntil((async function skipInstallation() {
    await sw.skipWaiting();
  })());
});

sw.addEventListener('activate', function handleActivate() {
  /**
   * Our service worker registration strategy is all or nothing.
   * Either a page is controlled by service worker or not at all. No in-between.
   * The service worker does not claims any pages on activation.
   */
});

sw.addEventListener('fetch', function handleFetch(event) {
  event.respondWith((async function theCachingStrategy() {
    const { appDir, appIndex } = await promisedAppConfig;
    // console.debug('sw', 'theCachingStrategy', event.request.url);
    if (typeof appDir === 'string') {
      const cache = await caches.open(`jurukasa-web:${appDir}`);
      const response = await cache.match(event.request);
      if (response instanceof Response) {
        // console.debug('sw', 'cache', 'hit', event.request.url);
        return response;
      }
      else {
        const url = new URL(event.request.url);
        if (url.origin === self.location.origin) {
          /** we enforce that all assets files must have file extension and app routes must not have file extension */
          if (url.pathname.includes('.')) {
            // console.debug('sw', 'cache', 'miss', 'assets', url.pathname);
            return await fetch(event.request);
          }
          else {
            // console.debug('sw', 'cache', 'miss', 'index', appDir, appIndex);
            const appIndexUrl = `${appDir}/${appIndex}`;
            const cachedIndexResponse = await cache.match(appIndexUrl);
            if (cachedIndexResponse instanceof Response) console.debug('sw', 'cache', 'hit', 'index', appIndexUrl);
            else console.debug('sw', 'cache', 'miss', 'index', appIndexUrl);
            const indexResponse = cachedIndexResponse instanceof Response
              ? cachedIndexResponse
              : await fetch(appIndexUrl).catch(function logFetchError(error) {
                // console.debug('sw', 'fetch', 'error', appIndexUrl, error.message);
                throw error;
              });
            // console.debug('sw', 'cache', 'miss', 'index', 'loaded', appIndexUrl);
            const fixedIndexResponse = new Response(indexResponse.body, {
              status: 200,
              headers: {
                ...Array.from(indexResponse.headers.entries())
                  .reduce(function compileHeaders(headers, [key, value]) {
                    headers[key] = value;
                    return headers;
                  }, {}),
                'Content-Type': 'text/html; charset=utf-8',
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Embedder-Policy': 'require-corp',
              },
            });
            return fixedIndexResponse;
          }
        }
        /** this could be: unmanaged request or sqlite api request */
        else {
          // console.debug('sw', 'cache', 'miss', 'assets', event.request.url);
          if (event.request.url.endsWith('dist/sqlite3-opfs-async-proxy.js')) {
            return await hotfixSqlite3OpfsAsyncProxy(event.request.url);
          }
          else if (event.request.url.endsWith('.html')) {
            return await fixCDNToServeHTML(event.request.url);
          }
          else return await fetch(event.request);
        }
      }
    }
    else {
      // console.debug('sw', 'non-cache', event.request.url);
      return await fetch(event.request);
    }
  })());
});

/**
 * @typedef {object} InBoundMessage
 * @property {number} messageId
 * @property {number} deadline
 */

sw.addEventListener('message', async function serviceWorkerInBound(event) {
  // console.debug('sw', 'message', event.data);

  /** @type {InBoundMessage} */
  const data = event.data;

  try {
    if (
      true
      && (typeof data === 'object' && data !== null)
      && ('messageId' in data && typeof data.messageId === 'number')
      && ('deadline' in data && typeof data.deadline === 'number')
    ) {
      checkDeadline(data);
      if (
        true
        && ('command' in data && data.command === 'init-cache')
        && ('appDir' in data && typeof data.appDir === 'string')
        && ('additionalFiles' in data && Array.isArray(data.additionalFiles))
        && ('materialSymbolsProviderUrl' in data && typeof data.materialSymbolsProviderUrl === 'string')
      ) {
        const appDir = data.appDir.endsWith('/') ? data.appDir.slice(0, -1) : data.appDir;
        // console.debug('sw', 'init-cache', `${appDir}/package.json`);
        const [packageJson, materialSymbolsListResp] = await Promise.all([
          fetch(`${appDir}/package.json`),
          fetch(`${appDir}/web/material-symbols-list.txt`),
        ]);
        const packageData = /** @type {unknown} */ (await packageJson.json());
        const materialSymbolsNames = (await materialSymbolsListResp.text())
          .split('\n')
          .map(function trimmedLine(line) { return line.trim(); })
          .filter(function nonEmptyLine(line) { return line.length !== 0; });
        checkDeadline(data);
        const materialSymbolsFiles = [
          ...materialSymbolsNames.map(function outlinedSymbols(name) {
            return String(data.materialSymbolsProviderUrl).replace('{NAME}', name).replace('{FILL}', '');
          }),
          ...materialSymbolsNames.map(function filledSymbols(name) {
            return String(data.materialSymbolsProviderUrl).replace('{NAME}', name).replace('{FILL}', '-fill');
          }),
        ].map(function defaultStyle(url) {
          return url.replace('{WEIGHT}', '400').replace('{STYLE}', 'rounded');
        });
        if (
          true
          && (typeof packageData === 'object' && packageData !== null)
          && ('files' in packageData && Array.isArray(packageData.files))
        ) {
          const files = [
            ...data.additionalFiles,
            ...packageData.files,
            ...materialSymbolsFiles,
          ].map(function clearPrefix(file) {
            return file.startsWith('/') ? file.slice(1) : file;
          });
          const cache = await caches.open(`jurukasa-web:${appDir}`);
          await addImmutableCacheUrls(cache, files.map(function fileToUrl(file) {
            return file.startsWith('http') ? file : `${appDir}/${file}`;
          }));
          responseMessage(event, true);
        }
        else throw new Error('Invalid package.json structure');
      }
      else if (
        true
        && ('command' in data && data.command === 'set-cache')
        && ('appDir' in data && typeof data.appDir === 'string')
        && ('appIndex' in data && typeof data.appIndex === 'string')
      ) {
        const appDir = data.appDir.endsWith('/') ? data.appDir.slice(0, -1) : data.appDir;
        const appIndex = data.appIndex.startsWith('/') ? data.appIndex.slice(1) : data.appIndex;
        const idb = await idbConnect();
        checkDeadline(data);
        await idbWrite(idb, ['sw:config'], function transactionHandler(transaction) {
          const configStore = transaction.objectStore('sw:config');
          configStore.put({ name: 'appDir', value: appDir });
          configStore.put({ name: 'appIndex', value: appIndex });
        });
        promisedAppConfig = getAppConfig();
        responseMessage(event, true);
      }
      else if (
        true
        && ('command' in data && data.command === 'hotfix-sqlite3-opfs-async-proxy')
      ) {
        await sw.clients.claim();
        responseMessage(event, true);
      }
      else if (
        true
        && ('command' in data && data.command === 'get-app-versions')
      ) {
        const idb = await idbConnect();
        checkDeadline(data);
        const appVersions = await idbRead(idb, ['sw:config'], async function (transaction) {
          const configStore = transaction.objectStore('sw:config');
          const allConfigs = await idbGetAll(configStore);
          return allConfigs;
        });
        responseMessage(event, { appVersions });
      }
      else throw new Error('Unhandled message payload');
    }
    else throw new Error('Invalid message payload');
  }
  catch (error) {
    // console.debug('sw', 'message', error);
    responseMessage(event, {
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
      data,
    });
  }
});
