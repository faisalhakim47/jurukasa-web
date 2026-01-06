import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
const { describe } = test;

describe('Onboarding Context', function () {
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall provide onboarding mechanism', async function ({ page }) {
    await page.goto('/test/fixtures/empty.html');

    await page.evaluate(async function () {
      document.body.innerHTML = `
        <router-context>
          <database-context>
            <onboarding-context>
              <p>Application Ready</p>
            </onboarding-context>
          </database-context>
        </router-context>
      `;
    });

    // 1. Configure Database
    await expect(page.getByRole('dialog', { name: 'Configure Database' })).toBeVisible();
    await page.getByLabel('Turso Database URL').fill(tursoLibSQLiteServer().url);
    await page.getByRole('button', { name: 'Configure' }).click();

    // 2. Configure Business (Onboarding)
    await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
    
    await page.getByLabel('Business Name').fill('My Awesome Store');
    await page.getByLabel('Business Type').fill('Retail');
    await page.getByLabel('Currency Code').fill('USD');
    await page.getByLabel('Currency Decimals').fill('2');
    await page.getByLabel('Locale').fill('en-US');
    await page.getByLabel('Fiscal Year Start Month').fill('1');

    await page.getByRole('button', { name: 'Next' }).click();

    // 3. Setup Chart of Accounts
    await expect(page.getByRole('dialog', { name: 'Chart of Accounts' })).toBeVisible();
    await page.getByRole('radio', { name: 'Retail Business - Indonesia' }).check();
    await page.getByRole('button', { name: 'Finish' }).click();

    // 4. Verify Application Ready
    await expect(page.getByText('Application Ready')).toBeVisible();
  });
});
