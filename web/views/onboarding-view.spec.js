/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

import { expect } from '@playwright/test';
import { loadDevFixture, loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';

const test = jurukasaTest;
const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupOnboardingView(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <service-worker-context>
        <router-context>
          <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
            <device-context>
              <i18n-context>
                <onboarding-view></onboarding-view>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      </service-worker-context>
    </ready-context>
  `;

  // Navigate to business config step since database is already configured
  /** @type {import('#web/contexts/router-context.js').RouterContextElement} */
  const router = document.querySelector('router-context');
  router.navigate({ pathname: '/onboarding/business', replace: true });
}

/** @param {string} tursoDatabaseUrl */
async function setupOnboardingViewFromWelcome(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <service-worker-context>
        <router-context>
          <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
            <device-context>
              <i18n-context>
                <onboarding-view></onboarding-view>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      </service-worker-context>
    </ready-context>
  `;

  // Stay at welcome step - database is pre-configured but we start from welcome
  /** @type {import('#web/contexts/router-context.js').RouterContextElement} */
  const router = document.querySelector('router-context');
  router.navigate({ pathname: '/onboarding/welcome', replace: true });
}

async function setupOnboardingViewWithoutDatabase() {
  window.history.replaceState({}, '', '/onboarding');
  document.body.innerHTML = `
    <ready-context>
      <service-worker-context>
        <router-context>
          <database-context>
            <device-context>
              <i18n-context>
                <onboarding-view></onboarding-view>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      </service-worker-context>
    </ready-context>
  `;
}

async function setupWithOnboardingRoute() {
  document.body.innerHTML = `
    <ready-context>
      <service-worker-context>
        <router-context>
          <database-context>
            <device-context>
              <i18n-context>
                <onboarding-view></onboarding-view>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      </service-worker-context>
    </ready-context>
  `;

  // Navigate to base onboarding path
  /** @type {import('#web/contexts/router-context.js').RouterContextElement} */
  const router = document.querySelector('router-context');
  router.navigate({ pathname: '/onboarding', replace: true });
}

async function setupWithDatabaseRoute() {
  document.body.innerHTML = `
    <ready-context>
      <service-worker-context>
        <router-context>
          <database-context>
            <device-context>
              <i18n-context>
                <onboarding-view></onboarding-view>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      </service-worker-context>
    </ready-context>
  `;

  /** @type {import('#web/contexts/router-context.js').RouterContextElement} */
  const router = document.querySelector('router-context');
  router.navigate({ pathname: '/onboarding/database', replace: true });
}

describe('Onboarding View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('display welcome step and redirect to it when database is not configured', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupOnboardingViewWithoutDatabase);

    await expect(page.getByRole('dialog', { name: 'Welcome to JuruKasa' }), 'welcome dialog shall be visible').toBeVisible();
    await expect(page.getByRole('button', { name: 'Get Started' }), 'Get Started button shall be visible').toBeVisible();
    await expect(page.getByText('Point of Sale - Process'), 'Point of Sale feature highlight shall be visible').toBeVisible();
    await expect(page.getByText('Inventory Management - Track'), 'Inventory Management feature highlight shall be visible').toBeVisible();
    await expect(page.getByText('Accounting - Follow'), 'Accounting feature highlight shall be visible').toBeVisible();
    await expect(page.getByText('Financial Reports - Generate'), 'Financial Reports feature highlight shall be visible').toBeVisible();

    await page.getByRole('button', { name: 'Get Started' }).click();
    await expect(page.getByRole('dialog', { name: 'Configure Database' }), 'shall navigate to database setup step').toBeVisible();
  });

  test('redirect to welcome step when accessing /onboarding without database', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupWithOnboardingRoute);
    await expect(page.getByRole('dialog', { name: 'Welcome to JuruKasa' }), 'shall redirect to welcome dialog').toBeVisible();
  });

  test('support language selection with realtime update', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupOnboardingViewWithoutDatabase);

    await expect(page.getByRole('dialog', { name: 'Welcome to JuruKasa' }), 'welcome dialog shall be visible in English').toBeVisible();
    await expect(page.getByText('Welcome to JuruKasa'), 'English welcome text shall be visible').toBeVisible();

    await page.getByRole('radio', { name: 'Bahasa Indonesia' }).check();
    await expect(page.getByText('Selamat Datang di JuruKasa'), 'Indonesian welcome text shall be visible after switching language').toBeVisible();

    await page.getByRole('radio', { name: 'English' }).check();
    await expect(page.getByText('Welcome to JuruKasa'), 'English welcome text shall be visible after switching back').toBeVisible();
  });

  test('display database provider selection options', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupWithDatabaseRoute);

    await expect(page.getByRole('radio', { name: 'Local Database' }), 'Local Database radio option shall be visible').toBeVisible();
    await expect(page.getByRole('radio', { name: 'Turso SQLite' }), 'Turso SQLite radio option shall be visible').toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect' }), 'Connect button shall be visible').toBeVisible();
  });

  test('show Turso form fields when Turso provider is selected', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupWithDatabaseRoute);

    await page.getByRole('radio', { name: 'Turso SQLite' }).check();
    await expect(page.getByLabel('Database Name'), 'Database Name field shall be visible for Turso').toBeVisible();
    await expect(page.getByLabel('Database URL'), 'Database URL field shall be visible for Turso').toBeVisible();
    await expect(page.getByLabel('Auth Token'), 'Auth Token field shall be visible for Turso').toBeVisible();
  });

  test('connect using Turso provider and proceed to business config', async function ({ page }) {
    await loadDevFixture(page);

    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.getByRole('radio', { name: 'Turso SQLite' }).check();
    await page.getByLabel('Database Name').fill('Test Turso Database');
    await page.getByLabel('Database URL').fill(tursoLibSQLiteServer().url);
    await page.getByRole('button', { name: 'Connect' }).click();

    await expect(page.getByRole('dialog', { name: 'Configure Business' }), 'shall navigate to business configuration step').toBeVisible();
  });

  test('support back navigation to database setup after Turso connection', async function ({ page }) {
    await loadEmptyFixture(page);
    const dbUrl = tursoLibSQLiteServer().url;
    await page.evaluate(setupOnboardingViewWithoutDatabase);

    await page.getByRole('button', { name: 'Get Started' }).click();
    await expect(page.getByRole('dialog', { name: 'Configure Database' }), 'shall navigate to database setup').toBeVisible();

    await page.getByRole('radio', { name: 'Turso SQLite' }).check();
    await page.getByLabel('Database Name').fill('Test Turso Database');
    await page.getByLabel('Database URL').fill(dbUrl);
    await page.getByRole('button', { name: 'Connect' }).click();
    await expect(page.getByRole('dialog', { name: 'Configure Business' }), 'shall navigate to business config').toBeVisible();

    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Configure Database' }), 'shall navigate back to database setup').toBeVisible();
  });

  test('show database name input when Local Database provider is selected', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupOnboardingViewWithoutDatabase);

    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.getByRole('radio', { name: 'Local Database' }).check();
    await expect(page.getByLabel('Database Name'), 'Database Name field shall be visible for Local Database').toBeVisible();
  });

  test('require database name for Local Database provider', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupOnboardingViewWithoutDatabase);

    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.getByRole('radio', { name: 'Local Database' }).check();
    await page.getByRole('button', { name: 'Connect' }).click();

    await expect(page.getByRole('dialog', { name: 'Configure Database' }), 'shall remain on database setup dialog when name is empty').toBeVisible();
    await expect(page.getByLabel('Database Name'), 'Database Name field shall be focused for input').toBeFocused();
  });

  test('complete full onboarding flow from welcome to dashboard', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupOnboardingViewFromWelcome, tursoLibSQLiteServer().url);

    // Database is already connected, so we get redirected from welcome to business config
    const businessConfigDialog = page.getByRole('dialog', { name: 'Configure Business' });
    await expect(businessConfigDialog, 'shall navigate to business configuration step').toBeVisible();
    await businessConfigDialog.getByLabel('Business Name').fill('My Local Business');
    await businessConfigDialog.getByRole('button', { name: 'Next' }).click();

    const chartOfAccountsDialog = page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' });
    await expect(chartOfAccountsDialog, 'shall navigate to chart of accounts selection step').toBeVisible();
    await chartOfAccountsDialog.getByRole('radio', { name: 'Retail Business - Indonesia' }).check();
    await chartOfAccountsDialog.getByRole('button', { name: 'Finish' }).click();

    // Verify navigation to dashboard route occurred (chart dialog should be gone)
    await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' }), 'chart of accounts dialog shall be closed').not.toBeVisible();
  });

  test('show business configuration dialog with default values when database is empty', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupOnboardingView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('dialog', { name: 'Configure Business' }), 'Configure Business dialog shall be visible').toBeVisible();
    await expect(page.getByLabel('Business Name'), 'Business Name input field shall be visible').toBeVisible();
    await expect(page.getByLabel('Business Type'), 'Business Type shall have default value').toHaveValue('Small Business');
    await expect(page.getByLabel('Currency Code'), 'Currency Code shall have default value').toHaveValue('IDR');
    await expect(page.getByLabel('Currency Decimals'), 'Currency Decimals shall have default value').toHaveValue('0');
    await expect(page.getByLabel('Locale'), 'Locale shall have default value').toHaveValue('en-ID');
    await expect(page.getByLabel('Language'), 'Language shall have default value').toHaveValue('English');
    await expect(page.getByLabel('Fiscal Year Start Month'), 'Fiscal Year Start Month shall have default value').toHaveValue('1');
  });

  test('require business name before proceeding', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupOnboardingView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('dialog', { name: 'Configure Business' }), 'shall remain on business config dialog when name is empty').toBeVisible();
    await expect(page.getByLabel('Business Name'), 'Business Name field shall be focused for input').toBeFocused();
  });

  test('save business configuration and proceed to chart of accounts selection', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupOnboardingView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('dialog', { name: 'Configure Business' }), 'Configure Business dialog shall be visible').toBeVisible();
    await page.getByLabel('Business Name').fill('My Awesome Store');
    await page.getByLabel('Business Type').clear();
    await page.getByLabel('Business Type').fill('Retail Shop');
    await page.getByLabel('Currency Code').clear();
    await page.getByLabel('Currency Code').fill('USD');
    await page.getByLabel('Currency Decimals').clear();
    await page.getByLabel('Currency Decimals').fill('2');
    await page.getByLabel('Locale').clear();
    await page.getByLabel('Locale').fill('en-US');
    await page.getByLabel('Fiscal Year Start Month').clear();
    await page.getByLabel('Fiscal Year Start Month').fill('1');
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' }), 'shall navigate to chart of accounts selection step').toBeVisible();
  });

  test('support back navigation from chart of accounts to business config with persisted values', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupOnboardingView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('dialog', { name: 'Configure Business' }), 'Configure Business dialog shall be visible').toBeVisible();
    await page.getByLabel('Business Name').fill('My Awesome Store');
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' }), 'shall navigate to chart of accounts step').toBeVisible();
    await page.goBack();

    await expect(page.getByRole('dialog', { name: 'Configure Business' }), 'shall navigate back to business config dialog').toBeVisible();
    await expect(page.getByLabel('Business Name'), 'Business Name value shall persist after navigation').toHaveValue('My Awesome Store');
  });

  test('allow language selection in business configuration', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupOnboardingView, tursoLibSQLiteServer().url);

    const dialog = page.getByRole('dialog', { name: 'Configure Business' });
    await expect(dialog, 'Configure Business dialog shall be visible').toBeVisible();
    await expect(dialog.getByLabel('Language'), 'Language field shall have default value').toHaveValue('English');

    await dialog.getByLabel('Language').click();
    const languageMenu = page.getByRole('menu');
    await expect(languageMenu, 'language selection menu shall be visible').toBeVisible();

    await languageMenu.getByRole('menuitemradio', { name: 'Bahasa Indonesia' }).click();
    await expect(dialog.getByLabel('Language'), 'Language field shall update to Bahasa Indonesia').toHaveValue('Bahasa Indonesia');
  });

  test('validate fiscal year start month range', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupOnboardingView, tursoLibSQLiteServer().url);

    await page.getByLabel('Business Name').fill('Test Store');
    await page.getByLabel('Fiscal Year Start Month').fill('13');
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('dialog', { name: 'Configure Business' }), 'shall remain on business config dialog with invalid month').toBeVisible();
    await expect(page.getByLabel('Fiscal Year Start Month'), 'Fiscal Year Start Month field shall be focused for correction').toBeFocused();
  });

  test('persist business configuration in database', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupOnboardingView, tursoLibSQLiteServer().url);

    await page.getByLabel('Business Name').fill('Persisted Store');
    await page.getByLabel('Business Type').fill('Restaurant');
    await page.getByLabel('Currency Code').fill('USD');
    await page.getByLabel('Currency Decimals').fill('2');
    await page.getByLabel('Locale').fill('en-US');
    await page.getByLabel('Fiscal Year Start Month').fill('7');
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' }), 'shall navigate to chart of accounts step after saving').toBeVisible();

    const config = await page.evaluate(async function checkDatabase() {
      /** @type {DatabaseContextElement} */
      const databaseContext = document.querySelector('database-context');
      const result = await databaseContext.sql`SELECT key, value FROM config WHERE key IN (
        'Business Name', 'Business Type', 'Currency Code', 'Currency Decimals', 'Locale', 'Fiscal Year Start Month'
      )`;
      return Object.fromEntries(result.rows.map(row => [row.key, row.value]));
    });

    expect(config['Business Name'], 'Business Name shall persist in database').toBe('Persisted Store');
    expect(config['Business Type'], 'Business Type shall persist in database').toBe('Restaurant');
    expect(config['Currency Code'], 'Currency Code shall persist in database').toBe('USD');
    expect(config['Currency Decimals'], 'Currency Decimals shall persist in database').toBe('2');
    expect(config['Locale'], 'Locale shall persist in database').toBe('en-US');
    expect(config['Fiscal Year Start Month'], 'Fiscal Year Start Month shall persist in database').toBe('7');
  });

  test('require chart of accounts template selection', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupOnboardingView, tursoLibSQLiteServer().url);

    await page.getByLabel('Business Name').fill('Test Store');
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' }), 'chart of accounts selection dialog shall be visible').toBeVisible();
    await page.getByRole('button', { name: 'Finish' }).click();

    await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' }), 'shall remain on chart of accounts dialog when no template selected').toBeVisible();
  });

  test('support back navigation through onboarding flow with persisted state', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupOnboardingViewFromWelcome, tursoLibSQLiteServer().url);

    // Database is already connected, so we get redirected from welcome to business config
    await expect(page.getByRole('dialog', { name: 'Configure Business' }), 'shall navigate to business config').toBeVisible();

    await page.getByLabel('Business Name').fill('My Local Business');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' }), 'shall navigate to chart of accounts step').toBeVisible();

    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Configure Business' }), 'shall navigate back to business config').toBeVisible();
    await expect(page.getByLabel('Business Name'), 'business name value shall persist').toHaveValue('My Local Business');

    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Welcome to JuruKasa' }), 'shall navigate back to welcome step').toBeVisible();
  });
});
