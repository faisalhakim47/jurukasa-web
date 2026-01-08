import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

describe('Payment Methods View', function () {
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display empty state when no payment methods exist', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <payment-methods-view></payment-methods-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Wait for empty state to load
    await expect(page.getByRole('table', { name: 'Payment methods list' })).not.toBeVisible();
    await expect(page.getByText('No Payment Methods')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Payment Method' }).first()).toBeVisible();
  });

  test('it shall display payment methods list when payment methods exist', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context></database-context>
          </router-context>
        </ready-context>
      `;

      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      
      // Create test accounts
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES
          (11110, 'Cash Account', 0, 0, 0),
          (11120, 'Bank Account', 0, 0, 0)
      `;
      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES
          (11110, 'POS - Payment Method'),
          (11120, 'POS - Payment Method')
      `;
      
      // Create test payment methods
      await database.sql`
        INSERT INTO payment_methods (id, account_code, name, min_fee, max_fee, rel_fee)
        VALUES
          (1, 11110, 'Cash', 0, 0, 0),
          (2, 11120, 'Bank Transfer', 0, 0, 0)
      `;

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <payment-methods-view></payment-methods-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Wait for table to load
    await expect(page.getByRole('table', { name: 'Payment methods list' })).toBeVisible();
    
    // Verify payment methods are displayed
    await expect(page.getByRole('button', { name: 'Cash', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bank Transfer', exact: true })).toBeVisible();
    
    // Verify account names are displayed
    const tableContent = page.getByRole('table', { name: 'Payment methods list' });
    await expect(tableContent.getByText('Cash Account')).toBeVisible();
    await expect(tableContent.getByText('Bank Account')).toBeVisible();
  });

  test('it shall display "No Fee" badge for payment methods without fees', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context></database-context>
          </router-context>
        </ready-context>
      `;

      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES (11110, 'Cash Account', 0, 0, 0)
      `;
      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES (11110, 'POS - Payment Method')
      `;
      
      await database.sql`
        INSERT INTO payment_methods (id, account_code, name, min_fee, max_fee, rel_fee)
        VALUES (1, 11110, 'Cash', 0, 0, 0)
      `;

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <payment-methods-view></payment-methods-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Wait for table to load
    await expect(page.getByRole('table', { name: 'Payment methods list' })).toBeVisible();
    
    // Find the cash payment method row
    const cashRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Cash' }) });
    
    // Verify "No Fee" label is displayed
    await expect(cashRow.getByText('No Fee')).toBeVisible();
  });

  test('it shall display percentage fee for payment methods with relative fee', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context></database-context>
          </router-context>
        </ready-context>
      `;

      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES (11120, 'Credit Card Account', 0, 0, 0)
      `;
      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES (11120, 'POS - Payment Method')
      `;
      
      // rel_fee of 30000 represents 3% (30000 / 10000 = 3.00%)
      await database.sql`
        INSERT INTO payment_methods (id, account_code, name, min_fee, max_fee, rel_fee)
        VALUES (1, 11120, 'Credit Card', 0, 0, 30000)
      `;

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <payment-methods-view></payment-methods-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Wait for table to load
    await expect(page.getByRole('table', { name: 'Payment methods list' })).toBeVisible();
    
    // Find the credit card payment method row
    const creditCardRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Credit Card' }) });
    
    // Verify percentage fee is displayed
    await expect(creditCardRow.getByText('3.00%')).toBeVisible();
  });

  test('it shall display min and max fee information', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context></database-context>
          </router-context>
        </ready-context>
      `;

      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES (11120, 'E-Wallet Account', 0, 0, 0)
      `;
      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES (11120, 'POS - Payment Method')
      `;
      
      // min_fee of 2000 represents IDR 2,000
      // max_fee of 5000 represents IDR 5,000
      await database.sql`
        INSERT INTO payment_methods (id, account_code, name, min_fee, max_fee, rel_fee)
        VALUES (1, 11120, 'E-Wallet', 2000, 5000, 0)
      `;

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <payment-methods-view></payment-methods-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Wait for table to load
    await expect(page.getByRole('table', { name: 'Payment methods list' })).toBeVisible();
    
    // Find the e-wallet payment method row
    const eWalletRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'E-Wallet' }) });
    
    // Verify min and max fee labels are displayed
    await expect(eWalletRow).toContainText('min IDR 2,000');
    await expect(eWalletRow).toContainText('max IDR 5,000');
  });

  test('it shall display combined percentage and fixed fees', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context></database-context>
          </router-context>
        </ready-context>
      `;

      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES (11120, 'Online Payment Account', 0, 0, 0)
      `;
      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES (11120, 'POS - Payment Method')
      `;
      
      // rel_fee of 25000 represents 2.5% and min_fee of 1000 represents IDR 1,000
      await database.sql`
        INSERT INTO payment_methods (id, account_code, name, min_fee, max_fee, rel_fee)
        VALUES (1, 11120, 'Online Payment', 1000, 0, 25000)
      `;

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <payment-methods-view></payment-methods-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Wait for table to load
    await expect(page.getByRole('table', { name: 'Payment methods list' })).toBeVisible();
    
    // Find the online payment method row
    const onlinePaymentRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Online Payment' }) });
    
    // Verify both percentage and minimum fee are displayed
    await expect(onlinePaymentRow).toContainText('2.50%');
    await expect(onlinePaymentRow).toContainText('min IDR 1,000');
  });

  test('it shall open payment method creation dialog when add button is clicked', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <payment-methods-view></payment-methods-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Wait for view to load
    await expect(page.getByText('No Payment Methods')).toBeVisible();

    // Click add payment method button
    await page.getByRole('button', { name: 'Add Payment Method' }).first().click();

    // Verify creation dialog opened
    await expect(page.getByRole('dialog', { name: 'Create Payment Method' })).toBeVisible();
  });
});
