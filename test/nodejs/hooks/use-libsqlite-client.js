import { mkdir, readFile, stat } from 'node:fs/promises';
import { afterEach, beforeEach } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
/** @import { Client } from '@libsql/client' */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * create a libsqlite client hooked to a clean temporary database for testing
 * 
 * @returns {() => Client & { promise: Promise<Client> }}
 */
export function useLibSQLiteClient() {
  /** @type {Promise<Client>} */
  let currentPromise;
  /** @type {Client} */
  let client;

  beforeEach(async function beforeUsingLibSQLiteClient() {
    const { resolve, promise } = Promise.withResolvers();
    currentPromise = promise;

    let databaseDirectory = join(__dirname, `../../../../.local/test-database-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    while (true) {
      try { await stat(databaseDirectory); }
      catch (error) { if (error.code === 'ENOENT') break; }
    }
    await mkdir(databaseDirectory, { recursive: true });
    client = createClient({ url: `file:${join(databaseDirectory, 'database.sqlite')}` });
    await client.executeMultiple(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      PRAGMA foreign_keys = ON;
      PRAGMA temp_store = MEMORY;
      PRAGMA cache_size = -32000;
      PRAGMA mmap_size = 67108864;
    `);
    const migrationFiles = [
      join(__dirname, '../../001-accounting.sql'),
      join(__dirname, '../../002-pos.sql'),
      join(__dirname, '../../003-chart-of-accounts.sql'),
      join(__dirname, '../../004-revenue-tracking.sql'),
      join(__dirname, '../../005-fixed-assets.sql'),
      join(__dirname, '../../006-account-reconciliation.sql'),
      join(__dirname, '../../007-cash-count.sql'),
    ];
    for (const filePath of migrationFiles) {
      const sql = await readFile(filePath, { encoding: 'utf-8' });
      const tx = await client.transaction();
      try {
        await tx.executeMultiple(sql);
        await tx.commit();
      }
      catch (error) {
        await tx.rollback();
        throw error;
      }
    }
    resolve(client);
  });

  afterEach(async function afterUsingLibSQLiteClient() {
    if (client) client.close();
  });

  return function getClient() {
    if (client) {
      Object.assign(client, { promise: currentPromise });
      return /** @type {object} dinamically modified */ (client);
    }
    return { promise: currentPromise };
  };
}
