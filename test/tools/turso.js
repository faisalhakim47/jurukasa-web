import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createClient } from '@libsql/client';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdir, rm } from 'node:fs/promises';

/**
 * @param {{ authToken?: string }} [config]
 * @returns {Promise<{ url: string, teardown: function():Promise<void> }>}
 */
export async function startTursoLibSQLiteServer(config) {
  return await new Promise(async function spawnTursoProcess(resolve, reject) {
    let settled = true;

    if (typeof config?.authToken === 'string') {
      throw new Error('authToken config on TursoLibSQLiteServer is not implemented yet. Require cryptographic key. The key is either a PKCS#8-encoded Ed25519 public key in PEM, or just plain bytes of the Ed25519 public key in URL-safe base64.');
    }

    const tursoDevPort = await findAvailablePort();
    const tursoDevDir = join(tmpdir(), `jurukasa-test-${tursoDevPort}-${Date.now()}`);
    await rm(tursoDevDir, { recursive: true, force: true });
    await mkdir(tursoDevDir, { recursive: true });
    const tursoDevPath = join(tursoDevDir, 'database.sqlite');
    const tursoProcess = spawn('sqld', [
      '--no-welcome',
      ...['--http-listen-addr', `0.0.0.0:${tursoDevPort.toString()}`],
      ...['--db-path', tursoDevPath],
      ...(typeof config?.authToken === 'string' ? ['--auth-jwt-key-file', config?.authToken] : []),
    ]);

    /** @param {string} message */
    function rejectWithMessage(message) {
      if (settled) {
        settled = false;
        reject(new Error(`turso spawn exit: ${message}`));
      }
    }

    tursoProcess.stderr.addListener('data', function tursoProcessStderr(data) {
      rejectWithMessage(data.toString());
    });

    await waitForTursoSQLiteServerReady(tursoDevPort);

    if (settled) {
      settled = false;
      resolve({
        url: `http://127.0.0.1:${tursoDevPort}`,
        async teardown() {
          await rm(tursoDevDir, { force: true, recursive: true });
          await new Promise(function stopTursoProcess(resolve) {
            tursoProcess.on('exit', function tursoProcessExited() {
              resolve();
            });
            if (tursoProcess.stdout) tursoProcess.stdout.destroy();
            if (tursoProcess.stderr) tursoProcess.stderr.destroy();
            if (tursoProcess.stdin) tursoProcess.stdin.destroy();
            tursoProcess.kill('SIGKILL');
            tursoProcess.kill('SIGTERM');
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
      return;
    }
    catch { /** We can safely ignore it. */ }
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
