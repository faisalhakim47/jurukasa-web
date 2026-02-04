import { unknownToSQLArgs } from '#web/database.js';
import { createSqlite3Worker1Client } from '#web/thirdparties/sqlite3-worker1-client.js';
import { assertTemplateStringsArray } from '#web/tools/assertion.js';
import { removeIndentation } from '#web/tools/string.js';
/** @import { DatabaseClient, SQLFunction } from '#web/database.js' */
/** @import { DatabaseConfig } from '#web/contexts/database-context.js' */

/**
 * @param {DatabaseConfig} config
 * @returns {Promise<DatabaseClient>}
 */
export async function createLocalDatabaseClient(config) {
  const client = createSqlite3Worker1Client();

  /** @type {PromiseWithResolvers<string>} */
  const { promise: promisedDbId, resolve: resolveDbId } = Promise.withResolvers();
  async function connect() {
    console.debug('database', 'local', 'connect');
    await client.ready;
    const filename = config.name.replace(/[^a-zA-Z0-9]+/g, '_');
    const openResult = await client.open({ filename: `jurukasa-${filename}.sqlite`, vfs: 'opfs' });
    console.debug('database', 'local', 'connected', openResult.dbId);
    resolveDbId(openResult.dbId);
    // sql`PRAGMA journal_mode = WAL`;
    // sql`PRAGMA synchronous = FULL`;
    await sql`PRAGMA foreign_keys = ON;`;
    // sql`PRAGMA temp_store = MEMORY`;
    // sql`PRAGMA cache_size = -32000`;
    // sql`PRAGMA mmap_size = 67108864`;
  }

  /** @type {SQLFunction} */
  async function sql(query, ...params) {
    assertTemplateStringsArray(query);
    const sqlQuery = removeIndentation(query.join('?'));
    const sqlArgs = unknownToSQLArgs(params);
    console.debug('database', 'local', 'sql', `\n  ` + sqlQuery.slice(0, 500).replace(/\n/g, '\n  '), sqlQuery.length > 500 ? '...' : '');
    try {
      const dbId = await promisedDbId;
      const execResult = await client.exec(dbId, {
        sql: sqlQuery,
        bind: sqlArgs,
        rowMode: 'object',
        returnValue: 'resultRows',
        countChanges: true,
      });
      return {
        rows: execResult?.resultRows ?? [],
        rowsAffected: execResult?.changeCount ?? 0,
        lastInsertRowId: execResult?.lastInsertRowId ?? 0,
      };
    }
    catch (error) {
      if (error instanceof Error) throw error;
      else if ('type' in error) throw new Error(error?.result?.message ?? `Unknown database error occurred: ${JSON.stringify(error)}`);
      else throw new Error(`Unknown database error occurred: ${JSON.stringify(error)}`);
    }
  }
  /** @param {string} queries */
  async function executeMultiple(queries) {
    await sql(
      /**
       * @type {any} Mandatory "any" work-around.
       *  We can't expose `execute` interface for risk to be used outside database internal.
       *  I consider this database context as internal implementation detail, so the reason why the "any" cast necessary is very clear.
       */
      ([queries]),
    );
  }
  return {
    connect,
    sql,
    executeMultiple,
    async transaction(mode) {
      console.debug('database', 'local', 'transaction', mode);
      if (mode === 'write') await sql`BEGIN EXCLUSIVE TRANSACTION;`;
      else await sql`BEGIN DEFERRED TRANSACTION;`;
      return {
        sql,
        executeMultiple,
        async commit() { await sql`COMMIT TRANSACTION;`; },
        async rollback() { await sql`ROLLBACK TRANSACTION;`; },
      };
    },
  };
}

