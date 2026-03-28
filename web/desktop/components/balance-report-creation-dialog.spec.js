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

  test('open dialog and display all form fields with helper text', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Generate Report' }).first().click();

    await expect(page.getByRole('dialog', { name: 'Generate Balance Report' }), 'it shall display Generate Balance Report dialog').toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Report Name' }), 'it shall display report name input field').toBeVisible();
    await expect(page.getByLabel('Report Date & Time', { exact: true }), 'it shall display report date and time input field').toBeVisible();
    await expect(page.getByRole('button', { name: 'Close dialog' }), 'it shall display close button').toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Generate Report' }), 'it shall display generate button in dialog').toBeVisible();
    await expect(page.getByText('Optional name to identify this report'), 'it shall display report name helper text').toBeVisible();
    await expect(page.getByText('The date and time to snapshot the account balances'), 'it shall display report date time helper text').toBeVisible();
  });

  test('create balance report with default date time and close dialog', async function ({ page }) {
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

    await expect(page.getByRole('dialog', { name: 'Generate Balance Report' }), 'it shall close dialog after successful generation').not.toBeVisible();
    await expect(page.getByRole('table', { name: 'Generated balance reports' }), 'it shall display generated balance reports table').toBeVisible();
  });

  test('create balance report with custom name and display in table', async function ({ page }) {
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

    await expect(page.getByText('Monthly Report - January 2025'), 'it shall display custom report name in table').toBeVisible();
  });

  test('create balance report with custom date time', async function ({ page }) {
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

    await expect(page.getByRole('table', { name: 'Generated balance reports' }), 'it shall display generated balance reports table with custom date').toBeVisible();
  });

  test('dismiss error alert dialog when validation fails', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Generate Report' }).first().click();

    // Remove required attribute and clear the datetime input to trigger validation error
    // Empty string will cause new Date('').getTime() to return NaN
    const dateTimeInput = page.getByLabel('Report Date & Time', { exact: true });
    await dateTimeInput.evaluate(function removeRequiredAndClear(el) {
      el.removeAttribute('required');
      el.value = '';
    });

    await page.getByRole('dialog').getByRole('button', { name: 'Generate Report' }).click();

    await expect(page.getByRole('alertdialog'), 'it shall display error alert dialog').toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Dismiss' }).click();

    await expect(page.getByRole('alertdialog'), 'it shall dismiss error alert dialog').not.toBeVisible();
  });

  test('close error dialog when epoch date is entered', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Generate Report' }).first().click();

    // Enter epoch date (1970-01-01) which has timestamp 0, triggering validation error
    const dateTimeInput = page.getByLabel('Report Date & Time', { exact: true });
    await dateTimeInput.fill('1970-01-01T00:00');

    await page.getByRole('dialog').getByRole('button', { name: 'Generate Report' }).click();

    await expect(page.getByRole('alertdialog'), 'it shall display error alert dialog').toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Dismiss' }).click();

    await expect(page.getByRole('alertdialog'), 'it shall close error dialog on dismiss click').not.toBeVisible();
  });
});
