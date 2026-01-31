import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';

const test = jurukasaTest;
const { describe } = test;

/** @param {string} tursoDatabaseUrl */
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

describe('Financial Reports - Refactored View', function () {
  useConsoleOutput(test);
  useStrict(test);

  describe('Financial Reports Display', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display empty state when no reports exist', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'No reports generated' })).toBeVisible();
      await expect(page.getByText('Generate a new balance report to view trial balance and balance sheet.')).toBeVisible();
    });

    test('shall display table of generated reports when reports exist', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO balance_reports (report_time, report_type, name, create_time) VALUES (1704067200000, 'Ad Hoc', 'Test Report', 1704067200000)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('table', { name: 'Generated balance reports' })).toBeVisible();
    });

    test('shall display Generate Report button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Generate Report' })).toBeVisible();
    });

    test('shall display Refresh button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
    });
  });

  describe('Report Generation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall generate new report when clicking Generate Report button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).click();

      await expect(page.getByRole('dialog', { name: 'Generate Balance Report' })).toBeVisible();
    });

    test('shall add report to table after generation', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();

      const dateTimeInput = page.getByLabel('Report Date & Time', { exact: true });
      await dateTimeInput.fill('2025-01-15T00:00');

      await page.getByRole('dialog', { name: 'Generate Balance Report' }).getByRole('button', { name: 'Generate Report' }).click();

      await expect(page.getByRole('table', { name: 'Generated balance reports' })).toBeVisible();
    });
  });

  describe('Report Actions', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display View Trial Balance action for each report', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO balance_reports (report_time, report_type, name, create_time) VALUES (1704067200000, 'Ad Hoc', 'Test Report 1', 1704067200000)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Trial Balance' })).toBeVisible();
    });

    test('shall display View Balance Sheet action for each report', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO balance_reports (report_time, report_type, name, create_time) VALUES (1704067200000, 'Ad Hoc', 'Test Report 1', 1704067200000)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Balance Sheet' })).toBeVisible();
    });


  });

  describe('Report Table Columns', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display report name column', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO balance_reports (report_time, report_type, name, create_time) VALUES (1704067200000, 'Ad Hoc', 'Test Report 1', 1704067200000)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('columnheader', { name: 'Report Name' })).toBeVisible();
    });

    test('shall display report date column', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO balance_reports (report_time, report_type, name, create_time) VALUES (1704067200000, 'Ad Hoc', 'Test Report 1', 1704067200000)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('columnheader', { name: 'Report Date' })).toBeVisible();
    });

    test('shall display snapshot date column', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO balance_reports (report_time, report_type, name, create_time) VALUES (1704067200000, 'Ad Hoc', 'Test Report 1', 1704067200000)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('columnheader', { name: 'Snapshot Date' })).toBeVisible();
    });

    test('shall display type column', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO balance_reports (report_time, report_type, name, create_time) VALUES (1704067200000, 'Ad Hoc', 'Test Report 1', 1704067200000)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible();
    });

    test('shall display actions column', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO balance_reports (report_time, report_type, name, create_time) VALUES (1704067200000, 'Ad Hoc', 'Test Report 1', 1704067200000)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
    });
  });
});
