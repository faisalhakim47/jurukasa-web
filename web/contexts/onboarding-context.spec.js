/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */
/** @import { OnboardingContextElement } from '#web/contexts/onboarding-context.js' */

import { expect, test } from '@playwright/test';
import { loadEmptyFixture } from '#test/tools/fixture.js';
import { setupDatabase } from '#test/tools/database.js';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';

const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupContext(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" turso-url=${tursoDatabaseUrl}>
          <device-context>
            <i18n-context>
              <onboarding-context>
                <p>Application Ready</p>
              </onboarding-context>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Onboarding Context', function () {
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall expose needs-business-config state when database is empty', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupContext, tursoLibSQLiteServer().url);

    // Context should render slot content (no guard UI)
    await expect(page.getByText('Application Ready')).toBeVisible();

    // Check onboarding state
    const state = await page.evaluate(async function () {
      await customElements.whenDefined('onboarding-context');
      /** @type {OnboardingContextElement} */
      const onboarding = document.querySelector('onboarding-context');
      // Wait for state evaluation
      await new Promise(resolve => setTimeout(resolve, 200));
      return {
        state: onboarding.state,
        needsOnboarding: onboarding.needsOnboarding,
        isComplete: onboarding.isComplete,
      };
    });

    expect(state.state).toBe('needs-business-config');
    expect(state.needsOnboarding).toBe(true);
    expect(state.isComplete).toBe(false);
  });

  test('it shall expose needs-database state when database is unconfigured', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(function () {
      // Don't set any database URL
      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <onboarding-context>
                    <p>Slot Content</p>
                  </onboarding-context>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    });

    await expect(page.getByText('Slot Content')).toBeVisible();

    const state = await page.evaluate(async function () {
      await customElements.whenDefined('onboarding-context');
      /** @type {OnboardingContextElement} */
      const onboarding = document.querySelector('onboarding-context');
      // Wait for state evaluation
      await new Promise(resolve => setTimeout(resolve, 200));
      return {
        state: onboarding.state,
        needsOnboarding: onboarding.needsOnboarding,
        isComplete: onboarding.isComplete,
      };
    });

    expect(state.state).toBe('needs-database');
    expect(state.needsOnboarding).toBe(true);
    expect(state.isComplete).toBe(false);
  });

  test('it shall expose complete state when business and accounts are configured', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`UPDATE config SET value = ${'Configured Store'} WHERE key = 'Business Name'`;
      }),
    ]);

    await page.evaluate(setupContext, tursoLibSQLiteServer().url);

    await expect(page.getByText('Application Ready')).toBeVisible();

    const state = await page.evaluate(async function () {
      await customElements.whenDefined('onboarding-context');
      /** @type {OnboardingContextElement} */
      const onboarding = document.querySelector('onboarding-context');
      // Wait for state evaluation
      await new Promise(resolve => setTimeout(resolve, 200));
      return {
        state: onboarding.state,
        needsOnboarding: onboarding.needsOnboarding,
        isComplete: onboarding.isComplete,
      };
    });

    expect(state.state).toBe('complete');
    expect(state.needsOnboarding).toBe(false);
    expect(state.isComplete).toBe(true);
  });
});
