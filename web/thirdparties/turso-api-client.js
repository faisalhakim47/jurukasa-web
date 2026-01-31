import { unknownToSQLArgs } from '#web/database.js';
/** @import { SQLResult, TransactionMode } from '#web/database.js' */

/**
 * This is client of https://docs.turso.tech/sdk/http/reference
 * Read the test file for this file to see usage example.
 */

/**
 * @typedef {object} TursoConfig
 * @property {string} url The URL must not end with a trailing slash
 * @property {string} [authToken]
 * @property {string} [baton]
 */

/**
 * @typedef {Object} TursoResponse
 * @property {null} baton
 * @property {null} base_url
 * @property {Result[]} results
 */

/**
 * @typedef {Object} Result
 * @property {"ok"} type
 * @property {ResultResponse} response
 */

/**
 * @typedef {Object} ResultResponse
 * @property {"execute"|"close"} type
 * @property {ExecuteResult} [result]
 */

/**
 * @typedef {Object} ExecuteResult
 * @property {Column[]} cols
 * @property {Array<Array<Value>>} rows
 * @property {number} affected_row_count
 * @property {null} last_insert_rowid
 */

/**
 * @typedef {Object} Column
 * @property {string} name
 * @property {string} decltype
 */

/**
 * @typedef {Object} Value
 * @property {"text"|"integer"|"float"|"blob"|"null"} type
 * @property {string|number|null} value
 */

/**
 * @typedef {TursoResponse} TursoLibSQLResponse
 */

/**
 * @typedef {SQLResult & { baton: string }} TursoSQLResult
 */

/**
 * @param {TursoConfig} config
 * @param {'execute' | 'sequence'} type
 * @param {string} sql
 * @param {Array<unknown>} rawArgs
 * @param {boolean} close
 * @returns {Promise<TursoSQLResult>}
 */
async function pipeline(config, type, sql, rawArgs, close) {
  const interpretedArgs = await interpreteArgs(rawArgs);
  const response = await tursoFetch(config, 'POST', '/v2/pipeline', {
    body: JSON.stringify({
      ...(config.baton ? { baton: config.baton } : {}),
      requests: [
        ...(type === 'execute' ? [{ type: 'execute', stmt: { sql, args: interpretedArgs } }] : []),
        ...(type === 'sequence' ? [{ type: 'sequence', sql }] : []),
        ...(close ? [{ type: 'close' }] : []),
      ],
    }),
  });
  if (response.ok) {
    /** @type {TursoResponse} */
    const body = await response.json();
    const resultOfExecute = body.results[0];
    if (resultOfExecute.type === 'ok') {
      if (type === 'execute') {
        const cols = resultOfExecute.response.result?.cols;
        const rows = resultOfExecute.response.result?.rows;
        /** @type {TursoSQLResult} */
        const result = {
          baton: body.baton,
          rows: rows.map(function toRow(values) {
            return cols.reduce(function toObjectRow(objectRow, col, index) {
              const cell = values[index];
              if (false) { }
              else if (cell.type === 'null') objectRow[col.name] = null;
              else objectRow[col.name] = cell.value;
              return objectRow;
            }, {});
          }),
          rowsAffected: resultOfExecute.response.result?.affected_row_count,
          lastInsertRowid: resultOfExecute.response.result?.last_insert_rowid,
        };
        // console.debug('turso-api-client', type, 'result', config.baton, `\n  ${sql.slice(0, 500).replace(/\n/g, '\n  ')} ${sql.length > 500 ? '...' : ''}`, interpretedArgs);
        return result;
      }
      else if (type === 'sequence') {
        const result = {
          baton: body.baton,
          rows: [],
          rowsAffected: undefined,
          lastInsertRowid: undefined,
        };
        console.debug('turso-api-client', type, 'result', config.baton, sql.slice(0, 500));
        return result;
      }
      else throw new Error(`Turso SQL execution failed: unsupported operation type ${type}`)
    }
    else {
      console.debug('turso-api-client', type, 'failed', config.baton, `\n  ${sql.slice(0, 500).replace(/\n/g, '\n  ')} ${sql.length > 500 ? '...' : ''}`, interpretedArgs, resultOfExecute);
      throw new Error(`Turso SQL execution failed: ${JSON.stringify(resultOfExecute)}`);
    }
  }
  else {
    const responseBody = await response.text();
    console.debug('turso-api-client', type, 'error', config.baton, sql.slice(0, 500), responseBody);
    throw new Error(`Turso SQL fetch error to POST ${config.url}/v2/pipeline with status ${response.status}: ${responseBody}`);
  }
}

/**
 * @param {TursoConfig} config
 * @param {string} sql
 * @param {Array<unknown>} [rawArgs]
 * @returns {Promise<TursoSQLResult>}
 */
export async function execute(config, sql, rawArgs = []) {
  return pipeline(config, 'execute', sql, rawArgs, true);
}

/**
 * @param {TursoConfig} config
 * @param {string} sql
 * @returns {Promise<TursoSQLResult>}
 */
export async function executeMultiple(config, sql) {
  return pipeline(config, 'sequence', sql, [], true);
}

/**
 * @param {TursoConfig} config
 * @param {TransactionMode} mode
 */
export async function transaction(config, mode) {
  let next = mode === 'read'
    ? pipeline({ ...config, baton: undefined }, 'execute', 'BEGIN DEFERRED TRANSACTION', [], false)
    : pipeline({ ...config, baton: undefined }, 'execute', 'BEGIN IMMEDIATE TRANSACTION', [], false);
  await next;
  return {
    /**
     * @param {string} sql
     * @param {Array<unknown>} [rawArgs]
     * @returns {Promise<TursoSQLResult>}
     */
    async execute(sql, rawArgs = []) {
      const current = next;
      return next = (async function batonQueue() {
        const baton = (await current).baton;
        return await pipeline({ ...config, baton }, 'execute', sql, rawArgs, false);
      })();
    },
    /**
     * @param {string} sql
     * @returns {Promise<TursoSQLResult>}
     */
    async executeMultiple(sql) {
      const current = next;
      return next = (async function batonQueue() {
        const baton = (await current).baton;
        return await pipeline({ ...config, baton }, 'sequence', sql, [], false);
      })();
    },
    async commit() {
      const current = next;
      next = (async function batonQueue() {
        const baton = (await current).baton;
        return pipeline({ ...config, baton }, 'execute', 'COMMIT TRANSACTION', [], true);
      })();
      await next;
    },
    async rollback() {
      const current = next;
      next = (async function batonQueue() {
        const baton = (await current).baton;
        return pipeline({ ...config, baton }, 'execute', 'ROLLBACK TRANSACTION', [], true);
      })();
      await next;
    },
  };
}

/**
 * @param {TursoConfig} config
 * @param {'GET'|'POST'} method
 * @param {string} path
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
function tursoFetch(config, method, path, init) {
  return fetch(`${config.url}${path}`, {
    ...(init ?? {}),
    method,
    headers: {
      ...(init?.headers ?? {}),
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(config.authToken ? { 'Authorization': `Bearer ${config.authToken}` } : {}),
    },
  });
}

/**
 * @param {Array<unknown>} rawArgs
 * @returns {Promise<Array<{ type: string, value: number|string }>>}
 */
async function interpreteArgs(rawArgs) {
  return await Promise.all(
    unknownToSQLArgs(rawArgs)
      .map(async function attributedArg(sqlArg) {
        if (false) { }
        else if (sqlArg === null) return { type: 'null', value: null };
        else if (typeof sqlArg === 'boolean') return { type: 'integer', value: sqlArg ? 1 : 0 };
        else if (typeof sqlArg === 'number') return {
          type: Number.isInteger(sqlArg) ? 'integer' : 'float',
          value: String(sqlArg), // string is saver to transport than number. Some json interpreter limit number type to signed 32-bit integer.
        };
        else if (typeof sqlArg === 'string') return { type: 'text', value: sqlArg };
        else if (sqlArg instanceof ArrayBuffer) {
          /** @type {string} */
          const argBase64 = await new Promise(function waitForBlob(resolve, reject) {
            const argBlob = new Blob([sqlArg], { type: 'application/octet-stream' });
            const argReader = new FileReader();
            argReader.addEventListener('load', function handleLoadedBlob() {
              const result = argReader.result;
              if (typeof result === 'string') {
                // The result starts with "data:application/octet-stream;base64,"
                const base64String = result.split(',')[1];
                resolve(base64String);
              }
              else throw new Error(`Invalid argument reading result. Expect string, got (${result?.constructor.name}) ${result} instead.`);
            });
            argReader.addEventListener('error', function handleLoadingBlobError(error) {
              reject(new Error('Failed to load argument.', { cause: error }));
            });
            argReader.readAsDataURL(argBlob);
          });
          return { type: 'blob', value: argBase64 };
        }
        else throw new Error(`Uninterpretable argument type: (${sqlArg?.constructor.name}) ${sqlArg}`);
      }),
  );
}
