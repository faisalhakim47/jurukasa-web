import { startTursoLibSQLiteServer } from '#test/tools/turso.js';
/** @import { test } from '@playwright/test' */

/**
 * @typedef {object} TursoLibSQLiteServerState
 * @property {string} url
 */

/**
 * This hook will spawn clean/empty Turso LibSQLite database server before each test and destroy it after each test.
 *
 * @param {typeof test} test
 * @returns {function():TursoLibSQLiteServerState}
 */
export function useTursoLibSQLiteServer(test) {
  const { beforeEach, afterEach } = test;

  let tursoLibSQLiteServer = /** @type {Awaited<ReturnType<startTursoLibSQLiteServer>>} */ (undefined);

  beforeEach(async function setupTursoLibSQLiteServer() {
    const maxRetries = 5;
    let attempt = 0;
    while (true) {
      try {
        tursoLibSQLiteServer = await startTursoLibSQLiteServer();
        process.addListener('beforeExit', tursoLibSQLiteServer.teardown);
        process.addListener('exit', tursoLibSQLiteServer.teardown);
        break;
      }
      catch (error) {
        if (attempt > maxRetries) throw new Error(`Failed to start Turso LibSQLite server after ${maxRetries} attempts: ${error?.message}`);
      }
      attempt += 1;
    }
  });

  afterEach(async function teardownTursoLibSQLiteServer() {
    process.removeListener('beforeExit', tursoLibSQLiteServer.teardown);
    process.removeListener('exit', tursoLibSQLiteServer.teardown);
    await tursoLibSQLiteServer.teardown();
  });

  return function getTursoLibSQLiteServer() {
    return {
      url: tursoLibSQLiteServer.url,
    };
  };
}
