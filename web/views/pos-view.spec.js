import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

describe('POS View', function () {
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  /**
   * Helper function to setup test data
   * @param {import('@playwright/test').Page} page
   */
  async function setupTestData(page) {
    await page.evaluate(async function () {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');

      // Create accounts
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES
          (11110, 'Inventory Account', 0, 0, 0),
          (41110, 'Sales Revenue', 1, 0, 0),
          (51110, 'Cost of Goods Sold', 0, 0, 0),
          (11120, 'Cash Account', 0, 0, 0),
          (11121, 'Bank Account', 0, 0, 0)
      `;

      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES
          (11110, 'POS - Inventory'),
          (41110, 'POS - Sales Revenue'),
          (51110, 'POS - Cost of Goods Sold'),
          (11120, 'POS - Payment Method'),
          (11121, 'POS - Payment Method')
      `;

      // Create inventories (with zero cost and stock to avoid balance constraint)
      await database.sql`
        INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
        VALUES
          (1, 'Product A', 10000, 'piece', 11110),
          (2, 'Product B', 20000, 'piece', 11110),
          (3, 'Product C', 15000, 'unit', 11110)
      `;

      // Create payment methods
      await database.sql`
        INSERT INTO payment_methods (id, name, min_fee, max_fee, rel_fee, account_code)
        VALUES
          (1, 'Cash', 0, 0, 0, 11120),
          (2, 'Bank Transfer', 2000, 5000, 10000, 11121),
          (3, 'Credit Card', 1000, 10000, 20000, 11121)
      `;

      // Create discounts
      await database.sql`
        INSERT INTO discounts (id, name, inventory_id, multiple_of_quantity, amount)
        VALUES
          (1, 'Buy 2 Get 5k Off', 1, 2, 5000),
          (2, 'General 10% Off', NULL, 1, 10000)
      `;
    });
  }

  test('it shall display POS interface with inventory selector', async function ({ page }) {
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
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    await page.evaluate(async function () {
      await import('/web/views/pos-view.js');
      await customElements.whenDefined('pos-view');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <pos-view></pos-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    });

    // Wait for component to render
    await expect(page.getByRole('heading', { name: /point of sale/i })).toBeVisible();
    
    // Verify inventory selector is visible
    await expect(page.getByRole('heading', { name: /products/i })).toBeVisible();
    
    // Verify search input is visible
    await expect(page.getByLabel(/search/i)).toBeVisible();
  });

  test('it shall display empty invoice state initially', async function ({ page }) {
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
                  <pos-view></pos-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    // Verify empty state messages
    await expect(page.getByText(/no items added/i)).toBeVisible();
    await expect(page.getByText(/no discounts applied/i)).toBeVisible();
    await expect(page.getByText(/no payments added/i)).toBeVisible();
    
    // Verify submit button is disabled
    await expect(page.getByRole('button', { name: /complete sale/i })).toBeDisabled();
  });

  test('it shall display inventories in the selector', async function ({ page }) {
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
                  <pos-view></pos-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    // Wait for inventories to load
    await expect(page.getByRole('listitem').filter({ hasText: 'Product A' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Product B' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Product C' })).toBeVisible();
    
    // Verify stock information is displayed
    await expect(page.getByText(/stock.*100/i)).toBeVisible();
  });

  test('it shall add inventory to sale when clicked', async function ({ page }) {
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
                  <pos-view></pos-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    // Wait for inventories to load
    await expect(page.getByRole('listitem').filter({ hasText: 'Product A' })).toBeVisible();
    
    // Click on Product A in the inventory selector
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();

    // Verify product appears in the items table
    const itemsTable = page.getByRole('table', { name: /items/i });
    await expect(itemsTable.getByText('Product A')).toBeVisible();
    
    // Verify quantity is 1
    await expect(itemsTable.getByText('1', { exact: true })).toBeVisible();
  });

  test('it shall increment quantity when same item is added multiple times', async function ({ page }) {
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
                  <pos-view></pos-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    // Wait for inventories to load
    await expect(page.getByRole('listitem').filter({ hasText: 'Product A' })).toBeVisible();
    
    // Add Product A twice
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();

    // Verify quantity is 2
    const itemsTable = page.getByRole('table', { name: /items/i });
    const productRow = itemsTable.getByRole('row').filter({ hasText: 'Product A' });
    await expect(productRow.getByText('2')).toBeVisible();
  });

  test('it shall allow incrementing item quantity using plus button', async function ({ page }) {
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
                  <pos-view></pos-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    // Add Product A
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    
    const itemsTable = page.getByRole('table', { name: /items/i });
    const productRow = itemsTable.getByRole('row').filter({ hasText: 'Product A' });
    
    // Click increment button
    await productRow.getByRole('button', { name: /increase quantity/i }).click();

    // Verify quantity is 2
    await expect(productRow.getByText('2')).toBeVisible();
  });

  test('it shall allow decrementing item quantity using minus button', async function ({ page }) {
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
                  <pos-view></pos-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    // Add Product A twice
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    
    const itemsTable = page.getByRole('table', { name: /items/i });
    const productRow = itemsTable.getByRole('row').filter({ hasText: 'Product A' });
    
    // Click decrement button
    await productRow.getByRole('button', { name: /decrease quantity/i }).click();

    // Verify quantity is 1
    await expect(productRow.getByText('1', { exact: true })).toBeVisible();
  });

  test('it shall remove item when quantity is decremented to zero', async function ({ page }) {
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
                  <pos-view></pos-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    // Add Product A once
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    
    const itemsTable = page.getByRole('table', { name: /items/i });
    const productRow = itemsTable.getByRole('row').filter({ hasText: 'Product A' });
    
    // Click decrement button
    await productRow.getByRole('button', { name: /decrease quantity/i }).click();

    // Verify item is removed (empty state shown)
    await expect(page.getByText(/no items added/i)).toBeVisible();
  });

  test('it shall allow removing item using delete button', async function ({ page }) {
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
                  <pos-view></pos-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    // Add Product A with quantity 3
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    
    const itemsTable = page.getByRole('table', { name: /items/i });
    const productRow = itemsTable.getByRole('row').filter({ hasText: 'Product A' });
    
    // Click remove button
    await productRow.getByRole('button', { name: /remove item/i }).click();

    // Verify item is removed
    await expect(page.getByText(/no items added/i)).toBeVisible();
  });

  test('it shall filter inventories when search query is entered', async function ({ page }) {
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
                  <pos-view></pos-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    // Wait for all products to load
    await expect(page.getByRole('listitem').filter({ hasText: 'Product A' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Product B' })).toBeVisible();
    
    // Search for "Product A"
    await page.getByLabel(/search/i).fill('Product A');

    // Verify only Product A is visible
    await expect(page.getByRole('listitem').filter({ hasText: 'Product A' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Product B' })).not.toBeVisible();
  });

  test('it shall display total amount correctly', async function ({ page }) {
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
                  <pos-view></pos-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    // Add Product A (10,000) and Product B (20,000)
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    await page.getByRole('listitem').filter({ hasText: 'Product B' }).click();

    // Verify total amount shows 30,000 (in IDR format)
    await expect(page.getByText(/total/i).and(page.getByText(/30,000/i))).toBeVisible();
  });

  test('it shall clear sale when clear button is clicked', async function ({ page }) {
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
                  <pos-view></pos-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    // Add items
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    
    // Verify item is in the table
    const itemsTable = page.getByRole('table', { name: /items/i });
    await expect(itemsTable.getByText('Product A')).toBeVisible();
    
    // Click clear button
    await page.getByRole('button', { name: /clear/i }).click();

    // Verify sale is cleared
    await expect(page.getByText(/no items added/i)).toBeVisible();
  });

  test('it shall show error when trying to complete sale without payment', async function ({ page }) {
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
                  <pos-view></pos-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    // Add item
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    
    // Verify submit button is disabled (payment incomplete)
    await expect(page.getByRole('button', { name: /complete sale/i })).toBeDisabled();
  });
});
