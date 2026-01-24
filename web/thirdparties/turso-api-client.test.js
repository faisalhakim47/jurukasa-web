import { equal, doesNotReject } from 'node:assert/strict';
import { describe, it } from 'node:test';
import { useTursoLibSQLiteServer } from '#test/nodejs/hooks/use-turso-libsqlite-server.js';
import { transaction, execute, executeMultiple } from '#web/thirdparties/turso-api-client.js';
/** @import { TursoConfig } from '#web/thirdparties/turso-api-client.js' */

describe('Turso API Client', function () {
  const tursoLibSQLiteServer = useTursoLibSQLiteServer();

  it('shall execute simple query', async function () {
    /** @type {TursoConfig} */
    const config = { url: tursoLibSQLiteServer().url };

    const result = await execute(config, 'SELECT 1 AS test_number');

    equal(result.rows[0].test_number, '1', 'shall result correct number');
  });

  it('shall execute non-query', async function () {
    /** @type {TursoConfig} */
    const config = { url: tursoLibSQLiteServer().url };

    const createTableResult = await execute(config, `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );
    `);

    equal(createTableResult.rowsAffected, 0, 'CREATE TABLE shall affect 0 rows');
    equal(createTableResult.lastInsertRowid, null, 'CREATE TABLE shall have no last insert rowid');

    const insertResult = await execute(config, `INSERT INTO users (name) VALUES ('Alice');`);

    equal(insertResult.rowsAffected, 1, 'INSERT shall affect 1 row');
    equal(insertResult.lastInsertRowid, '1', 'INSERT shall return last insert rowid');

    const updateResult = await execute(config, `UPDATE users SET name = 'Bob' WHERE id = 1;`);

    equal(updateResult.rowsAffected, 1, 'UPDATE shall affect 1 row');
    equal(updateResult.lastInsertRowid, null, 'UPDATE shall have no last insert rowid');
  });

  it('shall execute multiple queries', async function () {
    /** @type {TursoConfig} */
    const config = { url: tursoLibSQLiteServer().url };

    await executeMultiple(config, `
      CREATE TABLE multiple_queries_test (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );
      INSERT INTO multiple_queries_test (name) VALUES ('Alice');
      INSERT INTO multiple_queries_test (name) VALUES ('Bob');
      INSERT INTO multiple_queries_test (name) VALUES ('Charlie');
    `);

    const result = await execute(config, 'SELECT COUNT(*) AS user_count FROM multiple_queries_test;');
    equal(result.rows[0].user_count, '3', 'shall execute all queries correctly');
  });

  it('shall handle interactive query', async function () {
    /** @type {TursoConfig} */
    const config = { url: tursoLibSQLiteServer().url };

    await execute(config, `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );
    `);

    const tx = await transaction(config, 'write');

    await tx.execute(`INSERT INTO users (name) VALUES ('Alice');`);

    await doesNotReject(tx.commit(), 'shall commit transaction correctly');
  });

  it('shall handle concurrent interactive queries', async function () {
    /** @type {TursoConfig} */
    const config = { url: tursoLibSQLiteServer().url };

    await execute(config, `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );
    `);

    const tx = await transaction(config, 'write');

    await doesNotReject(Promise.all([
      tx.execute(`INSERT INTO users (name) VALUES ('Alice');`),
      tx.execute(`INSERT INTO users (name) VALUES ('Diana');`),
      tx.execute(`INSERT INTO users (name) VALUES ('Jhon');`),
      tx.execute(`INSERT INTO users (name) VALUES ('Zeal');`),
    ]), 'shall handle concurrent requests');

    await doesNotReject(tx.commit(), 'shall commit transaction correctly');
  });

  it('shall handle rollback correctly', async function () {
    /** @type {TursoConfig} */
    const config = { url: tursoLibSQLiteServer().url };

    await execute(config, `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );
    `);

    const tx = await transaction(config, 'write');

    await tx.execute(`INSERT INTO users (name) VALUES ('Alice');`);

    await doesNotReject(tx.rollback(), 'shall rollback transaction correctly');

    // Verify that the insert was rolled back
    const result = await execute(config, 'SELECT COUNT(*) AS user_count FROM users;');
    equal(result.rows[0].user_count, '0', 'shall have no users after rollback');
  });
});
