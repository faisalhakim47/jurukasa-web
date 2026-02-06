/**
 * @typedef {object} Worker1OpenArgs
 * @property {string} filename
 * @property {'opfs'|'unix-none'} [vfs]
 */

/**
 * @typedef {object} Worker1OpenResult
 * @property {string} dbId
 * @property {string} filename
 * @property {boolean} persistent
 * @property {string} vfs
 */

/**
 * @typedef {object} Worker1ExecArgs
 * @property {string} sql
 * @property {Array<unknown>} bind
 * @property {'array'|'object'} [rowMode]
 * @property {'resultRows'|'saveSql'} [returnValue]
 * @property {boolean} [countChanges]
 * @property {string} [callback]
 */

/**
 * @typedef {object} Worker1ExecResult
 * @property {string} type
 * @property {Array<Record<string, unknown>>} resultRows
 * @property {Array<string>} columnNames
 * @property {number} [changeCount]
 * @property {number} [lastInsertRowId]
 */

/**
 * @typedef {object} Worker1CloseResult
 * @property {string} filename
 */

/**
 * @typedef {object} Worker1ConfigGetResult
 * @property {{ libVersion: string, sourceId: string }} version
 * @property {Array<string>} vfsList
 */

/**
 * @typedef {object} Worker1ExportArgs
 * @property {string} [type] default to application/x-sqlite3
 */

/**
 * @typedef {object} Worker1ExportResult
 * @property {Uint8Array} byteArray
 * @property {string} filename
 * @property {string} type
 */

/**
 * Intended for testing/debugging. Forces the worker to throw an exception.
 * 
 * @typedef {string} Worker1TossArgs
 */

export function createSqlite3Worker1Client() {
  const { promise: ready, resolve: resolveReady, reject: rejectReady } = Promise.withResolvers();

  const sqlite3WorkerUrl = new URL('./npm/@sqlite.org/sqlite-wasm@3.51.2-build6/dist/sqlite3-worker1.mjs', import.meta.url);
  const worker1 = new Worker(sqlite3WorkerUrl, { type: 'module', name: 'sqlite3-worker1' });
  /** @param {MessageEvent} event */
  function handleWorker1Ready(event) {
    console.debug('handleWorker1Ready', event.data?.type === 'sqlite3-api' && event.data?.result === 'worker1-ready', event.data?.type, event.data?.result);
    if (event.data?.type === 'sqlite3-api' && event.data?.result === 'worker1-ready') {
      clearTimeout(readyTimeout);
      worker1.removeEventListener('message', handleWorker1Ready);
      resolveReady();
    }
  }
  worker1.addEventListener('message', handleWorker1Ready);
  const readyTimeout = setTimeout(function readyTimeout() {
    worker1.removeEventListener('message', handleWorker1Ready);
    rejectReady(new Error('Worker1 ready timeout'));
  }, 3000);

  let messageIdInc = 0;

  /**
   * @template Args, Result
   * @param {string|null} dbId
   * @param {string} type
   * @param {Args} args
   * @param {number} timeoutDuration
   * @returns {Promise<Result>}
   */
  async function post(dbId, type, args, timeoutDuration) {
    await ready;
    const messageId = messageIdInc++;
    const { promise, resolve, reject } = Promise.withResolvers();
    /** @param {MessageEvent} event */
    function waitForResult(event) {
      if (event?.data?.messageId === messageId) {
        clearTimeout(timeout);
        worker1.removeEventListener('message', waitForResult);
        if (event.data.type === type) resolve(event.data.result);
        else reject(new Error(`Worker1 ${type} failed: ${JSON.stringify(event.data)}`));
      }
    }
    const timeout = setTimeout(function openTimeout() {
      worker1.removeEventListener('message', waitForResult);
      reject(new Error(`Worker1 ${type} timeout`));
    }, timeoutDuration);
    worker1.addEventListener('message', waitForResult);
    worker1.postMessage({ dbId, type, args, messageId });
    return promise;
  }

  return {
    ready,

    /**
     * @param {Worker1OpenArgs} args
     * @param {number} [timeoutDuration]
     * @returns {Promise<Worker1OpenResult>}
     */
    async open(args, timeoutDuration = 5000) {
      return await post(null, 'open', args, timeoutDuration);
    },

    /**
     * @param {string} dbId
     * @param {Worker1ExecArgs} args
     * @param {number} [timeoutDuration]
     * @returns {Promise<Worker1ExecResult>}
     */
    async exec(dbId, args, timeoutDuration = 5000) {
      return await post(dbId, 'exec', args, timeoutDuration);
    },

    /**
     * @param {string} dbId
     * @param {number} [timeoutDuration]
     * @returns {Promise<Worker1CloseResult>}
     */
    async close(dbId, timeoutDuration = 5000) {
      return await post(dbId, 'close', {}, timeoutDuration);
    },

    /**
     * @param {number} [timeoutDuration]
     * @returns {Promise<Worker1ConfigGetResult>}
     */
    async configGet(timeoutDuration = 5000) {
      return await post(null, 'config-get', {}, timeoutDuration);
    },

    /**
     * @param {string} dbId
     * @param {Worker1ExportArgs} args
     * @param {number} [timeoutDuration]
     * @returns {Promise<Worker1ExportResult>}
     */
    async export(dbId, args, timeoutDuration = 60000) {
      return await post(dbId, 'export', args, timeoutDuration);
    },

    /**
     * @param {Worker1TossArgs} args
     * @param {number} [timeoutDuration]
     * @returns {Promise<void>}
     */
    async toss(args, timeoutDuration = 5000) {
      return await post(null, 'toss', args, timeoutDuration);
    },
  };
}
