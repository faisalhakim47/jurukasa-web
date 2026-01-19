import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createClient } from '@libsql/client';
/** @import { test } from '@playwright/test' */

/**
 * @typedef {object} TursoLibSQLiteServerState
 * @property {string} url
 */

/**
 * This hook will spawn clean/empty Turso LibSQLite database server before each test and destroy it after each test.
 *
 * @param {typeof test} test
 * @returns {function(): TursoLibSQLiteServerState}
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
 * @returns {Promise<{ url: string, teardown: function():Promise<void> }>}
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

    // @ts-ignore
    tursoProcess.on('error', function handleProcessError(error) {
      rejectWithMessage(error?.message);
    });

    // @ts-ignore
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
        url: `http://127.0.0.1:${tursoDevPort}`,
        async teardown() {
          await new Promise(function stopTursoProcess(resolve) {
            // @ts-ignore
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
  const url = `http://127.0.0.1:${port}`;
  const maxWait = 5000;
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    try {
      const client = createClient({ url });
      await client.execute('SELECT name FROM sqlite_master LIMIT 1;');
      client.close();
      // console.debug('Turso server is ready at', url);
      return;
    }
    catch(error) {
      // console.debug('Waiting for Turso server to be ready at', url, 'error:', error?.message);
    }
  }
  throw new Error(`Turso server at port ${port} did not become ready within ${maxWait}ms`);
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
    // @ts-ignore
    server.once('listening', function handleListening() {
      // @ts-ignore
      server.removeAllListeners();
      server.close(function handleClose(error) {
        if (error) resolve(false);
        else resolve(true);
      });
    });
    // @ts-ignore
    server.once('error', function handleError() {
      // @ts-ignore
      server.removeAllListeners();
      server.close(function handleClose() {
        resolve(false);
      });
    });
    server.listen(port);
  });
}
