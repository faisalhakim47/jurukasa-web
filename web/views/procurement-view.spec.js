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

describe('Procurement', function () {
  // useConsoleOutput(test);
  useStrict(test);

  describe('Procurement Navigation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Procurement heading when navigating to procurement', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Procure' }).click();

      await expect(page.getByRole('heading', { name: 'Procurement' })).toBeVisible();
    });

    test('shall show Purchases tab as selected by default', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Procure' }).click();

      await page.pause();

      await expect(page.getByRole('tab', { name: 'Purchases' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Purchases List', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display empty state when no purchases exist', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Procure' }).click();

      await expect(page.getByRole('heading', { name: 'No purchases found' })).toBeVisible();
      await expect(page.getByText('Start by recording your first purchase to track inventory costs.')).toBeVisible();
    });

    test('shall display New Purchase button in empty state', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Procure' }).click();

      const purchasesPanel = page.getByRole('tabpanel', { name: 'Purchases' });
      // one in header, one in empty state
      await expect(purchasesPanel.getByRole('button', { name: 'New Purchase' })).toHaveCount(2);
    });

    test('shall have status filter', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Procure' }).click();

      const purchasesPanel = page.getByRole('tabpanel', { name: 'Purchases' });
      await expect(purchasesPanel.getByLabel('Status')).toBeVisible();
    });

    test('shall have refresh button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Procure' }).click();

      const purchasesPanel = page.getByRole('tabpanel', { name: 'Purchases' });
      await expect(purchasesPanel.getByRole('button', { name: 'Refresh purchases' })).toBeVisible();
    });
  });

  describe('Purchase Creation View', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall navigate to purchase creation view when clicking New Purchase button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Procure' }).click();

      const purchasesPanel = page.getByRole('tabpanel', { name: 'Purchases' });
      await purchasesPanel.getByRole('button', { name: 'New Purchase' }).filter({ hasText: 'New Purchase' }).first().click();

      await expect(page.getByRole('heading', { name: 'New Purchase' })).toBeVisible();
    });

    test('shall display purchase date field in creation view', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Procure' }).click();

      const purchasesPanel = page.getByRole('tabpanel', { name: 'Purchases' });
      await purchasesPanel.getByRole('button', { name: 'New Purchase' }).filter({ hasText: 'New Purchase' }).first().click();

      await expect(page.getByLabel('Purchase Date')).toBeVisible();
    });

    test('shall display supplier selector button in creation view', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Procure' }).click();

      const purchasesPanel = page.getByRole('tabpanel', { name: 'Purchases' });
      await purchasesPanel.getByRole('button', { name: 'New Purchase' }).filter({ hasText: 'New Purchase' }).first().click();

      await expect(page.getByRole('button', { name: 'Select Supplier' })).toBeVisible();
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

      await page.getByRole('button', { name: 'Cancel' }).click();

      await expect(page.getByRole('heading', { name: 'No purchases found' })).toBeVisible();
    });
  });
});
