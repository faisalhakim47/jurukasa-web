import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
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
              <discounts-view></discounts-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Discounts View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('shall display discounts list with existing discounts', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO discounts (id, name, inventory_id, multiple_of_quantity, amount) VALUES (1, 'Weekend Promo', NULL, 1, 5000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Discounts list' }), 'it shall display discounts table').toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Weekend Promo' }), 'it shall display existing discount in list').toBeVisible();
  });

  test('shall display empty state when no discounts exist', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('No discounts found'), 'it shall display empty state message').toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Discount' }), 'it shall display create discount buttons in empty state and header').toHaveCount(2);
  });

  test('shall create global discount through creation dialog', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('No discounts found'), 'it shall show empty state initially').toBeVisible();
    await page.getByRole('button', { name: 'Create Discount' }).first().click();

    await expect(page.getByRole('dialog', { name: 'Create Discount' }), 'it shall open discount creation dialog').toBeVisible();
    await expect(page.getByLabel('Discount Name'), 'it shall display discount name field').toBeVisible();
    await expect(page.getByLabel('Every N Items'), 'it shall display quantity field').toBeVisible();
    await expect(page.getByLabel('Discount Amount'), 'it shall display amount field').toBeVisible();

    await page.getByLabel('Discount Name').fill('Test Global Discount');
    await page.getByLabel('Every N Items').fill('2');
    await page.getByLabel('Discount Amount').fill('1000');

    await page.getByRole('dialog', { name: 'Create Discount' }).getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('dialog', { name: 'Create Discount' }), 'it shall close creation dialog after submit').not.toBeVisible();
    await expect(page.getByRole('table', { name: 'Discounts list' }), 'it shall display discounts table after creation').toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Test Global Discount' }), 'it shall display newly created global discount').toBeVisible();
  });

  test('shall create inventory-specific discount through creation dialog', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Test Product', 10000, 'pcs', 11310)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('No discounts found'), 'it shall show empty state initially').toBeVisible();
    await page.getByRole('button', { name: 'Create Discount' }).first().click();

    await expect(page.getByRole('dialog', { name: 'Create Discount' }), 'it shall open discount creation dialog').toBeVisible();

    await page.getByLabel('Discount Name').fill('Buy 3 Get 500 Off');
    await page.getByLabel('Inventory-specific Discount').click();

    await expect(page.getByLabel('Search Inventory'), 'it shall display inventory search field').toBeVisible();
    await page.getByRole('option', { name: 'Test Product' }).click();

    await page.getByLabel('Every N Items').fill('3');
    await page.getByLabel('Discount Amount').fill('500');

    await page.getByRole('dialog', { name: 'Create Discount' }).getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('dialog', { name: 'Create Discount' }), 'it shall close creation dialog after submit').not.toBeVisible();
    await expect(page.getByRole('table', { name: 'Discounts list' }), 'it shall display discounts table after creation').toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Buy 3 Get 500 Off' }), 'it shall display newly created inventory-specific discount').toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Test Product' }), 'it shall display associated inventory name').toBeVisible();
  });

  test('shall open discount details dialog when clicking on a discount', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO discounts (id, name, inventory_id, multiple_of_quantity, amount) VALUES (1, 'My Promo', NULL, 2, 5000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Discounts list' }), 'it shall display discounts table').toBeVisible();

    await page.getByRole('row').getByRole('button', { name: 'My Promo' }).click();

    await expect(page.getByRole('dialog', { name: 'My Promo' }), 'it shall open discount details dialog').toBeVisible();
    await expect(page.getByRole('dialog', { name: 'My Promo' }).getByRole('heading', { name: 'Discount Rules' }), 'it shall display discount rules heading').toBeVisible();
    await expect(page.getByRole('dialog', { name: 'My Promo' }).getByRole('status', { name: 'Every N Items value' }), 'it shall display correct quantity value').toHaveText('2 item(s)');
    await expect(page.getByRole('dialog', { name: 'My Promo' }).getByRole('status', { name: 'Discount Amount value' }), 'it shall display correct amount value').toHaveText('IDR 5,000');
  });

  test('shall filter discounts by type', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Snack', 5000, 'pcs', 11310)`;
        await sql`INSERT INTO discounts (id, name, inventory_id, multiple_of_quantity, amount) VALUES (1, 'Global Discount', NULL, 1, 1000)`;
        await sql`INSERT INTO discounts (id, name, inventory_id, multiple_of_quantity, amount) VALUES (2, 'Snack Promo', 1, 3, 500)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Discounts list' }), 'it shall display discounts table').toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Global Discount' }), 'it shall display global discount initially').toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Snack Promo' }), 'it shall display inventory-specific discount initially').toBeVisible();

    await page.getByRole('button', { name: 'All' }).click();
    await page.getByRole('menuitem', { name: 'Global' }).click();

    await expect(page.getByRole('row').filter({ hasText: 'Global Discount' }), 'it shall display global discount when filtered to global').toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Snack Promo' }), 'it shall hide inventory-specific discount when filtered to global').not.toBeVisible();

    await page.getByRole('button', { name: 'Global', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Inventory-specific' }).click();

    await expect(page.getByRole('row').filter({ hasText: 'Global Discount' }), 'it shall hide global discount when filtered to inventory-specific').not.toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Snack Promo' }), 'it shall display inventory-specific discount when filtered to inventory-specific').toBeVisible();
  });

  test('shall search discounts by name', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO discounts (id, name, inventory_id, multiple_of_quantity, amount) VALUES (1, 'Weekend Sale', NULL, 1, 5000)`;
        await sql`INSERT INTO discounts (id, name, inventory_id, multiple_of_quantity, amount) VALUES (2, 'New Year Promo', NULL, 1, 10000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Discounts list' }), 'it shall display discounts table').toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Weekend Sale' }), 'it shall display Weekend Sale discount initially').toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'New Year Promo' }), 'it shall display New Year Promo discount initially').toBeVisible();

    await page.getByLabel('Search').fill('Weekend');

    await expect(page.getByRole('row').filter({ hasText: 'Weekend Sale' }), 'it shall display matching discount after search').toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'New Year Promo' }), 'it shall hide non-matching discount after search').not.toBeVisible();
  });

  test('shall delete discount from details dialog', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO discounts (id, name, inventory_id, multiple_of_quantity, amount) VALUES (1, 'Delete Me', NULL, 1, 1000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Discounts list' }), 'it shall display discounts table').toBeVisible();
    await page.getByRole('row').getByRole('button', { name: 'Delete Me' }).click();

    await expect(page.getByRole('dialog', { name: 'Delete Me' }), 'it shall open discount details dialog').toBeVisible();

    await page.getByRole('dialog', { name: 'Delete Me' }).getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByRole('alertdialog', { name: 'Delete Discount' }), 'it shall display delete confirmation dialog').toBeVisible();
    await page.getByRole('alertdialog', { name: 'Delete Discount' }).getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByRole('alertdialog', { name: 'Delete Discount' }), 'it shall close confirmation dialog after deletion').not.toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Delete Me' }), 'it shall close details dialog after deletion').not.toBeVisible();
    await expect(page.getByText('No discounts found'), 'it shall display empty state after deleting all discounts').toBeVisible();
  });
});
