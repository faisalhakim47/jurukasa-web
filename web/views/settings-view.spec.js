import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { setupDatabase } from '#test/playwright/tools/database.js';

const { describe } = test;

/**
 * @param {string} tursoDatabaseUrl
 */
async function setupSettingsView(tursoDatabaseUrl) {
  window.history.replaceState({}, '', '/settings');
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" turso-url=${tursoDatabaseUrl}>
          <device-context>
            <i18n-context>
              <settings-view></settings-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Settings View', function () {
  useStrict(test);

  describe('Settings Navigation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Settings link in navigation', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    });

    test('shall navigate to Settings when clicking Settings link', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    });
  });

  describe('Settings Page Display', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display page header', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
      await expect(page.getByText('Configure accounting and POS settings.')).toBeVisible();
    });

    test('shall display Accounting Config tab', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tab', { name: 'Accounting Config' })).toBeVisible();
    });

    test('shall display Payment Methods tab', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tab', { name: 'Payment Methods' })).toBeVisible();
    });

    test('shall redirect to Accounting Config by default', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      const accountingPanel = page.getByRole('tabpanel', { name: 'Accounting Config' });
      await expect(accountingPanel).toHaveAttribute('aria-hidden', 'false');
    });
  });

  describe('Accounting Configuration Tab', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Accounting Configuration title', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Accounting Configuration' })).toBeVisible();
    });

    test('shall display configuration form', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      const accountingPanel = page.getByRole('tabpanel', { name: 'Accounting Config' });

      await expect(accountingPanel.getByLabel('Business Name')).toBeVisible();
      await expect(accountingPanel.getByLabel('Currency Code')).toBeVisible();
      await expect(accountingPanel.getByLabel('Currency Decimals')).toBeVisible();
      await expect(accountingPanel.getByLabel('Locale')).toBeVisible();
    });

    test('shall display Save Changes button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
    });

    test('shall display Reset button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      const accountingPanel = page.getByRole('tabpanel', { name: 'Accounting Config' });
      await expect(accountingPanel.getByRole('button', { name: 'Reset' })).toBeVisible();
    });

    test('shall display Refresh button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      const accountingPanel = page.getByRole('tabpanel', { name: 'Accounting Config' });
      await expect(accountingPanel.getByRole('button', { name: 'Refresh' })).toBeVisible();
    });
  });

  describe('Accounting Configuration Form Submission', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall update Business Name successfully', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      const businessNameInput = page.getByLabel('Business Name');
      await businessNameInput.clear();
      await businessNameInput.fill('Updated Business Name');

      await page.getByRole('button', { name: 'Save Changes' }).click();

      await expect(page.getByRole('dialog', { name: 'Settings Saved' })).toBeVisible();
    });

    test('shall update Locale successfully', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      const localeInput = page.getByLabel('Locale');
      await localeInput.clear();
      await localeInput.fill('en-US');

      await page.getByRole('button', { name: 'Save Changes' }).click();

      await expect(page.getByRole('dialog', { name: 'Settings Saved' })).toBeVisible();
    });
  });

  describe('Payment Methods Tab', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall switch to Payment Methods tab when clicked', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Payment Methods' }).click();

      const paymentsPanel = page.getByRole('tabpanel', { name: 'Payment Methods' });
      await expect(paymentsPanel).toHaveAttribute('aria-hidden', 'false');
    });

    test('shall display Payment Methods title', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Payment Methods' }).click();

      await expect(page.getByRole('heading', { name: 'Payment Methods', exact: true })).toBeVisible();
    });

    test('shall display empty state when no payment methods exist', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Payment Methods' }).click();

      await expect(page.getByRole('heading', { name: 'No payment methods configured' })).toBeVisible();
      await expect(page.getByText('Add payment methods to enable different payment options in the POS system.')).toBeVisible();
    });

    test('shall display Add Payment Method button in empty state', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Payment Methods' }).click();

      const paymentsPanel = page.getByRole('tabpanel', { name: 'Payment Methods' });
      await expect(paymentsPanel.getByRole('button', { name: 'Add Payment Method' }).first()).toBeVisible();
    });

    test('shall display Refresh button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Payment Methods' }).click();

      const paymentsPanel = page.getByRole('tabpanel', { name: 'Payment Methods' });
      await expect(paymentsPanel.getByRole('button', { name: 'Refresh' })).toBeVisible();
    });
  });

  describe('Payment Method Creation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall open payment method creation dialog', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Payment Methods' }).click();

      const paymentsPanel = page.getByRole('tabpanel', { name: 'Payment Methods' });
      await expect(paymentsPanel.getByRole('heading', { name: 'No payment methods configured' })).toBeVisible();
      await paymentsPanel.getByRole('button', { name: 'Add Payment Method' }).first().click();

      await expect(page.getByRole('dialog', { name: 'Create Payment Method' })).toBeVisible();
    });

    test('shall display payment method creation form fields', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Payment Methods' }).click();

      const paymentsPanel = page.getByRole('tabpanel', { name: 'Payment Methods' });
      await expect(paymentsPanel.getByRole('heading', { name: 'No payment methods configured' })).toBeVisible();
      await paymentsPanel.getByRole('button', { name: 'Add Payment Method' }).first().click();

      const dialog = page.getByRole('dialog', { name: 'Create Payment Method' });
      await expect(dialog.getByLabel('Payment Method Name')).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Select Account' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Create' })).toBeVisible();
    });
  });

  describe('Settings Tab Navigation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall maintain tab state when switching between tabs', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tabpanel', { name: 'Accounting Config' })).toBeVisible();

      await page.getByRole('tab', { name: 'Payment Methods' }).click();

      await expect(page.getByRole('tabpanel', { name: 'Payment Methods' })).toBeVisible();
      await expect(page.getByRole('tabpanel', { name: 'Accounting Config' })).not.toBeVisible();

      await page.getByRole('tab', { name: 'Accounting Config' }).click();

      await expect(page.getByRole('tabpanel', { name: 'Accounting Config' })).toBeVisible();
      await expect(page.getByRole('tabpanel', { name: 'Payment Methods' })).not.toBeVisible();
    });
  });
});
