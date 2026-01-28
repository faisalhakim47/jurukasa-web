import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
/** @import { Protocol } from '../../node_modules/playwright-core/types/protocol.d.ts' */
/** @import { ReadyContextElement } from '#web/contexts/ready-context.js' */
/** @import { ServiceWorkerContextElement } from '#web/contexts/service-worker-context.js' */

const test = jurukasaTest;
const { describe } = test;

async function setupView() {
  const { waitForEvent } = await import('#web/tools/dom.js');
  const readyContext = document.createElement('ready-context');
  const serviceWorkerContext = document.createElement('service-worker-context');
  readyContext.appendChild(serviceWorkerContext);
  document.body.append(readyContext);
  const event = await waitForEvent(readyContext, 'ready-context:ready', 500000);
  if (event instanceof CustomEvent) { /** page ready */ }
  else throw new Error(`Invalid event type ${event}`);
}

describe('Service Worker Context', function () {
  // useConsoleOutput(test);
  useStrict(test);

  test('service worker strategy overview', async function ({ context }) {
    const firstPage = await context.newPage();

    const cdp = await context.newCDPSession(firstPage);

    await cdp.send('ServiceWorker.enable');
    let swVersion = /** @type {Protocol.ServiceWorker.ServiceWorkerVersion} */ (undefined);
    /** @param {Protocol.ServiceWorker.workerVersionUpdatedPayload} event */
    function watchOverServiceWorker(event) {
      if (swVersion) return;
      const activatedVersion = event.versions.find(function activeSw(version) {
        return version.runningStatus === 'running'
          && version.status === 'activated';
      });
      if (activatedVersion) {
        cdp.removeListener('ServiceWorker.workerVersionUpdated', watchOverServiceWorker);
        swVersion = activatedVersion;
      }
    }
    cdp.addListener('ServiceWorker.workerVersionUpdated', watchOverServiceWorker);

    cdp.addListener('ServiceWorker.workerVersionUpdated', async function debugLog(event) {
      for (const version of event.versions) {
        // console.debug('workerVersionUpdated', version.versionId, version.runningStatus, version.status, version.registrationId);
      }
    });

    await loadEmptyFixture(firstPage);
    await firstPage.evaluate(setupView);

    expect(swVersion.controlledClients.length, { message: 'service worker shall not handle the client who initiate it.' }).toBe(0);

    await Promise.all([
      new Promise(function waitForServiceWorkerStop(resolve, reject) {
        /** @param {Protocol.ServiceWorker.workerVersionUpdatedPayload} event */
        function versionUpdateListener(event) {
          const targetedServiceWorker = event.versions.find(function byId(version) {
            return version.versionId === swVersion.versionId;
          });
          if (targetedServiceWorker?.runningStatus === 'stopped') {
            cdp.removeListener('ServiceWorker.workerVersionUpdated', versionUpdateListener);
            clearTimeout(timeout);
            resolve();
          }
        }
        cdp.addListener('ServiceWorker.workerVersionUpdated', versionUpdateListener);
        const timeout = setTimeout(function versionWaiterTimeout() {
          cdp.removeListener('ServiceWorker.workerVersionUpdated', versionUpdateListener);
          reject(new Error('Service Worker stop command timeout.'));
        }, 5000);
      }),
      cdp.send('ServiceWorker.stopWorker', swVersion),
    ]);

    await firstPage.close();

    // console.debug('PAGE 2');
    const secondPage = await context.newPage();
    await loadEmptyFixture(secondPage);
    await secondPage.evaluate(setupView);
    await secondPage.close();

    // console.debug('PAGE 3');
    const thirdPage = await context.newPage();
    await loadEmptyFixture(thirdPage);
    await thirdPage.pause();
    await thirdPage.evaluate(setupView);
    await thirdPage.pause();
    await thirdPage.close();
  });
});
