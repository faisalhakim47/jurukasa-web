import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';

const test = jurukasaTest;
const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <font-context>
        <time-context>
          <router-context>
            <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
              <device-context>
                <i18n-context>
                  <main-view></main-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </time-context>
      </font-context>
    </ready-context>
  `;
}

describe('Desktop View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('view navigation rail with all navigation links', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    const nav = page.getByRole('navigation', { name: 'Main Navigation' });
    await expect(nav, 'it shall display main navigation rail').toBeVisible();
    await expect(nav.getByRole('link', { name: 'Dash' }).first(), 'it shall display Dashboard navigation link').toBeVisible();
    await expect(nav.getByRole('link', { name: 'Books' }).first(), 'it shall display Books navigation link').toBeVisible();
    await expect(nav.getByRole('link', { name: 'Stock' }).first(), 'it shall display Stock navigation link').toBeVisible();
    await expect(nav.getByRole('link', { name: 'Procure' }).first(), 'it shall display Procure navigation link').toBeVisible();
    await expect(nav.getByRole('link', { name: 'Sale' }).first(), 'it shall display Sale navigation link').toBeVisible();
    await expect(nav.getByRole('link', { name: 'Settings' }).first(), 'it shall display Settings navigation link').toBeVisible();
  });

  test('navigate through all main sections', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    const nav = page.getByRole('navigation', { name: 'Main Navigation' });

    await nav.getByRole('link', { name: 'Books' }).first().click();
    await expect(page.getByRole('heading', { name: 'Accounting' }), 'it shall navigate to Accounting page').toBeVisible();

    await nav.getByRole('link', { name: 'Stock' }).first().click();
    await expect(page.getByRole('heading', { name: 'Stock' }), 'it shall navigate to Stock page').toBeVisible();

    await nav.getByRole('link', { name: 'Procure' }).first().click();
    await expect(page.getByRole('heading', { name: 'Procurement' }), 'it shall navigate to Procurement page').toBeVisible();

    await nav.getByRole('link', { name: 'Sale' }).first().click();
    await expect(page.getByRole('heading', { name: 'Sales' }), 'it shall navigate to Sales page').toBeVisible();

    await nav.getByRole('link', { name: 'Settings' }).first().click();
    await expect(page.getByRole('heading', { name: 'Settings' }), 'it shall navigate to Settings page').toBeVisible();

    await nav.getByRole('link', { name: 'Dash' }).first().click();
    await expect(page.getByRole('heading', { name: 'Dashboard' }), 'it shall navigate back to Dashboard page').toBeVisible();
  });

  test('verify active navigation indicator on different pages', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    const nav = page.getByRole('navigation', { name: 'Main Navigation' });
    const dashboardLink = nav.getByRole('link', { name: 'Dash' }).first();
    await expect(dashboardLink, 'it shall mark Dashboard link as active on dashboard').toHaveAttribute('aria-current', 'page');

    await nav.getByRole('link', { name: 'Books' }).first().click();
    await expect(page.getByRole('heading', { name: 'Accounting' }), 'it shall display Accounting heading').toBeVisible();
    const booksLink = nav.getByRole('link', { name: 'Books' }).first();
    await expect(booksLink, 'it shall mark Books link as active on books page').toHaveClass(/active/);

    await nav.getByRole('link', { name: 'Settings' }).first().click();
    await expect(page.getByRole('heading', { name: 'Settings' }), 'it shall display Settings heading').toBeVisible();
    const settingsLink = nav.getByRole('link', { name: 'Settings' }).first();
    await expect(settingsLink, 'it shall mark Settings link as active on settings page').toHaveClass(/active/);
  });

  test('view layout structure with navigation and content area', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('navigation', { name: 'Main Navigation' }), 'it shall display navigation rail on the side').toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dashboard' }), 'it shall display main content area with Dashboard').toBeVisible();
  });

  test('redirect from root to dashboard', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Dashboard' }), 'it shall redirect to Dashboard from root').toBeVisible();
  });
});
