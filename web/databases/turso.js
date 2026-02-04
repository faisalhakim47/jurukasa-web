import { unknownToSQLArgs } from '#web/database.js';
import { execute, executeMultiple, transaction } from '#web/thirdparties/turso-api-client.js';
import { assertTemplateStringsArray } from '#web/tools/assertion.js';
import { removeIndentation } from '#web/tools/string.js';
/** @import { DatabaseClient } from '#web/database.js' */
/** @import { TursoConfig } from '#web/thirdparties/turso-api-client.js' */


/**
 * @param {TursoConfig} config
 * @returns {Promise<DatabaseClient>}
 */
export async function createTursoDatabaseClient(config) {
  return {
    async connect() {
      await execute(config, removeIndentation(`
        -- Commented out pragmas are not supported in Turso
        -- PRAGMA journal_mode = WAL;
        -- PRAGMA synchronous = FULL;
        PRAGMA foreign_keys = ON;
        -- PRAGMA temp_store = MEMORY;
        -- PRAGMA cache_size = -32000;
        -- PRAGMA mmap_size = 67108864;
      `), []);
    },
    async executeMultiple(queries) {
      await executeMultiple(config, queries);
    },
    async sql(query, ...params) {
      assertTemplateStringsArray(query);
      const unindentedQuery = removeIndentation(query.join('?'));
      const result = await execute(config, unindentedQuery, unknownToSQLArgs(params));
      return {
        rows: result.rows,
        rowsAffected: result.rowsAffected,
        lastInsertRowId: Number(result.lastInsertRowId),
      };
    },
    async transaction(mode) {
      const tx = await transaction(config, mode);
      return {
        async executeMultiple(queries) { await tx.executeMultiple(queries); },
        async sql(query, ...params) {
          assertTemplateStringsArray(query);
          const unindentedQuery = removeIndentation(query.join('?'));
          return tx.execute(unindentedQuery, unknownToSQLArgs(params));
        },
        async commit() { await tx.commit(); },
        async rollback() { await tx.rollback(); },
      };
    },
  };
}
