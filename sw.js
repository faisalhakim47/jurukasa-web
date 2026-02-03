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
 * this promised app directory function must not throw error
 */
async function getAppConfig() {
  try {
    const idb = await idbConnect();
    const appConfig = await idbRead(idb, ['sw:config'], async function (transaction) {
      const configStore = transaction.objectStore('sw:config');
      const [appPrefixConfig, appIndexConfig] = await Promise.all([
        idbGet(configStore, 'appPrefix'),
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
        appPrefix: getValue(appPrefixConfig),
        appIndex: getValue(appIndexConfig),
      };
    });
    console.debug('sw', 'getAppConfig', 'result', appConfig);
    return appConfig;
  }
  catch (error) {
    console.debug('sw', 'getAppDir', error);
    return { appPrefix: null, appIndex: null };
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
  console.debug('sw', 'hotfixSqlite3OpfsAsyncProxy', (await fixedResponse.clone().text()).includes('export {};'));
  return fixedResponse;
}

/**
 * @param {Headers} headers
 * @returns {void}
 */
function applyCoopCoepHeaders(headers) {
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
}

/**
 * @param {Cache} cache
 * @param {Array<string>} urls
 */
async function addImmutableCacheUrls(cache, urls) {
  await Promise.all(urls.map(async function addImmutableCacheUrl(url) {
    const response = await cache.match(url);
    if (response instanceof Response) { console.debug('sw', 'cache', 'immutable', url); }
    else {
      if (false) { /** no-op */ }
      else if (url.endsWith('dist/sqlite3-opfs-async-proxy.js')) await cache.put(url, await hotfixSqlite3OpfsAsyncProxy(url));
      else await cache.add(url).catch(function logCacheAddError(error) {
        console.warn('sw', 'cache', 'add', 'error', url, error.message);
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
  event.respondWith((async function TheCachingStrategy() {
    console.debug('sw', 'TheCachingStrategy', event.request.url);

    const url = new URL(event.request.url);
    const { appPrefix, appIndex } = await promisedAppConfig;

    const cache = typeof appPrefix === 'string'
      ? await caches.open(`jurukasa-web:${appPrefix}`)
      : undefined;
    const cachedResponse = await cache?.match(event.request);

    const isAppIndex = url.origin === self.location.origin && !url.pathname.includes('.');

    let response = /** @type {Response} */ (undefined);
    if (cachedResponse instanceof Response) response = cachedResponse;
    /** We enforce that all assets files must have file extension and app routes must not have file extension. All other path should be handled as html */
    else if (isAppIndex) {
      const appIndexUrl = `${appPrefix}/${appIndex}`;
      const cachedIndexResponse = await cache?.match(appIndexUrl);
      response = cachedIndexResponse instanceof Response
        ? cachedIndexResponse
        : await fetch(appIndexUrl).catch(function logFetchError(error) {
          console.error('sw', 'fetch', 'error', appIndexUrl, error.message);
          throw error;
        });
    }
    else response = await fetch(event.request);

    const headers = new Headers(response.headers);
    if (isAppIndex || url.pathname.endsWith('.html')) headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');

    return new Response(response.body, {
      ...response,
      headers,
    });
  })());
});

/**
 * @typedef {object} InBoundMessage
 * @property {number} messageId
 * @property {number} deadline
 */

/**
 * @typedef {object} AppVersion
 * @property {string} prefix
 * @property {string} version
 * @property {Array<string>} sources
 */

sw.addEventListener('message', async function serviceWorkerInBound(event) {
  console.debug('sw', 'message', event.data?.messageId);

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
        && ('appPrefix' in data && typeof data.appPrefix === 'string')
        && ('additionalFiles' in data && Array.isArray(data.additionalFiles))
        && ('materialSymbolsProviderUrl' in data && typeof data.materialSymbolsProviderUrl === 'string')
      ) {
        const appPrefix = data.appPrefix.endsWith('/') ? data.appPrefix.slice(0, -1) : data.appPrefix;
        console.debug('sw', 'init-cache', `${appPrefix}/package.json`);
        const packageJsonUrl = `${appPrefix}/package.json`;
        const [packageJsonResp, materialSymbolsListResp] = await Promise.all([
          fetch(packageJsonUrl),
          fetch(`${appPrefix}/web/material-symbols-list.txt`),
        ]);
        const packageData = /** @type {unknown} */ (await packageJsonResp.clone().json());
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
          const cache = await caches.open(`jurukasa-web:${appPrefix}`);
          // Cache package.json first
          await cache.put(packageJsonUrl, packageJsonResp);
          await addImmutableCacheUrls(cache, files.map(function fileToUrl(file) {
            return file.startsWith('http') ? file : `${appPrefix}/${file}`;
          }));
          responseMessage(event, true);
        }
        else throw new Error('Invalid package.json structure');
      }
      else if (
        true
        && ('command' in data && data.command === 'set-cache')
        && ('appPrefix' in data && typeof data.appPrefix === 'string')
        && ('appIndex' in data && typeof data.appIndex === 'string')
      ) {
        const appPrefix = data.appPrefix.endsWith('/') ? data.appPrefix.slice(0, -1) : data.appPrefix;
        const appIndex = data.appIndex.startsWith('/') ? data.appIndex.slice(1) : data.appIndex;
        const idb = await idbConnect();
        checkDeadline(data);
        await idbWrite(idb, ['sw:config'], function transactionHandler(transaction) {
          const configStore = transaction.objectStore('sw:config');
          configStore.put({ name: 'appPrefix', value: appPrefix });
          configStore.put({ name: 'appIndex', value: appIndex });
        });
        promisedAppConfig = getAppConfig();
        console.debug('sw', 'set-cache', await promisedAppConfig);
        responseMessage(event, true);
      }
      else if (
        true
        && ('command' in data && data.command === 'set-active-appPrefix')
        && ('appPrefix' in data && typeof data.appPrefix === 'string')
        && ('appIndex' in data && typeof data.appIndex === 'string')
        && ('sources' in data && Array.isArray(data.sources))
      ) {
        const appPrefix = data.appPrefix.endsWith('/') ? data.appPrefix.slice(0, -1) : data.appPrefix;
        const appIndex = data.appIndex.startsWith('/') ? data.appIndex.slice(1) : data.appIndex;

        // If the version is from npm and not yet cached, we need to download it first
        const isNpmSource = data.sources.includes('npm');
        const isLocalSource = data.sources.includes('local');
        const cacheName = `jurukasa-web:${appPrefix}`;

        // Check if already cached (local source means it's already cached)
        const isAlreadyCached = isLocalSource;

        if (!isAlreadyCached && isNpmSource) {
          // Download and cache the npm version
          checkDeadline(data);
          const packageJsonUrl = `${appPrefix}/package.json`;
          const materialSymbolsListUrl = `${appPrefix}/web/material-symbols-list.txt`;

          const [packageJsonResp, materialSymbolsListResp] = await Promise.all([
            fetch(packageJsonUrl),
            fetch(materialSymbolsListUrl),
          ]);

          if (!packageJsonResp.ok) {
            throw new Error(`Failed to fetch package.json from ${packageJsonUrl}`);
          }

          const packageData = await packageJsonResp.clone().json();
          checkDeadline(data);

          if (
            typeof packageData === 'object'
            && packageData !== null
            && 'files' in packageData
            && Array.isArray(packageData.files)
          ) {
            const materialSymbolsNames = (await materialSymbolsListResp.text())
              .split('\n')
              .map(function trimmedLine(line) { return line.trim(); })
              .filter(function nonEmptyLine(line) { return line.length !== 0; });

            const materialSymbolsProviderUrl = 'https://cdn.jsdelivr.net/npm/@material-symbols/svg-400@0.40.2/rounded/{NAME}{FILL}.svg';
            const materialSymbolsFiles = [
              ...materialSymbolsNames.map(function outlinedSymbols(name) {
                return materialSymbolsProviderUrl.replace('{NAME}', name).replace('{FILL}', '');
              }),
              ...materialSymbolsNames.map(function filledSymbols(name) {
                return materialSymbolsProviderUrl.replace('{NAME}', name).replace('{FILL}', '-fill');
              }),
            ];

            const additionalFiles = [
              appIndex,
              'manifest.json',
            ];

            const files = [
              ...additionalFiles,
              ...packageData.files,
              ...materialSymbolsFiles,
            ].map(function clearPrefix(file) {
              return file.startsWith('/') ? file.slice(1) : file;
            });

            const cache = await caches.open(cacheName);
            // Cache package.json first
            await cache.put(packageJsonUrl, packageJsonResp);
            checkDeadline(data);

            // Cache all files
            await Promise.all(files.map(async function cacheFile(file) {
              const fileUrl = file.startsWith('http') ? file : `${appPrefix}/${file}`;
              const cachedResponse = await cache.match(fileUrl);
              if (cachedResponse) {
                // Already cached, skip
                return;
              }
              const response = await fetch(fileUrl);
              if (response.ok) {
                await cache.put(fileUrl, response);
              }
            }));
            checkDeadline(data);
          }
          else {
            throw new Error('Invalid package.json structure from npm');
          }
        }

        // Now set the active appPrefix in IndexedDB
        const idb = await idbConnect();
        checkDeadline(data);
        await idbWrite(idb, ['sw:config'], function transactionHandler(transaction) {
          const configStore = transaction.objectStore('sw:config');
          configStore.put({ name: 'appPrefix', value: appPrefix });
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
        checkDeadline(data);
        const [cachedAppVersions, npmAppVersions] = await Promise.all([
          (async function loadCachedAppVersions() {
            const cacheNames = await caches.keys();
            const jurukasaCaches = cacheNames.filter(function filterJurukasaCaches(name) {
              return name.startsWith('jurukasa-web:');
            });
            /** @type {Array<AppVersion>} */
            const localAppVersions = await Promise.all(
              jurukasaCaches.map(async function cacheToVersion(cacheName) {
                const cache = await caches.open(cacheName);
                // Extract appPrefix from cache name (jurukasa-web:${appPrefix})
                const appPrefix = cacheName.slice('jurukasa-web:'.length);
                const packageJsonUrl = appPrefix ? `${appPrefix}/package.json` : '/package.json';
                const packageJsonResponse = await cache.match(packageJsonUrl);
                let version = 'unknown';
                if (packageJsonResponse) {
                  try {
                    const packageData = await packageJsonResponse.json();
                    if (packageData && typeof packageData.version === 'string') {
                      version = packageData.version;
                    }
                  }
                  catch (error) {
                    // Ignore parse errors, keep version as 'unknown'
                  }
                }
                return /** @type {AppVersion} */ ({
                  prefix: appPrefix,
                  version,
                  sources: ['local'],
                });
              }),
            );
            return localAppVersions;
          })(),
          (async function loadNpmAppVersions() {
            try {
              const response = await fetch('https://data.jsdelivr.com/v1/packages/npm/jurukasa-web');
              /** @type {unknown} */
              const data = await response.json();
              console.debug('sw', 'get-app-versions', 'npm', JSON.stringify(data));
              if (
                typeof data === 'object'
                && data !== null
                && 'versions' in data
                && Array.isArray(data.versions)
              ) {
                return data.versions
                  .map(function entryToVersion(/** @type {unknown} */ entry) {
                    if (
                      true
                      && typeof entry === 'object'
                      && entry !== null
                      && 'version' in entry
                      && typeof entry.version === 'string'
                    ) return /** @type {AppVersion} */ ({
                      prefix: `https://cdn.jsdelivr.net/npm/jurukasa-web@${entry.version}`,
                      version: entry.version,
                      sources: ['npm'],
                    });
                    else return null;
                  })
                  .filter(function nonNull(entry) {
                    return entry !== null;
                  });
              }
              return [];
            }
            catch (error) {
              console.error('sw', 'get-app-versions', 'npm', error);
              return [];
            }
          })(),
        ]);

        checkDeadline(data);

        // Create a map to combine local and npm versions
        /** @type {Map<string, AppVersion>} */
        const versionMap = new Map();

        // Add local versions first
        for (const localVersion of cachedAppVersions) {
          versionMap.set(localVersion.version, {
            prefix: localVersion.prefix,
            version: localVersion.version,
            sources: ['local'],
          });
        }

        // Add npm versions, merging sources if version already exists locally
        for (const npmVersion of npmAppVersions) {
          const existing = versionMap.get(npmVersion.version);
          if (existing) existing.sources.push('npm');
          else versionMap.set(npmVersion.version, {
            prefix: npmVersion.prefix,
            version: npmVersion.version,
            sources: ['npm'],
          });
        }

        const appVersions = Array.from(versionMap.values());

        responseMessage(event, { appVersions });
      }
      else throw new Error('Unhandled message payload');
    }
    else throw new Error('Invalid message payload');
  }
  catch (error) {
    console.debug('sw', 'message', error);
    responseMessage(event, {
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
      data,
    });
  }

});
