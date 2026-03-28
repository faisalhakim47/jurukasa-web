import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { setupDatabase } from '#test/playwright/tools/database.js';

const test = jurukasaTest;
const { describe } = test;

/**
 * @param {string} tursoDatabaseUrl
 */
async function setupSettingsView(tursoDatabaseUrl) {
  window.history.replaceState({}, '', '/settings');
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
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
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('navigate to Settings and view page structure', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Settings' }), 'it shall display Settings page heading').toBeVisible();
    await expect(page.getByText('Configure accounting and POS settings.'), 'it shall display Settings page description').toBeVisible();
    await expect(page.getByRole('tab', { name: 'Accounting Config' }), 'it shall display Accounting Config tab').toBeVisible();
    await expect(page.getByRole('tab', { name: 'Payment Methods' }), 'it shall display Payment Methods tab').toBeVisible();
  });

  test('view Accounting Configuration tab with form elements', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

    const accountingPanel = page.getByRole('tabpanel', { name: 'Accounting Config' });
    await expect(accountingPanel, 'it shall display Accounting Config tab panel by default').toHaveAttribute('aria-hidden', 'false');
    await expect(page.getByRole('heading', { name: 'Accounting Configuration' }), 'it shall display Accounting Configuration title').toBeVisible();
    await expect(accountingPanel.getByLabel('Business Name'), 'it shall display Business Name input').toBeVisible();
    await expect(accountingPanel.getByLabel('Currency Code'), 'it shall display Currency Code input').toBeVisible();
    await expect(accountingPanel.getByLabel('Currency Decimals'), 'it shall display Currency Decimals input').toBeVisible();
    await expect(accountingPanel.getByLabel('Locale'), 'it shall display Locale input').toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Changes' }), 'it shall display Save Changes button').toBeVisible();
    await expect(accountingPanel.getByRole('button', { name: 'Reset' }), 'it shall display Reset button').toBeVisible();
    await expect(accountingPanel.getByRole('button', { name: 'Refresh' }), 'it shall display Refresh button').toBeVisible();
  });

  test('update accounting configuration and save changes', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

    const businessNameInput = page.getByLabel('Business Name');
    await businessNameInput.clear();
    await businessNameInput.fill('Updated Business Name');

    const localeInput = page.getByLabel('Locale');
    await localeInput.clear();
    await localeInput.fill('en-US');

    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByRole('dialog', { name: 'Settings Saved' }), 'it shall display success dialog after saving settings').toBeVisible();
  });

  test('switch to Payment Methods tab and view empty state', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

    await page.getByRole('tab', { name: 'Payment Methods' }).click();

    const paymentsPanel = page.getByRole('tabpanel', { name: 'Payment Methods' });
    await expect(paymentsPanel, 'it shall display Payment Methods tab panel as active').toHaveAttribute('aria-hidden', 'false');
    await expect(page.getByRole('heading', { name: 'Payment Methods', exact: true }), 'it shall display Payment Methods title').toBeVisible();
    await expect(page.getByRole('heading', { name: 'No payment methods configured' }), 'it shall display empty state heading').toBeVisible();
    await expect(page.getByText('Add payment methods to enable different payment options in the POS system.'), 'it shall display empty state description').toBeVisible();
    await expect(paymentsPanel.getByRole('button', { name: 'Add Payment Method' }).first(), 'it shall display Add Payment Method button').toBeVisible();
    await expect(paymentsPanel.getByRole('button', { name: 'Refresh' }), 'it shall display Refresh button in Payment Methods tab').toBeVisible();
  });

  test('open payment method creation dialog', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

    await page.getByRole('tab', { name: 'Payment Methods' }).click();

    const paymentsPanel = page.getByRole('tabpanel', { name: 'Payment Methods' });
    await paymentsPanel.getByRole('button', { name: 'Add Payment Method' }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Create Payment Method' });
    await expect(dialog, 'it shall display Create Payment Method dialog').toBeVisible();
    await expect(dialog.getByLabel('Payment Method Name'), 'it shall display Payment Method Name input').toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Select Account' }), 'it shall display Select Account button').toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Create' }), 'it shall display Create button').toBeVisible();
  });

  test('switch between Accounting Config and Payment Methods tabs', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupSettingsView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('tabpanel', { name: 'Accounting Config' }), 'it shall display Accounting Config panel initially').toBeVisible();

    await page.getByRole('tab', { name: 'Payment Methods' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Payment Methods' }), 'it shall display Payment Methods panel after clicking tab').toBeVisible();
    await expect(page.getByRole('tabpanel', { name: 'Accounting Config' }), 'it shall hide Accounting Config panel when Payment Methods is active').not.toBeVisible();

    await page.getByRole('tab', { name: 'Accounting Config' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Accounting Config' }), 'it shall display Accounting Config panel after switching back').toBeVisible();
    await expect(page.getByRole('tabpanel', { name: 'Payment Methods' }), 'it shall hide Payment Methods panel when Accounting Config is active').not.toBeVisible();
  });
});
