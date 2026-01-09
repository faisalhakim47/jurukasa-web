/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

import { expect, test } from '@playwright/test';
import { loadEmptyFixture } from '#test/tools/fixture.js';
import { setupDatabase } from '#test/tools/database.js';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';

const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupContext(tursoDatabaseUrl) {
  localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
  localStorage.setItem('tursoDatabaseKey', '');
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context>
          <device-context>
            <i18n-context>
              <onboarding-context>
                <p>Application Ready</p>
              </onboarding-context>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Onboarding Context', function () {
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall show business configuration dialog when database is empty', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupContext, tursoLibSQLiteServer().url);

    await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
    await expect(page.getByLabel('Business Name')).toBeVisible();
    await expect(page.getByLabel('Business Type')).toHaveValue('Small Business');
    await expect(page.getByLabel('Currency Code')).toHaveValue('IDR');
    await expect(page.getByLabel('Currency Decimals')).toHaveValue('0');
    await expect(page.getByLabel('Locale')).toHaveValue('en-ID');
    await expect(page.getByLabel('Language')).toHaveValue('English');
    await expect(page.getByLabel('Fiscal Year Start Month')).toHaveValue('1');
  });

  test('it shall require business name', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupContext, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
    await expect(page.getByLabel('Business Name')).toBeFocused();
  });

  test('it shall save business configuration and show chart of accounts selection', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupContext, tursoLibSQLiteServer().url);

    await page.getByLabel('Business Name').fill('My Awesome Store');
    await page.getByLabel('Business Type').fill('Retail Shop');
    await page.getByLabel('Currency Code').fill('USD');
    await page.getByLabel('Currency Decimals').fill('2');
    await page.getByLabel('Locale').fill('en-US');
    await page.getByLabel('Fiscal Year Start Month').fill('1');

    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('dialog', { name: 'Chart of Accounts' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Retail Business - Indonesia' })).toBeVisible();
  });

  test('it shall allow language selection', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupContext, tursoLibSQLiteServer().url);

    await expect(page.getByLabel('Language')).toHaveValue('English');

    await page.getByLabel('Language').click();

    const languageMenu = page.locator('#language-menu');
    await expect(languageMenu).toBeVisible();

    await languageMenu.getByRole('menuitem', { name: 'Bahasa Indonesia' }).click();

    await expect(page.getByLabel('Language')).toHaveValue('Bahasa Indonesia');
  });

  test('it shall require chart of accounts template selection', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupContext, tursoLibSQLiteServer().url);

    await page.getByLabel('Business Name').fill('Test Store');
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('dialog', { name: 'Chart of Accounts' })).toBeVisible();

    await page.getByRole('button', { name: 'Finish' }).click();

    await expect(page.getByRole('dialog', { name: 'Chart of Accounts' })).toBeVisible();
  });

  test('it shall complete onboarding and render application content', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupContext, tursoLibSQLiteServer().url);

    await page.getByLabel('Business Name').fill('My Awesome Store');
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByRole('radio', { name: 'Retail Business - Indonesia' }).check();
    await page.getByRole('button', { name: 'Finish' }).click();

    await expect(page.getByText('Application Ready')).toBeVisible();
  });



  test('it shall skip onboarding when business and chart of accounts are configured', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`UPDATE config SET value = ${'Configured Store'} WHERE key = 'Business Name'`;
      }),
    ]);

    await page.evaluate(setupContext, tursoLibSQLiteServer().url);

    await expect(page.getByText('Application Ready')).toBeVisible();
  });



  test('it shall handle configuration error gracefully', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function setupFaultyContext(tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');
      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <onboarding-context>
                    <p>Application Ready</p>
                  </onboarding-context>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;

      await customElements.whenDefined('database-context');
      /** @type {DatabaseContextElement} */
      const databaseContext = document.querySelector('database-context');
      const originalSql = databaseContext.sql.bind(databaseContext);
      databaseContext.sql = async function faultyQuery(query, ...params) {
        const sql = String(query);
        if (sql.includes('config')) throw new Error('Simulated database error');
        return originalSql(query, ...params);
      };
    }, tursoLibSQLiteServer().url);

    await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
  });

  test('it shall validate fiscal year start month range', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupContext, tursoLibSQLiteServer().url);

    await page.getByLabel('Business Name').fill('Test Store');
    await page.getByLabel('Fiscal Year Start Month').fill('13');

    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
    await expect(page.getByLabel('Fiscal Year Start Month')).toBeFocused();
  });

  test('it shall prefill default business configuration values', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupContext, tursoLibSQLiteServer().url);

    await expect(page.getByLabel('Business Type')).toHaveValue('Small Business');
    await expect(page.getByLabel('Currency Code')).toHaveValue('IDR');
    await expect(page.getByLabel('Currency Decimals')).toHaveValue('0');
    await expect(page.getByLabel('Locale')).toHaveValue('en-ID');
    await expect(page.getByLabel('Fiscal Year Start Month')).toHaveValue('1');
  });

  test('it shall show chart of accounts selection after business configuration', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupContext, tursoLibSQLiteServer().url);

    await page.getByLabel('Business Name').fill('New Store');
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('dialog', { name: 'Chart of Accounts' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Retail Business - Indonesia' })).toBeVisible();
  });

  test('it shall persist business configuration in database', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupContext, tursoLibSQLiteServer().url);

    await page.getByLabel('Business Name').fill('Persisted Store');
    await page.getByLabel('Business Type').fill('Restaurant');
    await page.getByLabel('Currency Code').fill('USD');
    await page.getByLabel('Currency Decimals').fill('2');
    await page.getByLabel('Locale').fill('en-US');
    await page.getByLabel('Fiscal Year Start Month').fill('7');

    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('dialog', { name: 'Chart of Accounts' })).toBeVisible();

    const config = await page.evaluate(async function checkDatabase() {
      /** @type {import('#web/contexts/database-context.js').DatabaseContextElement} */
      const databaseContext = document.querySelector('database-context');
      const result = await databaseContext.sql`SELECT key, value FROM config WHERE key IN (
        'Business Name', 'Business Type', 'Currency Code', 'Currency Decimals', 'Locale', 'Fiscal Year Start Month'
      )`;
      return Object.fromEntries(result.rows.map(row => [row.key, row.value]));
    });

    expect(config['Business Name']).toBe('Persisted Store');
    expect(config['Business Type']).toBe('Restaurant');
    expect(config['Currency Code']).toBe('USD');
    expect(config['Currency Decimals']).toBe('2');
    expect(config['Locale']).toBe('en-US');
    expect(config['Fiscal Year Start Month']).toBe('7');
  });
});
