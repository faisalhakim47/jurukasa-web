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

  let tursoLibSQLiteServer = /** @type {Awaited<ReturnType<startTursoLibSQLiteServer>>} */ (undefined);

  beforeEach(async function setupTursoLibSQLiteServer() {
    const maxRetries = 5;
    let attempt = 0;
    while (true) {
      try {
        tursoLibSQLiteServer = await startTursoLibSQLiteServer();
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

/**
 * @returns {Promise<{ url: string, teardown: () => Promise<void> }>}
 */
async function startTursoLibSQLiteServer() {
  return await new Promise(async function spawnTursoProcess(resolve, reject) {
    let settled = true;

    const tursoDevPort = await findAvailablePort();
    const tursoProcess = spawn('turso', ['dev', '--port', tursoDevPort.toString()]);

    /** @param {string} message */
    function rejectWithMessage(message) {
      if (settled) {
        settled = false;
        reject(new Error(`turso spawn exit: ${message}`));
      };
    };

    tursoProcess.on('error', function handleProcessError(error) {
      rejectWithMessage(error?.message);
    });

    tursoProcess.on('exit', function handleProcessExit(code, signal) {
      rejectWithMessage(`code ${code} and signal ${signal}`);
    });

    tursoProcess.stderr.on('data', function handleProcessData(data) {
      rejectWithMessage(data.toString());
    });

    await waitForTursoSQLiteServerReady(tursoDevPort);

    if (settled) {
      settled = false;
      resolve({
        url: `http://localhost:${tursoDevPort}`,
        async teardown() {
          await new Promise(function stopTursoProcess(resolve) {
            tursoProcess.on('exit', resolve);
            tursoProcess.kill();
          });
        },
      });
    }
  });
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
  return new Promise(function checkByServer(resolve) {
    const server = createServer();
    server.once('listening', function handleListening() {
      server.removeAllListeners();
      server.close(function handleClose(error) {
        if (error) resolve(false);
        else resolve(true);
      });
    });
    server.once('error', function handleError() {
      server.removeAllListeners();
      server.close(function handleClose() {
        resolve(false);
      });
    });
    server.listen(port);
  });
}
