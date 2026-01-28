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

describe('Reconciliation', function () {
  // useConsoleOutput(test);
  useStrict(test);

  describe('Reconciliation Navigation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Reconciliation heading when navigating to reconciliation', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Reconcile' }).click();

      await expect(page.getByRole('heading', { name: 'Reconciliation', level: 1 })).toBeVisible();
    });

    test('shall show Account Reconciliation tab as selected by default', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Reconcile' }).click();

      await expect(page.getByRole('tab', { name: 'Account Reconciliation' })).toHaveAttribute('aria-selected', 'true');
    });

    test('shall switch to Cash Count tab when clicked', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Reconcile' }).click();
      await page.getByRole('tab', { name: 'Cash Count' }).click();

      await expect(page.getByRole('tab', { name: 'Cash Count' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { name: 'Cash Count', level: 2 })).toBeVisible();
    });
  });

  describe('Account Reconciliation List', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display empty state when no reconciliations exist', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Reconcile' }).click();

      const accountReconciliationPanel = page.getByRole('tabpanel', { name: 'Account Reconciliation' });
      await expect(accountReconciliationPanel.getByRole('heading', { name: 'No Reconciliations Found' })).toBeVisible();
      await expect(accountReconciliationPanel.getByText('No reconciliation sessions have been created yet.')).toBeVisible();
    });

    test('shall display Create Reconciliation button in empty state', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Reconcile' }).click();

      const accountReconciliationPanel = page.getByRole('tabpanel', { name: 'Account Reconciliation' });
      // one in header
      await expect(accountReconciliationPanel.getByRole('button', { name: 'Create Reconciliation' })).toHaveCount(1);
    });

    test('shall have search field', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Reconcile' }).click();

      const accountReconciliationPanel = page.getByRole('tabpanel', { name: 'Account Reconciliation' });
      await expect(accountReconciliationPanel.getByRole('textbox', { name: 'Search' })).toBeVisible();
    });

    test('shall have status filter', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Reconcile' }).click();

      const accountReconciliationPanel = page.getByRole('tabpanel', { name: 'Account Reconciliation' });
      await expect(accountReconciliationPanel.getByRole('button', { name: 'All' })).toBeVisible();
    });

    test('shall show TODO message when clicking Create Reconciliation', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Reconcile' }).click();

      const accountReconciliationPanel = page.getByRole('tabpanel', { name: 'Account Reconciliation' });
      
      page.on('dialog', async function (dialog) {
        expect(dialog.message()).toContain('TODO');
        await dialog.accept();
      });
      
      await accountReconciliationPanel.getByRole('button', { name: 'Create Reconciliation' }).first().click();
    });
  });

  describe('Cash Count Tab', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display cash count list view', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Reconcile' }).click();
      await page.getByRole('tab', { name: 'Cash Count' }).click();

      // Should show cash count list view with empty state (no cash counts yet)
      await expect(page.getByRole('heading', { name: 'No Cash Counts Found', level: 2 })).toBeVisible();
    });
  });
});
