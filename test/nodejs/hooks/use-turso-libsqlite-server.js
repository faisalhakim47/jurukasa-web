import { afterEach, beforeEach } from 'node:test';
import { startTursoLibSQLiteServer } from '#test/tools/turso.js';

/**
 * @typedef {object} TursoLibSQLiteServerConfig
 * @property {string} [authToken]
 */

/**
 * @typedef {object} TursoLibSQLiteServerState
 * @property {string} url
 */

/**
 * This hook will spawn clean/empty Turso LibSQLite database server before each test and destroy it after each test.
 *
 * @param {TursoLibSQLiteServerConfig} [config]
 * @returns {function():TursoLibSQLiteServerState}
 */
export function useTursoLibSQLiteServer(config) {
  let tursoLibSQLiteServer = /** @type {Awaited<ReturnType<startTursoLibSQLiteServer>>} */ (undefined);

  beforeEach(async function setupTursoLibSQLiteServer() {
    const maxRetries = 5;
    let attempt = 0;
    while (true) {
      try {
        tursoLibSQLiteServer = await startTursoLibSQLiteServer(config);
        break;
      }
      catch (error) {
        if (attempt > maxRetries) throw new Error(`Failed to start Turso LibSQLite server after ${maxRetries} attempts: ${error?.message}`);
      }
      attempt += 1;
    }
  });

  afterEach(async function teardownTursoLibSQLiteServer() {
    await tursoLibSQLiteServer.teardown();
  });

  return function getTursoLibSQLiteServer() {
    return {
      url: tursoLibSQLiteServer.url,
    };
  };
}
