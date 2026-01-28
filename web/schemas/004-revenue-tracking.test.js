import { describe, it } from 'node:test';
import { equal } from 'node:assert/strict';
import { useSql } from '#test/nodejs/hooks/use-sql.js';

describe('Revenue Tracking Schema Tests', function () {
  const sql = useSql();
  const testTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();

  /**
   * Convert a timestamp to its date_key (start of day in UTC)
   * Matches the SQL logic: strftime('%s', datetime(time / 1000, 'unixepoch', 'start of day')) * 1000
   * @param {number} timestamp - Unix timestamp in milliseconds
   * @returns {number} - Date key (start of day in UTC, in milliseconds)
   */
  function getDateKey(timestamp) {
    const date = new Date(timestamp);
    const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
    return utcDate.getTime();
  }

  /**
   * @param {number} code
   * @param {string} name
   * @param {number} normalBalance
   * @param {string} [tag]
   */
  async function createAccount(code, name, normalBalance, tag) {
    await sql`
      INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
      VALUES (${code}, ${name}, ${normalBalance}, ${testTime}, ${testTime})
    `;
    if (tag) {
      await sql`INSERT INTO account_tags (account_code, tag) VALUES (${code}, ${tag})`;
    }
  }

  async function setupPOSAccounts() {
    await createAccount(1100, 'Inventory Asset', 0, 'POS - Inventory');
    await createAccount(4000, 'Sales Revenue', 1, 'POS - Sales Revenue');
    await createAccount(4100, 'Sales Discount', 0, 'POS - Sales Discount');
    await createAccount(5000, 'COGS', 0, 'POS - Cost of Goods Sold');
    await createAccount(1000, 'Cash', 0, 'POS - Payment Method');
  }

  async function createInventory(name, price, cost, stock) {
    if (cost > 0) {
      await sql`
        UPDATE accounts SET balance = balance + ${cost} WHERE account_code = 1100
      `;
    }
    const result = await sql`
      INSERT INTO inventories (name, unit_price, account_code, cost, stock)
      VALUES (${name}, ${price}, 1100, ${cost}, ${stock}) RETURNING id
    `;
    return Number(result.rows[0].id);
  }

  async function createPaymentMethod(name) {
    const result = await sql`
      INSERT INTO payment_methods (account_code, name) VALUES (1000, ${name}) RETURNING id
    `;
    return Number(result.rows[0].id);
  }

  async function createSale(saleTime) {
    const result = await sql`
      INSERT INTO sales (sale_time) VALUES (${saleTime}) RETURNING id
    `;
    return Number(result.rows[0].id);
  }

  async function addSaleLine(saleId, inventoryId, quantity, price) {
    await sql`
      INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost)
      VALUES (${saleId}, (SELECT COALESCE(MAX(line_number), 0) + 1 FROM sale_lines WHERE sale_id = ${saleId}), ${inventoryId}, ${quantity}, ${price}, 0)
    `;
  }

  async function addSaleDiscount(saleId, amount) {
    let discountId;
    const discountRes = await sql`SELECT id FROM discounts WHERE name = 'General Discount'`;
    if (discountRes.rows.length > 0) {
      discountId = Number(discountRes.rows[0].id);
    } else {
      const res = await sql`
        INSERT INTO discounts (name, multiple_of_quantity, amount) VALUES ('General Discount', 1, 0) RETURNING id
      `;
      discountId = Number(res.rows[0].id);
    }

    await sql`
      INSERT INTO sale_discounts (sale_id, line_number, discount_id, amount)
      VALUES (${saleId}, (SELECT COALESCE(MAX(line_number), 0) + 1 FROM sale_discounts WHERE sale_id = ${saleId}), ${discountId}, ${amount})
    `;
  }

  async function addSalePayment(saleId, paymentMethodId, amount) {
    await sql`
      INSERT INTO sale_payments (sale_id, line_number, payment_method_id, amount)
      VALUES (${saleId}, (SELECT COALESCE(MAX(line_number), 0) + 1 FROM sale_payments WHERE sale_id = ${saleId}), ${paymentMethodId}, ${amount})
    `;
  }

  async function postSale(saleId, postTime) {
    await sql`
      UPDATE sales SET post_time = ${postTime} WHERE id = ${saleId}
    `;
  }

  describe('Daily Revenue Tracking', function () {
    it('shall track daily revenue when sale is posted', async function () {
      await setupPOSAccounts();
      const invId = await createInventory('Item A', 1000, 500, 100);
      const pmId = await createPaymentMethod('Cash');

      const saleId = await createSale(testTime);
      await addSaleLine(saleId, invId, 1, 1000);
      await addSalePayment(saleId, pmId, 1000);

      await postSale(saleId, testTime);

      const testDateKey = getDateKey(testTime);
      const result = await sql`SELECT * FROM daily_revenue WHERE date_key = ${testDateKey}`;
      equal(result.rows.length, 1);
      equal(Number(result.rows[0].gross_revenue), 1000);
      equal(Number(result.rows[0].net_revenue), 1000);
      equal(Number(result.rows[0].transaction_count), 1);
    });

    it('shall track discounts correctly', async function () {
      await setupPOSAccounts();
      const invId = await createInventory('Item A', 1000, 500, 100);
      const pmId = await createPaymentMethod('Cash');

      const saleId = await createSale(testTime);
      await addSaleLine(saleId, invId, 1, 1000);
      await addSaleDiscount(saleId, 100);
      await addSalePayment(saleId, pmId, 900);

      await postSale(saleId, testTime);

      const testDateKey = getDateKey(testTime);
      const result = await sql`SELECT * FROM daily_revenue WHERE date_key = ${testDateKey}`;
      equal(Number(result.rows[0].gross_revenue), 1000);
      equal(Number(result.rows[0].discount_amount), 100);
      equal(Number(result.rows[0].net_revenue), 900);
    });

    it('shall aggregate multiple sales on the same day', async function () {
      await setupPOSAccounts();
      const invId = await createInventory('Item A', 1000, 500, 100);
      const pmId = await createPaymentMethod('Cash');

      // Sale 1
      const saleId1 = await createSale(testTime);
      await addSaleLine(saleId1, invId, 1, 1000);
      await addSalePayment(saleId1, pmId, 1000);
      await postSale(saleId1, testTime);

      // Sale 2
      const saleId2 = await createSale(testTime + 3600000); // 1 hour later
      await addSaleLine(saleId2, invId, 2, 2000);
      await addSalePayment(saleId2, pmId, 2000);
      await postSale(saleId2, testTime + 3600000);

      const testDateKey = getDateKey(testTime);
      const result = await sql`SELECT * FROM daily_revenue WHERE date_key = ${testDateKey}`;
      equal(Number(result.rows[0].gross_revenue), 3000);
      equal(Number(result.rows[0].transaction_count), 2);
    });
  });


  describe('Revenue Analytics', function () {
    it('shall provide revenue period comparison', async function () {
      await setupPOSAccounts();
      const invId = await createInventory('Item A', 1000, 500, 100);
      const pmId = await createPaymentMethod('Cash');

      // Current Period (Last 7 days)
      const today = new Date().setHours(0, 0, 0, 0);
      const yesterday = today - 86400000;

      const saleId1 = await createSale(yesterday + 3600000);
      await addSaleLine(saleId1, invId, 1, 2000);
      await addSalePayment(saleId1, pmId, 2000);
      await postSale(saleId1, yesterday + 3600000);

      // Previous Period (8-14 days ago)
      const tenDaysAgo = today - (10 * 86400000);

      const saleId2 = await createSale(tenDaysAgo + 3600000);
      await addSaleLine(saleId2, invId, 1, 1000);
      await addSalePayment(saleId2, pmId, 1000);
      await postSale(saleId2, tenDaysAgo + 3600000);

      const result = await sql`SELECT * FROM revenue_period_comparison`;

      equal(Number(result.rows[0].current_net_revenue), 2000);
      equal(Number(result.rows[0].previous_net_revenue), 1000);
      equal(Number(result.rows[0].revenue_change_percent), 100.0);
    });

    it('shall provide sparkline data', async function () {
      await setupPOSAccounts();
      const invId = await createInventory('Item A', 1000, 500, 100);
      const pmId = await createPaymentMethod('Cash');

      const now = Date.now();
      const today = getDateKey(now);
      const yesterday = getDateKey(now - 86400000);

      const saleId = await createSale(yesterday + 3600000);
      await addSaleLine(saleId, invId, 1, 1500);
      await addSalePayment(saleId, pmId, 1500);
      await postSale(saleId, yesterday + 3600000);

      const result = await sql`SELECT * FROM revenue_sparkline`;

      // Should return 7 rows (today + 6 days back)
      equal(result.rows.length, 7);

      // Find yesterday's entry
      const yesterdayEntry = result.rows.find(r => Number(r.date_key) === yesterday);
      equal(Number(yesterdayEntry.net_revenue), 1500);

      // Find today's entry (should be 0)
      const todayEntry = result.rows.find(r => Number(r.date_key) === today);
      equal(Number(todayEntry.net_revenue), 0);
    });
  });


  describe('Fiscal Year Revenue Summary', function () {
    it('shall provide fiscal year revenue summary', async function () {
      await setupPOSAccounts();
      const invId = await createInventory('Item A', 1000, 500, 100);
      const pmId = await createPaymentMethod('Cash');

      // Fiscal year boundaries should use the same UTC-based date_key logic
      const beginTime = getDateKey(new Date(2025, 0, 1, 0, 0, 0, 0).getTime());
      const endTime = getDateKey(new Date(2026, 0, 1, 0, 0, 0, 0).getTime());

      await sql`
        INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2025')
      `;

      const saleId = await createSale(testTime); // Jan 1 2025
      await addSaleLine(saleId, invId, 1, 5000);
      await addSalePayment(saleId, pmId, 5000);
      await postSale(saleId, testTime);

      const result = await sql`SELECT * FROM fiscal_year_revenue_summary`;

      equal(result.rows.length, 1);
      equal(result.rows[0].fiscal_year_name, 'FY2025');
      equal(Number(result.rows[0].total_net_revenue), 5000);
    });
  });
});
