import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
/** @import { DevServerConfig } from '@web/dev-server' */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const workspaceUuid = randomUUID();

/** @type {DevServerConfig} */
export default {
  appIndex: 'index.html',
  middleware: [
    function opfsHeaders(context, next) {
      context.set('Cross-Origin-Opener-Policy', 'same-origin');
      context.set('Cross-Origin-Embedder-Policy', 'require-corp');
      return next();
    },
    function wellKnownAppSpecificChromeDevtools(context, next) {
      if (context.path === '/.well-known/appspecific/com.chrome.devtools.json') {
        context.type = 'application/json';
        context.body = JSON.stringify({
          workspace: {
            root: join(__dirname),
            uuid: workspaceUuid,
          },
        });
      }
      return next();
    },
  ],
};
