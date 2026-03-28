import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';

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

describe('Procurement View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('shall display procurement view with Purchases tab selected by default', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('link', { name: 'Procure' }).click();

    await expect(page.getByRole('heading', { name: 'Procurement' }), 'it shall display Procurement heading').toBeVisible();
    await expect(page.getByRole('tab', { name: 'Purchases' }), 'it shall display Purchases tab as selected by default').toHaveAttribute('aria-selected', 'true');
  });

  test('shall display empty purchases state with action buttons', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('link', { name: 'Procure' }).click();

    await expect(page.getByRole('heading', { name: 'No purchases found' }), 'it shall display empty state heading').toBeVisible();
    await expect(page.getByText('Start by recording your first purchase to track inventory costs.'), 'it shall display empty state description').toBeVisible();

    const purchasesPanel = page.getByRole('tabpanel', { name: 'Purchases' });
    await expect(purchasesPanel.getByRole('button', { name: 'New Purchase' }), 'it shall display New Purchase buttons in header and empty state').toHaveCount(2);
    await expect(purchasesPanel.getByLabel('Status'), 'it shall display status filter').toBeVisible();
    await expect(purchasesPanel.getByRole('button', { name: 'Refresh purchases' }), 'it shall display refresh button').toBeVisible();
  });

  test('shall navigate to purchase creation view and display form fields', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('link', { name: 'Procure' }).click();

    const purchasesPanel = page.getByRole('tabpanel', { name: 'Purchases' });
    await purchasesPanel.getByRole('button', { name: 'New Purchase' }).filter({ hasText: 'New Purchase' }).first().click();

    await expect(page.getByRole('heading', { name: 'New Purchase' }), 'it shall display New Purchase heading').toBeVisible();
    await expect(page.getByLabel('Purchase Date'), 'it shall display purchase date field').toBeVisible();
    await expect(page.getByRole('button', { name: 'Select Supplier' }), 'it shall display supplier selector button').toBeVisible();
  });

  test('shall navigate back to purchases list when clicking Cancel button', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('link', { name: 'Procure' }).click();

    const purchasesPanel = page.getByRole('tabpanel', { name: 'Purchases' });
    await purchasesPanel.getByRole('button', { name: 'New Purchase' }).filter({ hasText: 'New Purchase' }).first().click();

    await expect(page.getByRole('heading', { name: 'New Purchase' }), 'it shall display New Purchase heading before cancel').toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('heading', { name: 'No purchases found' }), 'it shall return to purchases list after cancel').toBeVisible();
  });
});
