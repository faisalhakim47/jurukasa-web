import { test, expect } from '@playwright/test';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';
import { setupDatabase } from '#test/tools/database.js';
/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
  localStorage.setItem('tursoDatabaseKey', '');
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context>
          <device-context>
            <i18n-context>
              <discounts-view></discounts-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Discounts View', function () {
  // useConsoleOutput(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display discounts list', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO discounts (id, name, inventory_id, multiple_of_quantity, amount) VALUES (1, 'Weekend Promo', NULL, 1, 5000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Discounts list' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Weekend Promo' })).toBeVisible();
  });

  test('it shall display empty state when no discounts exist', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('No discounts found')).toBeVisible();
    // one that always visible, one in the empty state
    await expect(page.getByRole('button', { name: 'Create Discount' })).toHaveCount(2);
  });

  test('it shall open discount creation dialog', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('No discounts found')).toBeVisible();
    await page.getByRole('button', { name: 'Create Discount' }).first().click();

    await expect(page.getByRole('dialog', { name: 'Create Discount' })).toBeVisible();
    await expect(page.getByLabel('Discount Name')).toBeVisible();
    await expect(page.getByLabel('Every N Items')).toBeVisible();
    await expect(page.getByLabel('Discount Amount')).toBeVisible();
  });

  test('it shall create global discount', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('No discounts found')).toBeVisible();
    await page.getByRole('button', { name: 'Create Discount' }).first().click();

    await expect(page.getByRole('dialog', { name: 'Create Discount' })).toBeVisible();

    await page.getByLabel('Discount Name').fill('Test Global Discount');
    await page.getByLabel('Every N Items').fill('2');
    await page.getByLabel('Discount Amount').fill('1000');

    await page.getByRole('dialog', { name: 'Create Discount' }).getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('dialog', { name: 'Create Discount' })).not.toBeVisible();
    await expect(page.getByRole('table', { name: 'Discounts list' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Test Global Discount' })).toBeVisible();
  });

  test('it shall create inventory-specific discount', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Test Product', 10000, 'pcs', 11310)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('No discounts found')).toBeVisible();
    await page.getByRole('button', { name: 'Create Discount' }).first().click();

    await expect(page.getByRole('dialog', { name: 'Create Discount' })).toBeVisible();

    await page.getByLabel('Discount Name').fill('Buy 3 Get 500 Off');
    await page.getByLabel('Inventory-specific Discount').click();

    await expect(page.getByLabel('Search Inventory')).toBeVisible();
    await page.getByRole('option', { name: 'Test Product' }).click();

    await page.getByLabel('Every N Items').fill('3');
    await page.getByLabel('Discount Amount').fill('500');

    await page.getByRole('dialog', { name: 'Create Discount' }).getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('dialog', { name: 'Create Discount' })).not.toBeVisible();
    await expect(page.getByRole('table', { name: 'Discounts list' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Buy 3 Get 500 Off' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Test Product' })).toBeVisible();
  });

  test('it shall open discount details dialog when clicking on a discount', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO discounts (id, name, inventory_id, multiple_of_quantity, amount) VALUES (1, 'My Promo', NULL, 2, 5000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Discounts list' })).toBeVisible();

    await page.getByRole('row').getByRole('button', { name: 'My Promo' }).click();

    await expect(page.getByRole('dialog', { name: 'My Promo' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'My Promo' }).getByRole('heading', { name: 'Discount Rules' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'My Promo' }).getByRole('status', { name: 'Every N Items value' })).toHaveText('2 item(s)');
    await expect(page.getByRole('dialog', { name: 'My Promo' }).getByRole('status', { name: 'Discount Amount value' })).toHaveText('IDR 5,000');
  });

  test('it shall filter discounts by type', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Snack', 5000, 'pcs', 11310)`;
        await sql`INSERT INTO discounts (id, name, inventory_id, multiple_of_quantity, amount) VALUES (1, 'Global Discount', NULL, 1, 1000)`;
        await sql`INSERT INTO discounts (id, name, inventory_id, multiple_of_quantity, amount) VALUES (2, 'Snack Promo', 1, 3, 500)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Discounts list' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Global Discount' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Snack Promo' })).toBeVisible();

    await page.getByRole('button', { name: 'All' }).click();
    await page.getByRole('menuitem', { name: 'Global' }).click();

    await expect(page.getByRole('row').filter({ hasText: 'Global Discount' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Snack Promo' })).not.toBeVisible();

    await page.getByRole('button', { name: 'Global', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Inventory-specific' }).click();

    await expect(page.getByRole('row').filter({ hasText: 'Global Discount' })).not.toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Snack Promo' })).toBeVisible();
  });

  test('it shall search discounts by name', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO discounts (id, name, inventory_id, multiple_of_quantity, amount) VALUES (1, 'Weekend Sale', NULL, 1, 5000)`;
        await sql`INSERT INTO discounts (id, name, inventory_id, multiple_of_quantity, amount) VALUES (2, 'New Year Promo', NULL, 1, 10000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Discounts list' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Weekend Sale' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'New Year Promo' })).toBeVisible();

    await page.getByLabel('Search').fill('Weekend');

    await expect(page.getByRole('row').filter({ hasText: 'Weekend Sale' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'New Year Promo' })).not.toBeVisible();
  });

  test('it shall delete discount from details dialog', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO discounts (id, name, inventory_id, multiple_of_quantity, amount) VALUES (1, 'Delete Me', NULL, 1, 1000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Discounts list' })).toBeVisible();
    await page.getByRole('row').getByRole('button', { name: 'Delete Me' }).click();

    await expect(page.getByRole('dialog', { name: 'Delete Me' })).toBeVisible();

    await page.getByRole('dialog', { name: 'Delete Me' }).getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByRole('alertdialog', { name: 'Delete Discount' })).toBeVisible();
    await page.getByRole('alertdialog', { name: 'Delete Discount' }).getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByRole('alertdialog', { name: 'Delete Discount' })).not.toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Delete Me' })).not.toBeVisible();
    await expect(page.getByText('No discounts found')).toBeVisible();
  });
});
