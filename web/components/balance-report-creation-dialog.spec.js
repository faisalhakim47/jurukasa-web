import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';

const test = jurukasaTest;
const { describe } = test;

/**
 * @param {string} tursoDatabaseUrl
 */
async function setupView(tursoDatabaseUrl) {
  window.history.replaceState({}, '', '/books/reports');
  document.body.innerHTML = `
    <ready-context>
      <time-context>
        <router-context>
          <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
            <device-context>
              <i18n-context>
                <books-view></books-view>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      </time-context>
    </ready-context>
  `;
}

describe('Balance Report Creation Dialog', function () {
  useConsoleOutput(test);
  useStrict(test);

  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  describe('Dialog Display', function () {
    test('shall display Generate Balance Report dialog when clicking Generate Report button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();

      await expect(page.getByRole('dialog', { name: 'Generate Balance Report' })).toBeVisible();
    });

    test('shall display report name input field', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();

      await expect(page.getByRole('textbox', { name: 'Report Name' })).toBeVisible();
    });

    test('shall display report date & time input field', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();

      await expect(page.getByLabel('Report Date & Time', { exact: true })).toBeVisible();
    });

    test('shall display close button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();

      await expect(page.getByRole('button', { name: 'Close dialog' })).toBeVisible();
    });

    test('shall display generate button in dialog', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();

      const generateButton = page.getByRole('dialog').getByRole('button', { name: 'Generate Report' });
      await expect(generateButton).toBeVisible();
    });
  });

  describe('Report Generation', function () {
    test('shall create new balance report with default date time', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO accounts (account_code, name, normal_balance, balance, is_active, is_posting_account, create_time, update_time) VALUES (11001, 'Cash', 0, 100000, 1, 1, 1704067200000, 1704067200000)`;
          await sql`INSERT INTO account_tags (account_code, tag) VALUES (11001, 'Balance Sheet - Current Asset')`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();

      await page.getByRole('dialog').getByRole('button', { name: 'Generate Report' }).click();

      await expect(page.getByRole('table', { name: 'Generated balance reports' })).toBeVisible();
    });

    test('shall create new balance report with custom name', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO accounts (account_code, name, normal_balance, balance, is_active, is_posting_account, create_time, update_time) VALUES (11001, 'Cash', 0, 100000, 1, 1, 1704067200000, 1704067200000)`;
          await sql`INSERT INTO account_tags (account_code, tag) VALUES (11001, 'Balance Sheet - Current Asset')`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();

      const reportNameInput = page.getByRole('textbox', { name: 'Report Name' });
      await reportNameInput.fill('Monthly Report - January 2025');

      await page.getByRole('dialog').getByRole('button', { name: 'Generate Report' }).click();

      await expect(page.getByText('Monthly Report - January 2025')).toBeVisible();
    });

    test('shall create new balance report with custom date time', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO accounts (account_code, name, normal_balance, balance, is_active, is_posting_account, create_time, update_time) VALUES (11001, 'Cash', 0, 100000, 1, 1, 1704067200000, 1704067200000)`;
          await sql`INSERT INTO account_tags (account_code, tag) VALUES (11001, 'Balance Sheet - Current Asset')`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();

      const dateTimeInput = page.getByLabel('Report Date & Time', { exact: true });
      await dateTimeInput.fill('2025-01-15T00:00');

      await page.getByRole('dialog').getByRole('button', { name: 'Generate Report' }).click();

      await expect(page.getByRole('table', { name: 'Generated balance reports' })).toBeVisible();
    });

    test('shall close dialog after successful generation', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO accounts (account_code, name, normal_balance, balance, is_active, is_posting_account, create_time, update_time) VALUES (11001, 'Cash', 0, 100000, 1, 1, 1704067200000, 1704067200000)`;
          await sql`INSERT INTO account_tags (account_code, tag) VALUES (11001, 'Balance Sheet - Current Asset')`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();

      await page.getByRole('dialog').getByRole('button', { name: 'Generate Report' }).click();

      await expect(page.getByRole('dialog', { name: 'Generate Balance Report' })).not.toBeVisible();
    });

    test('shall refresh reports table after generation', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO accounts (account_code, name, normal_balance, balance, is_active, is_posting_account, create_time, update_time) VALUES (11001, 'Cash', 0, 100000, 1, 1, 1704067200000, 1704067200000)`;
          await sql`INSERT INTO account_tags (account_code, tag) VALUES (11001, 'Balance Sheet - Current Asset')`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();

      await page.getByRole('dialog').getByRole('button', { name: 'Generate Report' }).click();

      await expect(page.getByRole('table', { name: 'Generated balance reports' })).toBeVisible();
    });
  });

  describe('Error Handling', function () {
    test('shall dismiss error alert dialog on dismiss click', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();

      await page.getByLabel('Report Date & Time', { exact: true }).clear();

      await page.getByRole('dialog').getByRole('button', { name: 'Generate Report' }).click();

      await page.getByRole('alertdialog').getByRole('button', { name: 'Dismiss' }).click();

      await expect(page.getByRole('alertdialog')).not.toBeVisible();
    });

    test('shall close error dialog on dismiss click', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();

      const dateTimeInput = page.getByLabel('Report Date & Time', { exact: true });
      await dateTimeInput.fill('invalid-date');

      await page.getByRole('button', { name: 'Generate Report' }).filter({ has: page.locator('dialog') }).click();

      await page.getByRole('button', { name: 'Dismiss' }).click();

      await expect(page.getByRole('alertdialog')).not.toBeVisible();
    });
  });

  describe('Helper Text', function () {
    test('shall display report name helper text', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();

      const helperText = page.getByText('Optional name to identify this report');
      await expect(helperText).toBeVisible();
    });

    test('shall display report date time helper text', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();

      const helperText = page.getByText('The date and time to snapshot the account balances');
      await expect(helperText).toBeVisible();
    });
  });
});
