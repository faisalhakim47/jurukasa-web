import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';

const test = jurukasaTest;
const { describe } = test;

/**
 * @param {string} tursoDatabaseUrl
 */
async function setupView(tursoDatabaseUrl) {
  window.history.replaceState({}, '', '/books/chart-of-accounts');
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
          <device-context>
            <i18n-context>
              <chart-of-accounts-view></chart-of-accounts-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Chart of Accounts View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('view Chart of Accounts page with accounts table and column headers', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    const table = page.getByRole('treegrid', { name: 'Chart of Accounts Tree' });
    await expect(table, 'it shall display accounts table').toBeVisible();

    await expect(table.getByRole('columnheader', { name: 'Code' }), 'it shall display Code column header').toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Name' }), 'it shall display Name column header').toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Type' }), 'it shall display Type column header').toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Normal' }), 'it shall display Normal column header').toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Balance' }), 'it shall display Balance column header').toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Status' }), 'it shall display Status column header').toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Kind' }), 'it shall display Kind column header').toBeVisible();

    await expect(table.getByText('10000'), 'it shall display account code from template').toBeVisible();
    await expect(table.getByText('Aset'), 'it shall display account name from template').toBeVisible();
  });

  test('view filter controls and open Type filter menu', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('textbox', { name: 'Search' }), 'it shall display search input field').toBeVisible();
    await expect(page.getByRole('button', { name: 'Type' }), 'it shall display Type filter dropdown button').toBeVisible();
    await expect(page.getByRole('button', { name: 'Status' }), 'it shall display Status filter dropdown button').toBeVisible();

    await page.getByRole('button', { name: 'Type' }).click();

    await expect(page.getByRole('menu', { name: 'Account Type Filter' }), 'it shall open Type filter menu when clicked').toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'All' }), 'it shall display All option in Type filter menu').toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Asset' }), 'it shall display Asset option in Type filter menu').toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Liability' }), 'it shall display Liability option in Type filter menu').toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Equity' }), 'it shall display Equity option in Type filter menu').toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Revenue' }), 'it shall display Revenue option in Type filter menu').toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Expense' }), 'it shall display Expense option in Type filter menu').toBeVisible();
  });

  test('open Status filter menu', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Status' }).click();

    await expect(page.getByRole('menu'), 'it shall open Status filter menu when clicked').toBeVisible();
    await expect(page.getByRole('menuitemradio', { name: 'All' }), 'it shall display All option in Status filter menu').toBeVisible();
    await expect(page.getByRole('menuitemradio', { name: 'Active', exact: true }), 'it shall display Active option in Status filter menu').toBeVisible();
    await expect(page.getByRole('menuitemradio', { name: 'Inactive' }), 'it shall display Inactive option in Status filter menu').toBeVisible();
  });

  test('filter accounts by type and search query', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO account_tags (account_code, tag) VALUES (11110, 'Asset')`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Type' }).click();
    await page.getByRole('menuitem', { name: 'Asset' }).click();

    const table = page.getByRole('treegrid', { name: 'Chart of Accounts Tree' });
    const emptyState = page.getByText('No accounts found');
    await expect(table.or(emptyState), 'it shall display either table or empty state after type filter').toBeVisible();

    const searchInput = page.getByRole('textbox', { name: 'Search' });
    await searchInput.fill('Kas');

    await expect(table, 'it shall display table after search filter').toBeVisible();
  });

  test('expand and collapse all accounts flow', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('button', { name: 'Expand All' }), 'it shall display expand all button').toBeVisible();
    await expect(page.getByRole('button', { name: 'Collapse All' }), 'it shall display collapse all button').toBeVisible();

    await page.getByRole('button', { name: 'Expand All' }).click();

    const table = page.getByRole('treegrid', { name: 'Chart of Accounts Tree' });
    await expect(table, 'it shall display treegrid after expanding all accounts').toBeVisible();

    await page.getByRole('button', { name: 'Collapse All' }).click();

    await expect(table, 'it shall display treegrid after collapsing all accounts').toBeVisible();
  });

  test('refresh accounts and open account creation dialog flow', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('button', { name: 'Refresh' }), 'it shall display refresh button').toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' }), 'it shall display Create Account button').toBeVisible();

    await page.getByRole('button', { name: 'Refresh' }).click();

    const table = page.getByRole('treegrid', { name: 'Chart of Accounts Tree' });
    await expect(table, 'it shall refresh accounts list when refresh button is clicked').toBeVisible();

    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByRole('dialog', { name: 'Create New Account' }), 'it shall open account creation dialog when Create Account button is clicked').toBeVisible();
  });

  test('view account creation form and cancel flow', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Create Account' }).click();

    const dialog = page.getByRole('dialog', { name: 'Create New Account' });
    await expect(dialog.getByLabel('Account Code'), 'it shall display Account Code input field').toBeVisible();
    await expect(dialog.getByLabel('Account Name'), 'it shall display Account Name input field').toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Create Account' }), 'it shall display Create Account submit button').toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' }), 'it shall display Cancel button').toBeVisible();

    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(dialog, 'it shall close dialog when Cancel button is clicked').not.toBeVisible();
  });

  test('view accounts table after loading', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('treegrid', { name: 'Chart of Accounts Tree' }), 'it shall show accounts table after loading').toBeVisible();
  });
});
