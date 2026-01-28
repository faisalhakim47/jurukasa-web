import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const test = jurukasaTest;
const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
          <device-context>
            <i18n-context>
              <accounting-configuration-view></accounting-configuration-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Accounting Configuration View', function () {
  // useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display accounting configuration form', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' })).toBeVisible();
    await expect(page.getByLabel('Business Name')).toBeVisible();
    await expect(page.getByLabel('Business Type')).toBeVisible();
    await expect(page.getByLabel('Currency Code')).toBeVisible();
    await expect(page.getByLabel('Currency Decimals')).toBeVisible();
    await expect(page.getByLabel('Fiscal Year Start Month')).toBeVisible();
    await expect(page.getByLabel('Language')).toBeVisible();
    await expect(page.getByLabel('Locale')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
  });

  test('it shall load existing configuration from database', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`UPDATE config SET value = 'Test Business' WHERE key = 'Business Name'`;
        await sql`UPDATE config SET value = 'Small Business' WHERE key = 'Business Type'`;
        await sql`UPDATE config SET value = 'USD' WHERE key = 'Currency Code'`;
        await sql`UPDATE config SET value = '2' WHERE key = 'Currency Decimals'`;
        await sql`UPDATE config SET value = '1' WHERE key = 'Fiscal Year Start Month'`;
        await sql`UPDATE config SET value = 'en' WHERE key = 'Language'`;
        await sql`UPDATE config SET value = 'en-US' WHERE key = 'Locale'`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' })).toBeVisible();

    await expect(page.getByLabel('Business Name')).toHaveValue('Test Business');
    await expect(page.getByLabel('Business Type')).toHaveValue('Small Business');
    await expect(page.getByLabel('Currency Code')).toHaveValue('USD');
    await expect(page.getByLabel('Currency Decimals')).toHaveValue('2');
    await expect(page.getByLabel('Fiscal Year Start Month')).toHaveValue('1');
    await expect(page.getByLabel('Language')).toHaveValue('English');
    await expect(page.getByLabel('Locale')).toHaveValue('en-US');
  });

  test('it shall save configuration changes', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' })).toBeVisible();

    await page.getByLabel('Business Name').fill('My New Business');
    await page.getByLabel('Currency Code').fill('IDR');
    await page.getByLabel('Currency Decimals').fill('0');
    await page.getByLabel('Fiscal Year Start Month').fill('7');
    await page.getByLabel('Locale').fill('id-ID');

    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByRole('dialog', { name: 'Settings Saved' })).toBeVisible();
    await expect(page.getByText('Configuration has been updated successfully.')).toBeVisible();

    const configs = await page.evaluate(async function fetchConfigs() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      const result = await database.sql`
        SELECT key, value
        FROM config
        WHERE key IN ('Business Name', 'Currency Code', 'Currency Decimals', 'Fiscal Year Start Month', 'Locale')
      `;
      return Object.fromEntries(result.rows.map(row => [row.key, row.value]));
    });

    expect(configs['Business Name']).toBe('My New Business');
    expect(configs['Currency Code']).toBe('IDR');
    expect(configs['Currency Decimals']).toBe('0');
    expect(configs['Fiscal Year Start Month']).toBe('7');
    expect(configs['Locale']).toBe('id-ID');
  });

  test('it shall allow selecting business type from dropdown', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' })).toBeVisible();

    await page.getByLabel('Business Type').click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.getByRole('menuitem', { name: 'Medium Enterprise' }).click();

    await expect(page.getByLabel('Business Type')).toHaveValue('Medium Enterprise');

    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByRole('dialog', { name: 'Settings Saved' })).toBeVisible();

    const businessType = await page.evaluate(async function fetchBusinessType() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      const result = await database.sql`SELECT value FROM config WHERE key = 'Business Type'`;
      return String(result.rows[0]?.value || '');
    });

    expect(businessType).toBe('Medium Enterprise');
  });

  test('it shall allow selecting all business types', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' })).toBeVisible();

    const businessTypes = ['Small Business', 'Medium Enterprise', 'Corporation', 'Non-Profit'];

    for (const businessType of businessTypes) {
      await page.getByLabel('Business Type').click();
      await page.getByRole('menuitem', { name: businessType }).click();
      await expect(page.getByLabel('Business Type')).toHaveValue(businessType);
    }
  });

  test('it shall allow selecting language from dropdown', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' })).toBeVisible();

    await page.getByLabel('Language').click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.getByRole('menuitem', { name: 'Bahasa Indonesia' }).click();

    await expect(page.getByLabel('Language')).toHaveValue('Bahasa Indonesia');

    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByRole('dialog', { name: 'Settings Saved' })).toBeVisible();

    const language = await page.evaluate(async function fetchLanguage() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      const result = await database.sql`SELECT value FROM config WHERE key = 'Language'`;
      return String(result.rows[0]?.value || '');
    });

    expect(language).toBe('id');
  });

  test('it shall reset form when reset button is clicked', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`UPDATE config SET value = 'Original Business' WHERE key = 'Business Name'`;
        await sql`UPDATE config SET value = 'EUR' WHERE key = 'Currency Code'`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' })).toBeVisible();
    await expect(page.getByLabel('Business Name')).toHaveValue('Original Business');

    await page.getByLabel('Business Name').fill('Modified Business');
    await page.getByLabel('Currency Code').fill('JPY');

    await expect(page.getByLabel('Business Name')).toHaveValue('Modified Business');
    await expect(page.getByLabel('Currency Code')).toHaveValue('JPY');

    await page.getByRole('button', { name: 'Reset' }).click();

    await expect(page.getByLabel('Business Name')).toHaveValue('Original Business');
    await expect(page.getByLabel('Currency Code')).toHaveValue('EUR');
  });

  test('it shall refresh configuration when refresh button is clicked', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`UPDATE config SET value = 'Initial Business' WHERE key = 'Business Name'`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' })).toBeVisible();
    await expect(page.getByLabel('Business Name')).toHaveValue('Initial Business');

    await page.evaluate(async function updateBusinessName() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      await database.sql`UPDATE config SET value = 'Updated Business' WHERE key = 'Business Name'`;
    });

    await page.getByRole('button', { name: 'Refresh' }).click();

    await expect(page.getByLabel('Business Name')).toHaveValue('Updated Business');
  });

  test('it shall display error when configuration fails to load', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function setupErrorScenario(tursoDatabaseUrl) {
      // Set up contexts first (without the view)
      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context provider="turso" name="My Business" turso-url="${tursoDatabaseUrl}">
              <device-context>
                <i18n-context></i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;

      // Wait for database to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Drop the config table
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      await database.sql`DROP TABLE config`;

      // Now add the view
      const i18nContext = document.querySelector('i18n-context');
      i18nContext.innerHTML = '<accounting-configuration-view></accounting-configuration-view>';
    }, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Unable to load data' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  test('it shall display error dialog when save fails', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function setupSaveErrorScenario(tursoDatabaseUrl) {
      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
              <device-context>
                <i18n-context>
                  <accounting-configuration-view></accounting-configuration-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' })).toBeVisible();

    await page.getByLabel('Business Name').fill('Test');

    await page.evaluate(async function simulateCorruptedSchema() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      await database.sql`DROP TABLE config`;
    });

    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Error Occurred' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();
  });

  test('it shall validate currency decimals range', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' })).toBeVisible();

    await expect(page.getByLabel('Currency Decimals')).toHaveAttribute('min', '0');
    await expect(page.getByLabel('Currency Decimals')).toHaveAttribute('max', '4');
  });

  test('it shall validate fiscal year start month range', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' })).toBeVisible();

    await expect(page.getByLabel('Fiscal Year Start Month')).toHaveAttribute('min', '1');
    await expect(page.getByLabel('Fiscal Year Start Month')).toHaveAttribute('max', '12');
  });

  test('it shall persist configuration across all fields', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' })).toBeVisible();

    await page.getByLabel('Business Name').fill('Complete Test Business');

    await page.getByLabel('Business Type').click();
    await page.getByRole('menuitem', { name: 'Corporation' }).click();

    await page.getByLabel('Currency Code').fill('GBP');
    await page.getByLabel('Currency Decimals').fill('2');
    await page.getByLabel('Fiscal Year Start Month').fill('4');

    await page.getByLabel('Language').click();
    await page.getByRole('menuitem', { name: 'English' }).click();

    await page.getByLabel('Locale').fill('en-GB');

    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByRole('dialog', { name: 'Settings Saved' })).toBeVisible();

    const configs = await page.evaluate(async function fetchAllConfigs() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      const result = await database.sql`
        SELECT key, value
        FROM config
        WHERE key IN ('Business Name', 'Business Type', 'Currency Code', 'Currency Decimals', 'Fiscal Year Start Month', 'Language', 'Locale')
      `;
      return Object.fromEntries(result.rows.map(row => [row.key, row.value]));
    });

    expect(configs['Business Name']).toBe('Complete Test Business');
    expect(configs['Business Type']).toBe('Corporation');
    expect(configs['Currency Code']).toBe('GBP');
    expect(configs['Currency Decimals']).toBe('2');
    expect(configs['Fiscal Year Start Month']).toBe('4');
    expect(configs['Language']).toBe('en');
    expect(configs['Locale']).toBe('en-GB');
  });
});
