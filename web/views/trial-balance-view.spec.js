import { expect } from '@playwright/test';
import { createClient } from '@libsql/client';
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
 * @param {number} [reportId=1]
 */
async function setupView(tursoDatabaseUrl, reportId = 1) {
  window.history.replaceState({}, '', `/books/reports/trial-balance?reportId=${reportId}`);
  document.body.innerHTML = `
    <ready-context>
      <time-context>
        <router-context>
          <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
            <device-context>
              <i18n-context>
                <trial-balance-view></trial-balance-view>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      </time-context>
    </ready-context>
  `;
}

/**
 * @param {string} url
 * @returns {Promise<number>}
 */
async function getReportId(url) {
  const client = createClient({ url });
  const result = await client.execute(`SELECT id FROM balance_reports WHERE name = 'Test Report'`);
  await client.close();
  return Number(result.rows[0].id);
}

describe('Trial Balance View', function () {
  useConsoleOutput(test);
  useStrict(test);

  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('shall display error state when report does not exist', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(function setupViewImpl(tursoDatabaseUrl) {
      window.history.replaceState({}, '', '/books/reports/trial-balance?reportId=1');
      document.body.innerHTML = `
        <ready-context>
          <time-context>
            <router-context>
              <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
                <device-context>
                  <i18n-context>
                    <trial-balance-view></trial-balance-view>
                  </i18n-context>
                </device-context>
              </database-context>
            </router-context>
          </time-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Unable to load reports' })).toBeVisible();
  });

  test('shall display refresh button', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });

  test('shall display trial balance table with valid report', async function ({ page }) {
    await loadEmptyFixture(page);
    await setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
      await sql`INSERT INTO accounts (account_code, name, normal_balance, balance, is_active, is_posting_account, create_time, update_time) VALUES (11001, 'Cash', 0, 100000, 1, 1, 1704067200000, 1704067200000)`;
      await sql`INSERT INTO accounts (account_code, name, normal_balance, balance, is_active, is_posting_account, create_time, update_time) VALUES (31001, 'Sales Revenue', 1, 50000, 1, 1, 1704067200000, 1704067200000)`;
      await sql`INSERT INTO account_tags (account_code, tag) VALUES (11001, 'Balance Sheet - Current Asset')`;
      await sql`INSERT INTO account_tags (account_code, tag) VALUES (31001, 'Income Statement - Revenue')`;
      await sql`INSERT INTO balance_reports (report_time, report_type, name, create_time) VALUES (1704067200000, 'Ad Hoc', 'Test Report', 1704067200000)`;
    });
    const reportId = await getReportId(tursoLibSQLiteServer().url);

    await page.evaluate(function setupViewWithReportId(args) {
      window.history.replaceState({}, '', `/books/reports/trial-balance?reportId=${args.id}`);
      document.body.innerHTML = `
        <ready-context>
          <time-context>
            <router-context>
              <database-context provider="turso" name="My Business" turso-url=${args.url}>
                <device-context>
                  <i18n-context>
                    <trial-balance-view></trial-balance-view>
                  </i18n-context>
                </device-context>
              </database-context>
            </router-context>
          </time-context>
        </ready-context>
      `;
    }, { url: tursoLibSQLiteServer().url, id: reportId });

    await expect(page.getByRole('table', { name: 'Trial Balance' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Code' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Account Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Normal' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Debit' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Credit' })).toBeVisible();
  });

  test('shall display account codes in table', async function ({ page }) {
    await loadEmptyFixture(page);
    await setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
      await sql`INSERT INTO accounts (account_code, name, normal_balance, balance, is_active, is_posting_account, create_time, update_time) VALUES (11001, 'Cash', 0, 100000, 1, 1, 1704067200000, 1704067200000)`;
      await sql`INSERT INTO account_tags (account_code, tag) VALUES (11001, 'Balance Sheet - Current Asset')`;
      await sql`INSERT INTO balance_reports (report_time, report_type, name, create_time) VALUES (1704067200000, 'Ad Hoc', 'Test Report', 1704067200000)`;
    });
    const reportId = await getReportId(tursoLibSQLiteServer().url);

    await page.evaluate(function setupViewWithReportId(args) {
      window.history.replaceState({}, '', `/books/reports/trial-balance?reportId=${args.id}`);
      document.body.innerHTML = `
        <ready-context>
          <time-context>
            <router-context>
              <database-context provider="turso" name="My Business" turso-url=${args.url}>
                <device-context>
                  <i18n-context>
                    <trial-balance-view></trial-balance-view>
                  </i18n-context>
                </device-context>
              </database-context>
            </router-context>
          </time-context>
        </ready-context>
      `;
    }, { url: tursoLibSQLiteServer().url, id: reportId });

    await expect(page.getByText('11001')).toBeVisible();
  });

  test('shall display total row', async function ({ page }) {
    await loadEmptyFixture(page);
    await setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
      await sql`INSERT INTO accounts (account_code, name, normal_balance, balance, is_active, is_posting_account, create_time, update_time) VALUES (11001, 'Cash', 0, 100000, 1, 1, 1704067200000, 1704067200000)`;
      await sql`INSERT INTO account_tags (account_code, tag) VALUES (11001, 'Balance Sheet - Current Asset')`;
      await sql`INSERT INTO balance_reports (report_time, report_type, name, create_time) VALUES (1704067200000, 'Ad Hoc', 'Test Report', 1704067200000)`;
    });
    const reportId = await getReportId(tursoLibSQLiteServer().url);

    await page.evaluate(function setupViewWithReportId(args) {
      window.history.replaceState({}, '', `/books/reports/trial-balance?reportId=${args.id}`);
      document.body.innerHTML = `
        <ready-context>
          <time-context>
            <router-context>
              <database-context provider="turso" name="My Business" turso-url=${args.url}>
                <device-context>
                  <i18n-context>
                    <trial-balance-view></trial-balance-view>
                  </i18n-context>
                </device-context>
              </database-context>
            </router-context>
          </time-context>
        </ready-context>
      `;
    }, { url: tursoLibSQLiteServer().url, id: reportId });

    await expect(page.getByRole('row').filter({ hasText: 'Total' })).toBeVisible();
  });
});
