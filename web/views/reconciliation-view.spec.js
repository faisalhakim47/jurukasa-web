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
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('navigate to reconciliation and display Account Reconciliation tab by default', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('link', { name: 'Reconcile' }).click();

    await expect(page.getByRole('heading', { name: 'Reconciliation', level: 1 }), 'it shall display Reconciliation heading').toBeVisible();
    await expect(page.getByRole('tab', { name: 'Account Reconciliation' }), 'it shall display Account Reconciliation tab').toHaveAttribute('aria-selected', 'true');
  });

  test('switch to Cash Count tab and display cash count list view', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('link', { name: 'Reconcile' }).click();
    await page.getByRole('tab', { name: 'Cash Count' }).click();

    await expect(page.getByRole('tab', { name: 'Cash Count' }), 'it shall select Cash Count tab').toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Cash Count', level: 2 }), 'it shall display Cash Count heading').toBeVisible();
    await expect(page.getByRole('heading', { name: 'No Cash Counts Found', level: 2 }), 'it shall display empty state for cash counts').toBeVisible();
  });

  test('display empty state with search and status filter when no reconciliations exist', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('link', { name: 'Reconcile' }).click();

    const accountReconciliationPanel = page.getByRole('tabpanel', { name: 'Account Reconciliation' });
    await expect(accountReconciliationPanel.getByRole('heading', { name: 'No Reconciliations Found' }), 'it shall display "No Reconciliations Found" heading').toBeVisible();
    await expect(accountReconciliationPanel.getByText('No reconciliation sessions have been created yet.'), 'it shall display empty state message').toBeVisible();
    await expect(accountReconciliationPanel.getByRole('button', { name: 'Create Reconciliation' }), 'it shall display Create Reconciliation buttons (toolbar + empty state)').toHaveCount(2);
    await expect(accountReconciliationPanel.getByRole('textbox', { name: 'Search' }), 'it shall display search field').toBeVisible();
    await expect(accountReconciliationPanel.getByRole('button', { name: 'All' }), 'it shall display status filter').toBeVisible();
  });

  test('show TODO message when clicking Create Reconciliation button', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('link', { name: 'Reconcile' }).click();

    const accountReconciliationPanel = page.getByRole('tabpanel', { name: 'Account Reconciliation' });
    
    page.on('dialog', async function (dialog) {
      expect(dialog.message(), 'it shall display TODO message in dialog').toContain('TODO');
      await dialog.accept();
    });
    
    await accountReconciliationPanel.getByRole('button', { name: 'Create Reconciliation' }).first().click();
  });
});
