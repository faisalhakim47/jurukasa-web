import { unknownToSQLArgs } from '#web/database.js';
import { assertTemplateStringsArray } from '#web/tools/assertion.js';
import { createWatchedFetch } from '#web/tools/fetch.js';
import { removeIndentation } from '#web/tools/string.js';
/** @import { Client } from '@libsql/client' */
/** @import { DatabaseClient } from '#web/database.js' */

/**
 * @param {string} url
 * @param {string} authToken
 * @returns {Promise<DatabaseClient>}
 */
export async function createTursoDatabaseClient(url, authToken) {
  const { createClient } = await import('@libsql/client/web');
  const client = createClient({
    url,
    authToken,
    fetch: createWatchedFetch(async function logFetch(input, init, response, error) {
      // skip successful requests
      if (response instanceof Response && response.ok) return;
      if (input instanceof Request) {
        const inputBody = input.body ? await input.clone().json() : null;
        console.debug(
          '[fetch]',
          error instanceof Error ? '[error]' : '[response]',
          input.method,
          input.url,
          // init,
          ...inputBody?.requests
            .map(function logRequest(/** @type {object} */ req) {
              if (req.type === 'close') return null;
              else if (req.type === 'execute') return req.stmt.sql;
              else if (req.type === 'sequence') return req.sql;
              else if (req.type === 'store_sql') return req.sql;
              else if (req.type === 'batch') { /* ignore */ }
              else return JSON.stringify(req);
            })
            .filter(function nonNull(/** @type {unknown} */ v) {
              return v !== null;
            }),
          response instanceof Response ? [
            response.status,
            response.statusText,
          ] : null,
          error instanceof Error ? [
            error.name,
            error.message,
            error.stack,
          ] : null,
        );
      }
      else console.debug(input, init, {
        status: response instanceof Response ? response.status : null,
        // statusText: response instanceof Response ? response.statusText : null,
        // body: await response instanceof Response ? response.text() : null,
        error: error instanceof Error ? [
          error.name,
          error.message,
          error.stack,
        ] : null,
      });
    }),
  });
  return tursoClientToDatabaseClient(client);
}

/**
 * @param {Client} client
 * @returns {Promise<DatabaseClient>}
 */
export async function tursoClientToDatabaseClient(client) {
  return {
    async connect() {
      await client.executeMultiple(removeIndentation(`
        -- Commented out pragmas are not supported in Turso
        -- PRAGMA journal_mode = WAL;
        -- PRAGMA synchronous = FULL;
        PRAGMA foreign_keys = ON;
        -- PRAGMA temp_store = MEMORY;
        -- PRAGMA cache_size = -32000;
        -- PRAGMA mmap_size = 67108864;
      `));
    },
    async executeMultiple(queries) { await client.executeMultiple(queries); },
    async sql(query, ...params) {
      assertTemplateStringsArray(query);
      const unindentedQuery = removeIndentation(query.join('?'));
      const result = await client.execute({
        sql: unindentedQuery,
        args: unknownToSQLArgs(params),
      });
      return {
        rows: result.rows,
        rowsAffected: result.rowsAffected,
        lastInsertRowid: Number(result.lastInsertRowid),
      };
    },
    async transaction(mode) {
      const tx = await client.transaction(mode);
      return {
        async executeMultiple(queries) { await tx.executeMultiple(queries); },
        async sql(query, ...params) {
          assertTemplateStringsArray(query);
          const unindentedQuery = removeIndentation(query.join('?'));
          const result = await tx.execute({
            sql: unindentedQuery,
            args: unknownToSQLArgs(params),
          });
          return {
            rows: result.rows,
            rowsAffected: result.rowsAffected,
            lastInsertRowid: Number(result.lastInsertRowid),
          };
        },
        async commit() { await tx.commit(); },
        async rollback() { await tx.rollback(); },
      };
    },
  };
}

/**
 * @param {string} url
 * @param {string} authToken
 * @returns {Promise<void>}
 */
async function healthcheck(url, authToken) {

}
