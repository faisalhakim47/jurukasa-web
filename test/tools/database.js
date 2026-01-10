import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';

/** @import { ResultSet } from '@libsql/client' */
/** @import { TursoLibSQLiteServerState } from '#test/hooks/use-turso-libsqlite-server.js' */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * @typedef {function(TemplateStringsArray, ...unknown): Promise<ResultSet>} SQLFunction
 */

/**
 * This helper expect to be run on clean database.
 * The test implementation expects each test to have isolated database state.
 * 
 * @param {TursoLibSQLiteServerState} tursoLibSQLiteServer
 * @param {function(SQLFunction): Promise<void>} [setup]
 * @returns {Promise<void>}
 */
export async function setupDatabase(tursoLibSQLiteServer, setup) {
  const client = createClient({ url: tursoLibSQLiteServer.url });
  await client.executeMultiple(`
    -- Commented out pragmas are not supported in Turso
    -- PRAGMA journal_mode = WAL;
    -- PRAGMA synchronous = FULL;
    PRAGMA foreign_keys = ON;
    -- PRAGMA temp_store = MEMORY;
    -- PRAGMA cache_size = -32000;
    -- PRAGMA mmap_size = 67108864;
  `);
  const migrations = await Promise.all([
    readFile(join(__dirname, '../../web/schemas/001-accounting.sql'), { encoding: 'utf-8' }),
    readFile(join(__dirname, '../../web/schemas/002-pos.sql'), { encoding: 'utf-8' }),
    readFile(join(__dirname, '../../web/schemas/003-chart-of-accounts.sql'), { encoding: 'utf-8' }),
    readFile(join(__dirname, '../../web/schemas/004-revenue-tracking.sql'), { encoding: 'utf-8' }),
    readFile(join(__dirname, '../../web/schemas/005-fixed-assets.sql'), { encoding: 'utf-8' }),
  ]);
  for (const migration of migrations) await client.executeMultiple(migration);
  await client.execute(`UPDATE config SET value = 'Testing Business' WHERE key = 'Business Name';`);
  await client.execute(`INSERT INTO chart_of_accounts_templates (name) VALUES ('Retail Business - Indonesia');`);
  if (typeof setup === 'function') await setup(async function sql(query, ...params) {
    if (!Array.isArray(query)) throw new TypeError('Expected TemplateStringsArray as the first argument.');
    return client.execute({
      sql: query.join('?'),
      args: params.map(function (param) {
        if (param === null || param === undefined) return null;
        else if (typeof param === 'number' || typeof param === 'string' || typeof param === 'boolean') return param;
        else return JSON.stringify(param);
      }),
    });
  });
}

/**
 * Get migration SQL files content for use in browser-based tests
 * @returns {Promise<string[]>}
 */
export async function getMigrationSQL() {
  return Promise.all([
    readFile(join(__dirname, '../../web/schemas/001-accounting.sql'), { encoding: 'utf-8' }),
    readFile(join(__dirname, '../../web/schemas/002-pos.sql'), { encoding: 'utf-8' }),
    readFile(join(__dirname, '../../web/schemas/003-chart-of-accounts.sql'), { encoding: 'utf-8' }),
    readFile(join(__dirname, '../../web/schemas/004-revenue-tracking.sql'), { encoding: 'utf-8' }),
    readFile(join(__dirname, '../../web/schemas/005-fixed-assets.sql'), { encoding: 'utf-8' }),
  ]);
}
