import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
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
              <payment-methods-view></payment-methods-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Payment Methods View', function () {
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display empty state when no payment methods exist', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Payment methods list' }), 'it shall hide payment methods table when no methods exist').not.toBeVisible();
    await expect(page.getByText('No Payment Methods'), 'it shall display empty state message').toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Payment Method' }).first(), 'it shall display add payment method button').toBeVisible();
  });

  test('it shall display payment methods list with account details when payment methods exist', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO payment_methods (id, account_code, name, min_fee, max_fee, rel_fee) VALUES (1, 11110, 'Cash', 0, 0, 0)`;
        await sql`INSERT INTO payment_methods (id, account_code, name, min_fee, max_fee, rel_fee) VALUES (2, 11120, 'Bank Transfer', 0, 0, 0)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Payment methods list' }), 'it shall display payment methods table').toBeVisible();
    await expect(page.getByRole('button', { name: 'Cash', exact: true }), 'it shall display Cash payment method button').toBeVisible();
    await expect(page.getByRole('button', { name: 'Bank Transfer', exact: true }), 'it shall display Bank Transfer payment method button').toBeVisible();

    const tableContent = page.getByRole('table', { name: 'Payment methods list' });
    await expect(tableContent.getByText('Kas'), 'it shall display Kas account name for Cash method').toBeVisible();
    await expect(tableContent.getByText('Bank BCA'), 'it shall display Bank BCA account name for Bank Transfer method').toBeVisible();
  });

  test('it shall display fee information for different fee types', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO payment_methods (id, account_code, name, min_fee, max_fee, rel_fee) VALUES (1, 11110, 'Cash', 0, 0, 0)`;
        await sql`INSERT INTO payment_methods (id, account_code, name, min_fee, max_fee, rel_fee) VALUES (2, 11120, 'Credit Card', 0, 0, 30000)`;
        await sql`INSERT INTO payment_methods (id, account_code, name, min_fee, max_fee, rel_fee) VALUES (3, 11120, 'E-Wallet', 2000, 5000, 0)`;
        await sql`INSERT INTO payment_methods (id, account_code, name, min_fee, max_fee, rel_fee) VALUES (4, 11120, 'Online Payment', 1000, 0, 25000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Payment methods list' }), 'it shall display payment methods table').toBeVisible();

    const cashRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Cash' }) });
    await expect(cashRow.getByText('No Fee'), 'it shall display No Fee badge for methods without fees').toBeVisible();

    const creditCardRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Credit Card' }) });
    await expect(creditCardRow.getByText('3.00%'), 'it shall display percentage fee for methods with relative fee').toBeVisible();

    const eWalletRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'E-Wallet' }) });
    await expect(eWalletRow, 'it shall display min fee information').toContainText('min IDR 2,000');
    await expect(eWalletRow, 'it shall display max fee information').toContainText('max IDR 5,000');

    const onlinePaymentRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Online Payment' }) });
    await expect(onlinePaymentRow, 'it shall display combined percentage fee').toContainText('2.50%');
    await expect(onlinePaymentRow, 'it shall display combined min fee').toContainText('min IDR 1,000');
  });

  test('it shall open payment method creation dialog when add button is clicked', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('No payment methods configured'), 'it shall display empty state message').toBeVisible();

    await page.getByRole('button', { name: 'Add Payment Method' }).first().click();

    await expect(page.getByRole('dialog', { name: 'Create Payment Method' }), 'it shall display create payment method dialog').toBeVisible();
  });
});
