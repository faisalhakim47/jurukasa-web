import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { env, stderr, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type TestSetup = {
  appUrl: string;
  teardown(): Promise<void>;
  enableAppLogging(): void;
  disableAppLogging(): void;
};

export async function setup(): Promise<TestSetup> {
  const randomHttpPort = 10000 + Math.round(10000 * Math.random());
  let appLoggingEnabled = env.APP_LOG_ENABLED === '1';

  const appTeardown = await new Promise<() => Promise<void>>(function (resolve, reject) {
    let resolvable = true;

    const appProcess = spawn('npm', ['start'], {
      cwd: join(__dirname, '../..'),
      env: {
        ...env,
        HTTP_PORT: randomHttpPort.toString(),
      },
    });

    let appStdout = '';
    let appStderr = '';

    appProcess.stdout.addListener('data', function (raw) {
      const data = raw instanceof Buffer ? raw.toString() : String(raw);
      appStdout += data + '\n';
      if (appLoggingEnabled) stdout.write(raw);
      if (data.includes('App is ready')) {
        if (resolvable) {
          resolvable = false;
          resolve(async function () {
            appProcess.kill();
          });
        }
      }
    });

    appProcess.stderr.addListener('data', function (raw) {
      const data = raw instanceof Buffer ? raw.toString() : String(raw);
      appStderr += data + '\n';
      if (appLoggingEnabled) stderr.write(data);
      if (resolvable) {
        resolvable = false;
        reject(data);
        appProcess.kill();
      }
    });

    setTimeout(function () {
      if (resolvable) {
        resolvable = false;
        reject(new Error('App must be ready in under 5 seconds'));
        appProcess.kill();
      }
    }, 5000);
  });

  return {
    appUrl: `http://localhost:${randomHttpPort}`,
    enableAppLogging() {
      appLoggingEnabled = true;
    },
    disableAppLogging() {
      appLoggingEnabled = false;
    },
    async teardown() {
      await appTeardown();
    },
  };
}
