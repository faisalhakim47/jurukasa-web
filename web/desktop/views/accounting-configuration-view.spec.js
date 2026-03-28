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

async function setupErrorScenario(tursoDatabaseUrl) {
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

  await new Promise(resolve => setTimeout(resolve, 100));

  /** @type {DatabaseContextElement} */
  const database = document.querySelector('database-context');
  await database.sql`DROP TABLE config`;

  const i18nContext = document.querySelector('i18n-context');
  i18nContext.innerHTML = '<accounting-configuration-view></accounting-configuration-view>';
}

async function setupSaveErrorScenario(tursoDatabaseUrl) {
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

describe('Accounting Configuration', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('displays configuration form with all fields', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' }), 'it shall display configuration heading').toBeVisible();
    await expect(page.getByLabel('Business Name'), 'it shall display Business Name field').toBeVisible();
    await expect(page.getByLabel('Business Type'), 'it shall display Business Type field').toBeVisible();
    await expect(page.getByLabel('Currency Code'), 'it shall display Currency Code field').toBeVisible();
    await expect(page.getByLabel('Currency Decimals'), 'it shall display Currency Decimals field').toBeVisible();
    await expect(page.getByLabel('Fiscal Year Start Month'), 'it shall display Fiscal Year Start Month field').toBeVisible();
    await expect(page.getByLabel('Language'), 'it shall display Language field').toBeVisible();
    await expect(page.getByLabel('Locale'), 'it shall display Locale field').toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Changes' }), 'it shall display Save Changes button').toBeVisible();
  });

  test('loads existing configuration from database', async function ({ page }) {
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

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' }), 'it shall display configuration heading').toBeVisible();
    await expect(page.getByLabel('Business Name'), 'it shall load Business Name value').toHaveValue('Test Business');
    await expect(page.getByLabel('Business Type'), 'it shall load Business Type value').toHaveValue('Small Business');
    await expect(page.getByLabel('Currency Code'), 'it shall load Currency Code value').toHaveValue('USD');
    await expect(page.getByLabel('Currency Decimals'), 'it shall load Currency Decimals value').toHaveValue('2');
    await expect(page.getByLabel('Fiscal Year Start Month'), 'it shall load Fiscal Year Start Month value').toHaveValue('1');
    await expect(page.getByLabel('Language'), 'it shall load Language value').toHaveValue('English');
    await expect(page.getByLabel('Locale'), 'it shall load Locale value').toHaveValue('en-US');
  });

  test('saves configuration changes to database', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' }), 'it shall display configuration heading').toBeVisible();

    await page.getByLabel('Business Name').fill('My New Business');
    await page.getByLabel('Currency Code').fill('IDR');
    await page.getByLabel('Currency Decimals').fill('0');
    await page.getByLabel('Fiscal Year Start Month').fill('7');
    await page.getByLabel('Locale').fill('id-ID');

    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByRole('dialog', { name: 'Settings Saved' }), 'it shall display success dialog').toBeVisible();
    await expect(page.getByText('Configuration has been updated successfully.'), 'it shall display success message').toBeVisible();

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

    expect(configs['Business Name'], 'Business Name shall be saved').toBe('My New Business');
    expect(configs['Currency Code'], 'Currency Code shall be saved').toBe('IDR');
    expect(configs['Currency Decimals'], 'Currency Decimals shall be saved').toBe('0');
    expect(configs['Fiscal Year Start Month'], 'Fiscal Year Start Month shall be saved').toBe('7');
    expect(configs['Locale'], 'Locale shall be saved').toBe('id-ID');
  });

  test('allows selecting business type from dropdown', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' }), 'it shall display configuration heading').toBeVisible();

    await page.getByLabel('Business Type').click();
    await expect(page.getByRole('menu'), 'it shall open business type dropdown').toBeVisible();
    await page.getByRole('menuitem', { name: 'Medium Enterprise' }).click();

    await expect(page.getByLabel('Business Type'), 'it shall update Business Type value').toHaveValue('Medium Enterprise');

    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByRole('dialog', { name: 'Settings Saved' }), 'it shall display success dialog').toBeVisible();

    const businessType = await page.evaluate(async function fetchBusinessType() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      const result = await database.sql`SELECT value FROM config WHERE key = 'Business Type'`;
      return String(result.rows[0]?.value || '');
    });

    expect(businessType, 'Business Type shall be persisted').toBe('Medium Enterprise');
  });

  test('allows selecting all business types', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' }), 'it shall display configuration heading').toBeVisible();

    const businessTypes = ['Small Business', 'Medium Enterprise', 'Corporation', 'Non-Profit'];

    for (const businessType of businessTypes) {
      await page.getByLabel('Business Type').click();
      await page.getByRole('menuitem', { name: businessType }).click();
      await expect(page.getByLabel('Business Type'), `it shall allow selecting ${businessType}`).toHaveValue(businessType);
    }
  });

  test('allows selecting language from dropdown', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' }), 'it shall display configuration heading').toBeVisible();

    await page.getByLabel('Language').click();
    await expect(page.getByRole('menu'), 'it shall open language dropdown').toBeVisible();
    await page.getByRole('menuitem', { name: 'Bahasa Indonesia' }).click();

    await expect(page.getByLabel('Language'), 'it shall update Language value').toHaveValue('Bahasa Indonesia');

    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByRole('dialog', { name: 'Settings Saved' }), 'it shall display success dialog').toBeVisible();

    const language = await page.evaluate(async function fetchLanguage() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      const result = await database.sql`SELECT value FROM config WHERE key = 'Language'`;
      return String(result.rows[0]?.value || '');
    });

    expect(language, 'Language shall be persisted').toBe('id');
  });

  test('resets form to original values when reset button is clicked', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`UPDATE config SET value = 'Original Business' WHERE key = 'Business Name'`;
        await sql`UPDATE config SET value = 'EUR' WHERE key = 'Currency Code'`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' }), 'it shall display configuration heading').toBeVisible();
    await expect(page.getByLabel('Business Name'), 'it shall show original Business Name').toHaveValue('Original Business');

    await page.getByLabel('Business Name').fill('Modified Business');
    await page.getByLabel('Currency Code').fill('JPY');

    await expect(page.getByLabel('Business Name'), 'it shall show modified Business Name').toHaveValue('Modified Business');
    await expect(page.getByLabel('Currency Code'), 'it shall show modified Currency Code').toHaveValue('JPY');

    await page.getByRole('button', { name: 'Reset' }).click();

    await expect(page.getByLabel('Business Name'), 'it shall reset Business Name to original').toHaveValue('Original Business');
    await expect(page.getByLabel('Currency Code'), 'it shall reset Currency Code to original').toHaveValue('EUR');
  });

  test('refreshes configuration when refresh button is clicked', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`UPDATE config SET value = 'Initial Business' WHERE key = 'Business Name'`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' }), 'it shall display configuration heading').toBeVisible();
    await expect(page.getByLabel('Business Name'), 'it shall show initial Business Name').toHaveValue('Initial Business');

    await page.evaluate(async function updateBusinessName() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      await database.sql`UPDATE config SET value = 'Updated Business' WHERE key = 'Business Name'`;
    });

    await page.getByRole('button', { name: 'Refresh' }).click();

    await expect(page.getByLabel('Business Name'), 'it shall show updated Business Name after refresh').toHaveValue('Updated Business');
  });

  test('displays error when configuration fails to load', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupErrorScenario, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Unable to load data' }), 'it shall display error heading').toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' }), 'it shall display Retry button').toBeVisible();
  });

  test('displays error dialog when save fails', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupSaveErrorScenario, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' }), 'it shall display configuration heading').toBeVisible();

    await page.getByLabel('Business Name').fill('Test');

    await page.evaluate(async function simulateCorruptedSchema() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      await database.sql`DROP TABLE config`;
    });

    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByRole('alertdialog'), 'it shall display error alert dialog').toBeVisible();
    await expect(page.getByRole('heading', { name: 'Error Occurred' }), 'it shall display error heading').toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss' }), 'it shall display Dismiss button').toBeVisible();
  });

  test('validates currency decimals range', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' }), 'it shall display configuration heading').toBeVisible();

    await expect(page.getByLabel('Currency Decimals'), 'it shall have min attribute of 0').toHaveAttribute('min', '0');
    await expect(page.getByLabel('Currency Decimals'), 'it shall have max attribute of 4').toHaveAttribute('max', '4');
  });

  test('validates fiscal year start month range', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' }), 'it shall display configuration heading').toBeVisible();

    await expect(page.getByLabel('Fiscal Year Start Month'), 'it shall have min attribute of 1').toHaveAttribute('min', '1');
    await expect(page.getByLabel('Fiscal Year Start Month'), 'it shall have max attribute of 12').toHaveAttribute('max', '12');
  });

  test('persists all configuration fields across save', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting Configuration' }), 'it shall display configuration heading').toBeVisible();

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

    await expect(page.getByRole('dialog', { name: 'Settings Saved' }), 'it shall display success dialog').toBeVisible();

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

    expect(configs['Business Name'], 'Business Name shall be persisted').toBe('Complete Test Business');
    expect(configs['Business Type'], 'Business Type shall be persisted').toBe('Corporation');
    expect(configs['Currency Code'], 'Currency Code shall be persisted').toBe('GBP');
    expect(configs['Currency Decimals'], 'Currency Decimals shall be persisted').toBe('2');
    expect(configs['Fiscal Year Start Month'], 'Fiscal Year Start Month shall be persisted').toBe('4');
    expect(configs['Language'], 'Language shall be persisted').toBe('en');
    expect(configs['Locale'], 'Locale shall be persisted').toBe('en-GB');
  });
});
