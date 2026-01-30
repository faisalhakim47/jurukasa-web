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

/** @param {string} pathname */
async function setupOnboardingViewWithRoute(pathname) {
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

  // Navigate to the specified route
  /** @type {import('#web/contexts/router-context.js').RouterContextElement} */
  const router = document.querySelector('router-context');
  router.navigate({ pathname, replace: true });
}

describe('Onboarding View', function () {
  useConsoleOutput(test);
  useStrict(test);

  describe('Welcome Step', function () {
    test('it shall show welcome screen when database is not configured', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupOnboardingViewWithoutDatabase);

      await expect(page.getByRole('dialog', { name: 'Welcome to JuruKasa' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
    });

    test('it shall redirect to welcome step when accessing /onboarding without database', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(function setupWithOnboardingRoute() {
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
      });

      await expect(page.getByRole('dialog', { name: 'Welcome to JuruKasa' })).toBeVisible();
    });

    test('it shall show feature highlights on welcome screen', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupOnboardingViewWithoutDatabase);

      await expect(page.getByText('Point of Sale - Process')).toBeVisible();
      await expect(page.getByText('Inventory Management - Track')).toBeVisible();
      await expect(page.getByText('Accounting - Follow')).toBeVisible();
      await expect(page.getByText('Financial Reports - Generate')).toBeVisible();
    });

    test('it shall navigate to database setup when clicking Get Started', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupOnboardingViewWithoutDatabase);

      await page.getByRole('button', { name: 'Get Started' }).click();

      await expect(page.getByRole('dialog', { name: 'Configure Database' })).toBeVisible();
    });

    test('it shall allow language selection with realtime update', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupOnboardingViewWithoutDatabase);

      await expect(page.getByRole('dialog', { name: 'Welcome to JuruKasa' })).toBeVisible();
      await expect(page.getByText('Welcome to JuruKasa')).toBeVisible();

      await page.getByRole('radio', { name: 'Bahasa Indonesia' }).check();

      await expect(page.getByText('Selamat Datang di JuruKasa')).toBeVisible();

      await page.getByRole('radio', { name: 'English' }).check();

      await expect(page.getByText('Welcome to JuruKasa')).toBeVisible();
    });
  });

  describe('Database Setup Step', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('it shall show database provider selection', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(function setupWithDatabaseRoute() {
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
      });

      // Verify provider selection radio buttons
      await expect(page.getByRole('radio', { name: 'Local Database' })).toBeVisible();
      await expect(page.getByRole('radio', { name: 'Turso SQLite' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible();
    });

    test('it shall show Turso form when Turso provider is selected', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(function setupWithDatabaseRoute() {
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
      });

      await page.getByRole('radio', { name: 'Turso SQLite' }).check();

      await expect(page.getByLabel('Database Name')).toBeVisible();
      await expect(page.getByLabel('Database URL')).toBeVisible();
      await expect(page.getByLabel('Auth Token')).toBeVisible();
    });

    test('it shall connect using Turso provider and proceed to business config', async function ({ page }) {
      await loadDevFixture(page);

      await page.getByRole('button', { name: 'Get Started' }).click();
      await page.getByRole('radio', { name: 'Turso SQLite' }).check();
      await page.getByLabel('Database Name').fill('Test Turso Database');
      await page.getByLabel('Database URL').fill(tursoLibSQLiteServer().url);
      await page.getByRole('button', { name: 'Connect' }).click();

      // Wait for navigation to complete and view to render
      await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
    });

    test('it shall support back navigation to database setup after connection', async function ({ page }) {
      await loadEmptyFixture(page);
      const dbUrl = tursoLibSQLiteServer().url;
      await page.evaluate(setupOnboardingViewWithoutDatabase);

      // Go to database setup
      await page.getByRole('button', { name: 'Get Started' }).click();
      await expect(page.getByRole('dialog', { name: 'Configure Database' })).toBeVisible();

      // Connect to database and go to business config
      await page.getByRole('radio', { name: 'Turso SQLite' }).check();
      await page.getByLabel('Database Name').fill('Test Turso Database');
      await page.getByLabel('Database URL').fill(dbUrl);
      await page.getByRole('button', { name: 'Connect' }).click();

      await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();

      // Use browser back button - should go back to database setup
      await page.goBack();

      await expect(page.getByRole('dialog', { name: 'Configure Database' })).toBeVisible();
    });
  });

  describe('Business Configuration Step', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('it shall show business configuration dialog when database is empty', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupOnboardingView, tursoLibSQLiteServer().url);

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

      await page.evaluate(setupOnboardingView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Next' }).click();

      await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
      await expect(page.getByLabel('Business Name')).toBeFocused();
    });

    test('it shall save business configuration and show chart of accounts selection', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupOnboardingView, tursoLibSQLiteServer().url);

      // Wait for the dialog to be visible first
      await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();

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

      await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' })).toBeVisible();
    });

    test('it shall support back navigation from chart of accounts to business config', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupOnboardingView, tursoLibSQLiteServer().url);

      // Fill and submit business config
      await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
      await page.getByLabel('Business Name').fill('My Awesome Store');
      await page.getByRole('button', { name: 'Next' }).click();

      // Now on chart of accounts step
      await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' })).toBeVisible();

      // Use browser back button to go back to business config
      await page.goBack();

      await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
      // Form should still have the values
      await expect(page.getByLabel('Business Name')).toHaveValue('My Awesome Store');
    });

    test('it shall allow language selection', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupOnboardingView, tursoLibSQLiteServer().url);

      const dialog = page.getByRole('dialog', { name: 'Configure Business' });
      await expect(dialog).toBeVisible();

      await expect(dialog.getByLabel('Language')).toHaveValue('English');

      await dialog.getByLabel('Language').click();

      const languageMenu = page.getByRole('menu');
      await expect(languageMenu).toBeVisible();

      await languageMenu.getByRole('menuitemradio', { name: 'Bahasa Indonesia' }).click();

      await expect(dialog.getByLabel('Language')).toHaveValue('Bahasa Indonesia');
    });

    test('it shall validate fiscal year start month range', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupOnboardingView, tursoLibSQLiteServer().url);

      await page.getByLabel('Business Name').fill('Test Store');
      await page.getByLabel('Fiscal Year Start Month').fill('13');

      await page.getByRole('button', { name: 'Next' }).click();

      await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
      await expect(page.getByLabel('Fiscal Year Start Month')).toBeFocused();
    });

    test('it shall persist business configuration in database', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupOnboardingView, tursoLibSQLiteServer().url);

      await page.getByLabel('Business Name').fill('Persisted Store');
      await page.getByLabel('Business Type').fill('Restaurant');
      await page.getByLabel('Currency Code').fill('USD');
      await page.getByLabel('Currency Decimals').fill('2');
      await page.getByLabel('Locale').fill('en-US');
      await page.getByLabel('Fiscal Year Start Month').fill('7');

      await page.getByRole('button', { name: 'Next' }).click();

      await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' })).toBeVisible();

      const config = await page.evaluate(async function checkDatabase() {
        /** @type {DatabaseContextElement} */
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

  describe('Chart of Accounts Step', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('it shall require chart of accounts template selection', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupOnboardingView, tursoLibSQLiteServer().url);

      await page.getByLabel('Business Name').fill('Test Store');
      await page.getByRole('button', { name: 'Next' }).click();

      await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' })).toBeVisible();

      await page.getByRole('button', { name: 'Finish' }).click();

      await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' })).toBeVisible();
    });
  });

  describe('Local Database Test', function () {
    test('it shall show database name input when Local Database provider is selected', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupOnboardingViewWithoutDatabase);

      await page.getByRole('button', { name: 'Get Started' }).click();
      await page.getByRole('radio', { name: 'Local Database' }).check();

      await expect(page.getByLabel('Database Name')).toBeVisible();
    });

    test('it shall require database name for Local Database provider', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupOnboardingViewWithoutDatabase);

      await page.getByRole('button', { name: 'Get Started' }).click();
      await page.getByRole('radio', { name: 'Local Database' }).check();
      await page.getByRole('button', { name: 'Connect' }).click();

      // Should still be on database setup dialog because name is required
      await expect(page.getByRole('dialog', { name: 'Configure Database' })).toBeVisible();
      await expect(page.getByLabel('Database Name')).toBeFocused();
    });

    test('it shall connect using Local Database provider and proceed to business config', async function ({ page }) {
      await loadDevFixture(page);

      await page.getByRole('button', { name: 'Get Started' }).click();
      await page.getByRole('radio', { name: 'Local Database' }).check();
      await page.getByLabel('Database Name').fill('Local DB Store');
      await page.getByRole('button', { name: 'Connect' }).click();

      const businessConfigDialog = page.getByRole('dialog', { name: 'Configure Business' });
      await expect(businessConfigDialog).toBeVisible();
      await businessConfigDialog.getByLabel('Business Name').fill('My Local Business');
      await businessConfigDialog.getByRole('button', { name: 'Next' }).click();

      const chartOfAccountsDialog = page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' });
      await expect(chartOfAccountsDialog).toBeVisible();
      await chartOfAccountsDialog.getByRole('radio', { name: 'Retail Business - Indonesia' }).check();
      await chartOfAccountsDialog.getByRole('button', { name: 'Finish' }).click();

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });

    test('it shall support back navigation through entire onboarding flow', async function ({ page }) {
      await loadDevFixture(page);

      // Start at welcome
      await expect(page.getByRole('dialog', { name: 'Welcome to JuruKasa' })).toBeVisible();

      // Go to database setup
      await page.getByRole('button', { name: 'Get Started' }).click();
      await expect(page.getByRole('dialog', { name: 'Configure Database' })).toBeVisible();

      // Select local database
      await page.getByRole('radio', { name: 'Local Database' }).check();
      await page.getByLabel('Database Name').fill('Local DB Store');

      // Connect and go to business config
      await page.getByRole('button', { name: 'Connect' }).click();
      await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();

      // Fill business config
      await page.getByLabel('Business Name').fill('My Local Business');

      // Go to chart of accounts
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' })).toBeVisible();

      // Back to business config - form values should be persisted
      await page.goBack();
      await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
      await expect(page.getByLabel('Business Name')).toHaveValue('My Local Business');

      // Back to database setup - provider selection should be persisted
      await page.goBack();
      await expect(page.getByRole('dialog', { name: 'Configure Database' })).toBeVisible();
      await expect(page.getByRole('radio', { name: 'Local Database' })).toBeChecked();

      // Back to welcome
      await page.goBack();
      await expect(page.getByRole('dialog', { name: 'Welcome to JuruKasa' })).toBeVisible();
    });
  });
});
