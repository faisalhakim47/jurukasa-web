import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
/** @import { test } from '@playwright/test' */

/**
 * @typedef {object} TursoLibSQLiteServerState
 * @property {string} url
 */

/**
 * This hook will spawn clean/empty Turso LibSQLite database server before each test and destroy it after each test.
 * 
 * @param {typeof test} test
 * @returns {() => TursoLibSQLiteServerState}
 */
export function useTursoLibSQLiteServer(test) {
  const { beforeEach, afterEach } = test;

  /** @type {string} */
  let tursoLibSQLiteServerUrl;
  /** @type {() => Promise<void>} */
  let tursoLibSQLiteServerTeardown;

  beforeEach(async function setupTursoLibSQLiteServer() {
    await new Promise(async function (resolve, reject) {
      let resolvable = true;

      const tursoDevPort = await findAvailablePort();
      const serverProcess = spawn('turso', ['dev', '--port', tursoDevPort.toString()]);

      /** @param {string} message */
      function rejectWithMessage(message) {
        if (resolvable) {
          resolvable = false;
          reject(new Error(`turso spawn exit: ${message}`));
        };
      };

      serverProcess.on('error', function (error) {
        rejectWithMessage(error?.message);
      });

      serverProcess.on('exit', function (code, signal) {
        rejectWithMessage(`code ${code} and signal ${signal}`);
      });

      serverProcess.stderr.on('data', function (data) {
        rejectWithMessage(data.toString());
      });

      await waitForTursoSQLiteServerReady(tursoDevPort);

      if (resolvable) {
        resolvable = false;
        tursoLibSQLiteServerUrl = `http://localhost:${tursoDevPort}`;
        tursoLibSQLiteServerTeardown = async function () {
          await new Promise(function (resolve) {
            serverProcess.on('exit', resolve);
            serverProcess.kill();
          });
        };
        resolve(undefined);
      }
    });
  });

  afterEach(async function teardownTursoLibSQLiteServer() {
    if (typeof tursoLibSQLiteServerTeardown === 'function') {
      await tursoLibSQLiteServerTeardown();
    }
  });

  return function getTursoLibSQLiteServer() {
    return {
      url: tursoLibSQLiteServerUrl,
    };
  };
}

/** @param {number} port */
async function waitForTursoSQLiteServerReady(port) {
  const url = `http://localhost:${port}/health`;
  while (true) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(500),
      });
      if (response.ok) return;
    }
    catch (error) {
      // console.warn(`Waiting for Turso LibSQLite server at ${url}...`);
    }
  }
}

async function findAvailablePort() {
  while (true) {
    const randomPort = Math.round(10000 + (Math.random() * 50000));
    if (await checkPortAvailability(randomPort)) return randomPort;
  }
}

/**
 * @param {number} port
 * @returns {Promise<boolean>}
 */
async function checkPortAvailability(port) {
  return new Promise(function (resolve) {
    const server = createServer();
    server.once('listening', function () {
      server.removeAllListeners();
      server.close(function (error) {
        if (error) resolve(false);
        else resolve(true);
      });
    });
    server.once('error', function () {
      server.removeAllListeners();
      server.close(function () {
        resolve(false);
      });
    });
    server.listen(port);
  });
}
