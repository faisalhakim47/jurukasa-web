import { unknownToSQLArgs } from '#web/database.js';
import { assertTemplateStringsArray } from '#web/tools/assertion.js';
/** @import { DatabaseClient, SQLFunction } from '#web/database.js' */

/** @returns {Promise<DatabaseClient>} */
export async function createLocalDatabaseClient() {
  

  // @ts-ignore the code structure of sqlite wasm client is very convoluted, hard to structure and type properly, so screw it
  const { sqlite3Worker1Promiser } = await import('@sqlite.org/sqlite-wasm');
  // console.debug('createLocalDatabaseClient', sqlite3Worker1Promiser.toString());
  const promiser = await sqlite3Worker1Promiser({
  });
  /** @type {PromiseWithResolvers<string>} */
  const { promise: promisedDbId, resolve: resolveDbId } = Promise.withResolvers();
  async function connect() {
    // console.debug('database', 'local', 'connect');
    const response = await promiser('open', { filename: 'file:jurukasa.sqlite?vfs=opfs' });
    // console.debug('database', 'local', 'connected', response.dbId);
    resolveDbId(response.dbId);
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
    const sqlQuery = query.join('?');
    const sqlArgs = unknownToSQLArgs(params);
    // console.debug('database', 'local', 'sql', sqlQuery, sqlArgs);
    try {
      const dbId = await promisedDbId;
      const response = await promiser('exec', {
        dbId,
        sql: sqlQuery,
        bind: sqlArgs,
        rowMode: 'object',
        returnValue: 'resultRows',
        countChanges: true,
      });
      if (response?.type === 'error') throw new Error(response?.result?.message ?? `Unknown database error occurred: ${JSON.stringify(response)}`);
      else return {
        rows: response?.result?.resultRows ?? [],
        rowsAffected: response?.result?.changeCount ?? 0,
        lastInsertRowid: response?.result?.lastInsertRowid ?? 0,
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
       * @type {any} I don't like it, but a bit of "any" work-around is fine in this case.
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
      // console.debug('database', 'local', 'transaction', mode);
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

