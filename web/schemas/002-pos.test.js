import { ok, equal } from 'node:assert/strict';
import { describe, it } from 'node:test';

import { useSql } from '#web/schemas/test/hooks/use-sql.js';

describe('POS Schema Tests', function () {
  const sql = useSql();
  const testTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();

  // Account codes from chart of accounts (003-chart-of-accounts.sql)
  const ACCOUNT_KAS = 11110;
  const ACCOUNT_BANK_BCA = 11120;
  const ACCOUNT_QRIS = 11140;
  const ACCOUNT_PERSEDIAAN = 11310;
  const ACCOUNT_UTANG_USAHA = 21100;
  const ACCOUNT_PENJUALAN = 41000;
  const ACCOUNT_DISKON_PENJUALAN = 42000;
  const ACCOUNT_HPP = 51000;
  const ACCOUNT_BEBAN_ADMIN_BANK = 61700;
  const ACCOUNT_SELISIH_PERSEDIAAN = 61800;
  const ACCOUNT_KEUNTUNGAN_SELISIH = 81100;

  /**
   * Setup complete chart of accounts using the Retail Business - Indonesia template
   */
  async function setupCompleteChartOfAccounts() {
    await sql`INSERT INTO chart_of_accounts_templates (name) VALUES (${'Retail Business - Indonesia'})`;
  }

  /**
   * @param {string} name
   * @param {number} unitPrice
   * @param {string} unitOfMeasurement
   * @param {number} accountCode
   */
  async function createInventory(name, unitPrice, unitOfMeasurement, accountCode) {
    const result = await sql`
      INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
      VALUES (${name}, ${unitPrice}, ${unitOfMeasurement}, ${accountCode})
      RETURNING id
    `;
    return Number(result.rows[0].id);
  }

  /**
   * @param {string} name
   * @param {string} [phoneNumber]
   */
  async function createSupplier(name, phoneNumber) {
    const result = await sql`
      INSERT INTO suppliers (name, phone_number) VALUES (${name}, ${phoneNumber ?? null})
      RETURNING id
    `;
    return Number(result.rows[0].id);
  }

  /**
   * @param {number} accountCode
   * @param {string} name
   * @param {number} [minFee]
   * @param {number} [maxFee]
   * @param {number} [relFee]
   */
  async function createPaymentMethod(accountCode, name, minFee, maxFee, relFee) {
    const result = await sql`
      INSERT INTO payment_methods (account_code, name, min_fee, max_fee, rel_fee)
      VALUES (${accountCode}, ${name}, ${minFee ?? 0}, ${maxFee ?? 0}, ${relFee ?? 0})
      RETURNING id
    `;
    return Number(result.rows[0].id);
  }

  /**
   * @param {string} name
   * @param {number|null} inventoryId
   * @param {number} multipleOfQuantity
   * @param {number} amount
   */
  async function createDiscount(name, inventoryId, multipleOfQuantity, amount) {
    const result = await sql`
      INSERT INTO discounts (name, inventory_id, multiple_of_quantity, amount)
      VALUES (${name}, ${inventoryId}, ${multipleOfQuantity}, ${amount})
      RETURNING id
    `;
    return Number(result.rows[0].id);
  }

  /**
   * @param {number} supplierId
   * @param {Date} purchaseDate
   */
  async function createPurchase(supplierId, purchaseDate) {
    const result = await sql`
      INSERT INTO purchases (supplier_id, purchase_time) VALUES (${supplierId}, ${purchaseDate.getTime()})
      RETURNING id
    `;
    return Number(result.rows[0].id);
  }

  /**
   * @param {number} purchaseId
   * @param {number} lineNumber
   * @param {number} inventoryId
   * @param {number} quantity
   * @param {number} price
   */
  async function addPurchaseLine(purchaseId, lineNumber, inventoryId, quantity, price) {
    await sql`
      INSERT INTO purchase_lines (purchase_id, line_number, inventory_id, supplier_quantity, quantity, price)
      VALUES (${purchaseId}, ${lineNumber}, ${inventoryId}, ${quantity}, ${quantity}, ${price})
    `;
  }

  /**
   * @param {number} purchaseId
   * @param {Date} postDate
   */
  async function postPurchase(purchaseId, postDate) {
    await sql`UPDATE purchases SET post_time = ${postDate.getTime()} WHERE id = ${purchaseId}`;
  }

  /**
   * @param {Date} saleDate
   */
  async function createSale(saleDate) {
    const result = await sql`INSERT INTO sales (sale_time) VALUES (${saleDate.getTime()}) RETURNING id`;
    return Number(result.rows[0].id);
  }

  /**
   * @param {number} saleId
   * @param {number} lineNumber
   * @param {number} inventoryId
   * @param {number} quantity
   * @param {number} price
   */
  async function addSaleLine(saleId, lineNumber, inventoryId, quantity, price) {
    await sql`
      INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost)
      VALUES (${saleId}, ${lineNumber}, ${inventoryId}, ${quantity}, ${price}, ${0})
    `;
  }

  /**
   * @param {number} saleId
   * @param {number} lineNumber
   * @param {number} paymentMethodId
   * @param {number} amount
   */
  async function addSalePayment(saleId, lineNumber, paymentMethodId, amount) {
    await sql`
      INSERT INTO sale_payments (sale_id, line_number, payment_method_id, amount)
      VALUES (${saleId}, ${lineNumber}, ${paymentMethodId}, ${amount})
    `;
  }

  /**
   * @param {number} saleId
   * @param {Date} postDate
   */
  async function postSale(saleId, postDate) {
    await sql`UPDATE sales SET post_time = ${postDate.getTime()} WHERE id = ${saleId}`;
  }

  describe('Inventories', function () {
    it('shall create inventory with valid POS inventory account', async function () {
      await setupCompleteChartOfAccounts();

      const inventoryId = await createInventory('Roti Tawar', 15000, 'pcs', ACCOUNT_PERSEDIAAN);

      const result = await sql`SELECT * FROM inventories WHERE id = ${inventoryId}`;
      equal(result.rows.length, 1);
      equal(result.rows[0].name, 'Roti Tawar');
      equal(Number(result.rows[0].unit_price), 15000);
      equal(Number(result.rows[0].stock), 0);
      equal(Number(result.rows[0].cost), 0);
      equal(Number(result.rows[0].num_of_sales), 0);
    });

    it('shall reject inventory creation with non-POS inventory account', async function () {
      await setupCompleteChartOfAccounts();

      try {
        await sql`
          INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
          VALUES (${'Invalid Inventory'}, ${10000}, ${'pcs'}, ${ACCOUNT_KAS})
        `;
        ok(false, 'Should have thrown error');
      } catch (error) {
        ok(error.message.includes('Inventory account code must be tagged as "POS - Inventory"'));
      }
    });

    it('shall create inventory barcodes', async function () {
      await setupCompleteChartOfAccounts();

      const inventoryId = await createInventory('Susu Kotak', 8000, 'pcs', ACCOUNT_PERSEDIAAN);

      await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES (${'8991234567890'}, ${inventoryId})`;

      const barcode = (await sql`SELECT * FROM inventory_barcodes WHERE code = ${'8991234567890'}`).rows[0];
      equal(barcode.code, '8991234567890');
      equal(Number(barcode.inventory_id), inventoryId);
    });
  });

  describe('Suppliers', function () {
    it('shall create supplier', async function () {
      await setupCompleteChartOfAccounts();

      const supplierId = await createSupplier('PT Supplier Utama', '081234567890');

      const result = await sql`SELECT * FROM suppliers WHERE id = ${supplierId}`;
      equal(result.rows.length, 1);
      equal(result.rows[0].name, 'PT Supplier Utama');
      equal(result.rows[0].phone_number, '081234567890');
    });

    it('shall create supplier inventory with quantity conversion', async function () {
      await setupCompleteChartOfAccounts();

      const supplierId = await createSupplier('PT Suplai Grosir', '081111222333');
      const inventoryId = await createInventory('Mie Instan', 3000, 'pcs', ACCOUNT_PERSEDIAAN);

      // Supplier sells in boxes of 40 pieces
      await sql`
        INSERT INTO supplier_inventories (supplier_id, inventory_id, quantity_conversion, name)
        VALUES (${supplierId}, ${inventoryId}, ${40}, ${'Mie Instan Box'})
      `;

      const result = await sql`
        SELECT * FROM supplier_inventories WHERE supplier_id = ${supplierId} AND inventory_id = ${inventoryId}
      `;
      equal(result.rows.length, 1);
      equal(Number(result.rows[0].quantity_conversion), 40);
      equal(result.rows[0].name, 'Mie Instan Box');
    });
  });

  describe('Payment Methods', function () {
    it('shall create payment method with valid POS payment account', async function () {
      await setupCompleteChartOfAccounts();

      const paymentMethodId = await createPaymentMethod(ACCOUNT_KAS, 'Cash', 0, 0, 0);

      const result = await sql`SELECT * FROM payment_methods WHERE id = ${paymentMethodId}`;
      equal(result.rows.length, 1);
      equal(result.rows[0].name, 'Cash');
      equal(Number(result.rows[0].account_code), ACCOUNT_KAS);
    });

    it('shall reject payment method with non-POS payment account', async function () {
      await setupCompleteChartOfAccounts();

      try {
        await sql`
          INSERT INTO payment_methods (account_code, name)
          VALUES (${ACCOUNT_PERSEDIAAN}, ${'Invalid Payment'})
        `;
        ok(false, 'Should have thrown error');
      } catch (error) {
        ok(error.message.includes('Payment method account code must be tagged as "POS - Payment Method"'));
      }
    });

    it('shall create payment method with fees', async function () {
      await setupCompleteChartOfAccounts();

      // QRIS with 0.7% fee (rel_fee = 7000 = 0.7%)
      const paymentMethodId = await createPaymentMethod(ACCOUNT_QRIS, 'QRIS', 0, 5000, 7000);

      const result = await sql`SELECT * FROM payment_methods WHERE id = ${paymentMethodId}`;
      equal(Number(result.rows[0].rel_fee), 7000);
      equal(Number(result.rows[0].max_fee), 5000);
    });
  });

  describe('Discounts', function () {
    it('shall create global discount', async function () {
      await setupCompleteChartOfAccounts();

      const discountId = await createDiscount('Weekend Promo', null, 1, 5000);

      const result = await sql`SELECT * FROM discounts WHERE id = ${discountId}`;
      equal(result.rows.length, 1);
      equal(result.rows[0].inventory_id, null);
      equal(Number(result.rows[0].amount), 5000);
    });

    it('shall create inventory-specific discount', async function () {
      await setupCompleteChartOfAccounts();

      const inventoryId = await createInventory('Teh Botol', 5000, 'pcs', ACCOUNT_PERSEDIAAN);

      // Buy 3, get 500 IDR off
      const discountId = await createDiscount('Beli 3 Hemat 500', inventoryId, 3, 500);

      const result = await sql`SELECT * FROM discounts WHERE id = ${discountId}`;
      equal(Number(result.rows[0].inventory_id), inventoryId);
      equal(Number(result.rows[0].multiple_of_quantity), 3);
      equal(Number(result.rows[0].amount), 500);
    });
  });

  describe('Purchases', function () {
    it('shall create and post purchase with journal entry', async function () {
      await setupCompleteChartOfAccounts();

      const purchaseDate = new Date(2025, 0, 15, 10, 0, 0, 0);
      const postDate = new Date(2025, 0, 15, 10, 30, 0, 0);

      // Create supplier and inventory
      const supplierId = await createSupplier('Supplier A');
      const inventoryId = await createInventory('Kopi Sachet', 2000, 'pcs', ACCOUNT_PERSEDIAAN);

      // Create and post purchase: 100 sachets @ 150,000 IDR
      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 100, 150000);
      await postPurchase(purchaseId, postDate);

      // Verify inventory updated
      const updatedInventory = (await sql`SELECT * FROM inventories WHERE id = ${inventoryId}`).rows[0];
      equal(Number(updatedInventory.stock), 100);
      equal(Number(updatedInventory.cost), 150000);

      // Verify journal entry created
      const journalEntry = (await sql`
        SELECT * FROM journal_entries WHERE source_reference = ${'Purchase #' + purchaseId}
      `).rows[0];
      ok(journalEntry, 'Journal entry should be created');
      ok(journalEntry.post_time, 'Journal entry should be posted');

      // Verify account balances
      const inventoryAccount = (await sql`SELECT balance FROM accounts WHERE account_code = ${ACCOUNT_PERSEDIAAN}`).rows[0];
      const apAccount = (await sql`SELECT balance FROM accounts WHERE account_code = ${ACCOUNT_UTANG_USAHA}`).rows[0];

      equal(Number(inventoryAccount.balance), 150000, 'Inventory account should be debited');
      equal(Number(apAccount.balance), 150000, 'AP account should be credited');
    });

    it('shall handle purchase with catch-up COGS for negative stock', async function () {
      await setupCompleteChartOfAccounts();

      const firstPurchaseDate = new Date(2025, 1, 1, 10, 0, 0, 0);
      const saleDate = new Date(2025, 1, 2, 14, 0, 0, 0);
      const catchupPurchaseDate = new Date(2025, 1, 3, 10, 0, 0, 0);

      // Setup
      const supplierId = await createSupplier('Supplier B');
      const inventoryId = await createInventory('Gula Pasir', 15000, 'kg', ACCOUNT_PERSEDIAAN);

      // First purchase: 10 kg @ 120,000 IDR
      const purchase1Id = await createPurchase(supplierId, firstPurchaseDate);
      await addPurchaseLine(purchase1Id, 1, inventoryId, 10, 120000);
      await postPurchase(purchase1Id, firstPurchaseDate);

      // Sale: 15 kg (this will create negative stock of -5)
      const paymentMethodId = await createPaymentMethod(ACCOUNT_KAS, 'Tunai');
      const saleId = await createSale(saleDate);
      await addSaleLine(saleId, 1, inventoryId, 15, 225000);
      await addSalePayment(saleId, 1, paymentMethodId, 225000);
      await postSale(saleId, saleDate);

      // Verify negative stock
      let inventoryState = (await sql`SELECT * FROM inventories WHERE id = ${inventoryId}`).rows[0];
      equal(Number(inventoryState.stock), -5, 'Stock should be negative after overselling');

      // Catch-up purchase: 20 kg @ 250,000 IDR (12,500 per kg)
      const purchase2Id = await createPurchase(supplierId, catchupPurchaseDate);
      await addPurchaseLine(purchase2Id, 1, inventoryId, 20, 250000);
      await postPurchase(purchase2Id, catchupPurchaseDate);

      // Verify catch-up COGS
      // Catch-up COGS = MIN(5, 20) * (250000 / 20) = 5 * 12500 = 62,500
      // Inventory increase = 250000 - 62500 = 187,500
      inventoryState = (await sql`SELECT * FROM inventories WHERE id = ${inventoryId}`).rows[0];
      equal(Number(inventoryState.stock), 15, 'Stock should be 15 after catch-up purchase');
      // Cost should be: remaining from sale (0) + catch-up purchase net = 187,500
      equal(Number(inventoryState.cost), 187500, 'Cost should reflect catch-up COGS deduction');

      // Verify COGS account was debited for catch-up
      const cogsAccount = (await sql`SELECT balance FROM accounts WHERE account_code = ${ACCOUNT_HPP}`).rows[0];
      ok(Number(cogsAccount.balance) > 0, 'COGS should be recorded for catch-up');
    });
  });

  describe('Sales', function () {
    it('shall create and post sale with journal entry', async function () {
      await setupCompleteChartOfAccounts();

      const purchaseDate = new Date(2025, 0, 10, 8, 0, 0, 0);
      const saleDate = new Date(2025, 0, 15, 14, 0, 0, 0);

      // Setup supplier and inventory
      const supplierId = await createSupplier('Supplier C');
      const inventoryId = await createInventory('Air Mineral', 4000, 'btl', ACCOUNT_PERSEDIAAN);

      // Purchase first: 50 bottles @ 100,000 IDR (2,000 per bottle cost)
      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 50, 100000);
      await postPurchase(purchaseId, purchaseDate);

      // Setup payment method and create sale: 10 bottles @ 40,000 IDR
      const paymentMethodId = await createPaymentMethod(ACCOUNT_KAS, 'Kas');
      const saleId = await createSale(saleDate);
      await addSaleLine(saleId, 1, inventoryId, 10, 40000);

      // Verify cost is auto-calculated
      const saleLine = (await sql`SELECT * FROM sale_lines WHERE sale_id = ${saleId} AND line_number = 1`).rows[0];
      equal(Number(saleLine.cost), 20000, 'Cost should be auto-calculated (10 * 2000)');

      await addSalePayment(saleId, 1, paymentMethodId, 40000);
      await postSale(saleId, saleDate);

      // Verify sale totals updated
      const postedSale = (await sql`SELECT * FROM sales WHERE id = ${saleId}`).rows[0];
      equal(Number(postedSale.gross_amount), 40000);
      equal(Number(postedSale.discount_amount), 0);
      equal(Number(postedSale.invoice_amount), 40000);

      // Verify inventory updated
      const updatedInventory = (await sql`SELECT * FROM inventories WHERE id = ${inventoryId}`).rows[0];
      equal(Number(updatedInventory.stock), 40, 'Stock should decrease by 10');
      equal(Number(updatedInventory.cost), 80000, 'Cost should decrease by 20000');
      equal(Number(updatedInventory.num_of_sales), 10, 'num_of_sales should increase by 10');

      // Verify journal entry
      const journalEntry = (await sql`SELECT * FROM journal_entries WHERE source_reference = ${'Sale #' + saleId}`).rows[0];
      ok(journalEntry, 'Journal entry should be created');

      // Verify account balances
      const cashAccount = (await sql`SELECT balance FROM accounts WHERE account_code = ${ACCOUNT_KAS}`).rows[0];
      const revenueAccount = (await sql`SELECT balance FROM accounts WHERE account_code = ${ACCOUNT_PENJUALAN}`).rows[0];
      const cogsAccount = (await sql`SELECT balance FROM accounts WHERE account_code = ${ACCOUNT_HPP}`).rows[0];

      equal(Number(cashAccount.balance), 40000, 'Cash should be debited');
      equal(Number(revenueAccount.balance), 40000, 'Revenue should be credited');
      equal(Number(cogsAccount.balance), 20000, 'COGS should be debited');
    });

    it('shall create sale with discount', async function () {
      await setupCompleteChartOfAccounts();

      const purchaseDate = new Date(2025, 1, 1, 8, 0, 0, 0);
      const saleDate = new Date(2025, 1, 5, 15, 0, 0, 0);

      // Setup
      const supplierId = await createSupplier('Supplier D');
      const inventoryId = await createInventory('Snack', 10000, 'pcs', ACCOUNT_PERSEDIAAN);

      // Purchase: 100 pcs @ 500,000 IDR
      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 100, 500000);
      await postPurchase(purchaseId, purchaseDate);

      // Create discount: Buy 3 get 2000 off
      const discountId = await createDiscount('Beli 3 Diskon', inventoryId, 3, 2000);

      // Create sale: 7 pieces (floor(7/3) * 2000 = 4000 discount)
      const paymentMethodId = await createPaymentMethod(ACCOUNT_KAS, 'Tunai2');
      const saleId = await createSale(saleDate);
      await addSaleLine(saleId, 1, inventoryId, 7, 70000);

      await sql`
        INSERT INTO sale_discounts (sale_id, line_number, discount_id, amount)
        VALUES (${saleId}, ${1}, ${discountId}, ${4000})
      `;

      // Payment: 70000 - 4000 = 66000
      await addSalePayment(saleId, 1, paymentMethodId, 66000);
      await postSale(saleId, saleDate);

      // Verify sale totals
      const postedSale = (await sql`SELECT * FROM sales WHERE id = ${saleId}`).rows[0];
      equal(Number(postedSale.gross_amount), 70000);
      equal(Number(postedSale.discount_amount), 4000);
      equal(Number(postedSale.invoice_amount), 66000);

      // Verify discount account
      const discountAccount = (await sql`SELECT balance FROM accounts WHERE account_code = ${ACCOUNT_DISKON_PENJUALAN}`).rows[0];
      equal(Number(discountAccount.balance), 4000, 'Discount contra-revenue should be debited');
    });

    it('shall prevent deleting sale line for posted sale', async function () {
      await setupCompleteChartOfAccounts();

      const purchaseDate = new Date(2025, 2, 1, 8, 0, 0, 0);
      const saleDate = new Date(2025, 2, 5, 10, 0, 0, 0);

      // Setup
      const supplierId = await createSupplier('Supplier E');
      const inventoryId = await createInventory('Permen', 500, 'pcs', ACCOUNT_PERSEDIAAN);

      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 200, 40000);
      await postPurchase(purchaseId, purchaseDate);

      const paymentMethodId = await createPaymentMethod(ACCOUNT_KAS, 'Tunai3');
      const saleId = await createSale(saleDate);
      await addSaleLine(saleId, 1, inventoryId, 10, 5000);
      await addSalePayment(saleId, 1, paymentMethodId, 5000);
      await postSale(saleId, saleDate);

      // Try to delete sale line
      try {
        await sql`DELETE FROM sale_lines WHERE sale_id = ${saleId}`;
        ok(false, 'Should have thrown error');
      } catch (error) {
        ok(error.message.includes('Cannot delete sale line for posted sale'));
      }
    });

    it('shall allow zero-cost sale when stock is zero or negative', async function () {
      await setupCompleteChartOfAccounts();

      const saleDate = new Date(2025, 3, 1, 10, 0, 0, 0);

      // Create inventory with zero stock
      const inventoryId = await createInventory('Pre-order Item', 50000, 'pcs', ACCOUNT_PERSEDIAAN);
      const paymentMethodId = await createPaymentMethod(ACCOUNT_KAS, 'Tunai4');

      // Create and post sale with zero stock
      const saleId = await createSale(saleDate);
      await addSaleLine(saleId, 1, inventoryId, 5, 250000);

      // Verify cost is 0 due to zero stock
      const saleLine = (await sql`SELECT * FROM sale_lines WHERE sale_id = ${saleId}`).rows[0];
      equal(Number(saleLine.cost), 0, 'Cost should be 0 when stock is zero');

      await addSalePayment(saleId, 1, paymentMethodId, 250000);
      await postSale(saleId, saleDate);

      // Verify negative stock
      const updatedInventory = (await sql`SELECT * FROM inventories WHERE id = ${inventoryId}`).rows[0];
      equal(Number(updatedInventory.stock), -5, 'Stock should be negative');
      equal(Number(updatedInventory.cost), 0, 'Cost should remain 0');
    });
  });

  describe('Stock Taking', function () {
    it('shall record stock taking with gain adjustment', async function () {
      await setupCompleteChartOfAccounts();

      const purchaseDate = new Date(2025, 4, 1, 8, 0, 0, 0);
      const auditDate = new Date(2025, 4, 15, 9, 0, 0, 0);

      // Setup
      const supplierId = await createSupplier('Supplier F');
      const inventoryId = await createInventory('Buku Tulis', 5000, 'pcs', ACCOUNT_PERSEDIAAN);

      // Purchase: 50 pcs @ 150,000 (3,000 per unit)
      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 50, 150000);
      await postPurchase(purchaseId, purchaseDate);

      // Stock taking: found 55 pcs (gain of 5 pcs)
      // Expected cost: 150,000, Actual cost = 55 * 3000 = 165,000
      await sql`
        INSERT INTO stock_takings (inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost)
        VALUES (${inventoryId}, ${auditDate.getTime()}, ${50}, ${55}, ${150000}, ${165000})
      `;

      // Verify inventory updated
      const updatedInventory = (await sql`SELECT * FROM inventories WHERE id = ${inventoryId}`).rows[0];
      equal(Number(updatedInventory.stock), 55);
      equal(Number(updatedInventory.cost), 165000);

      // Verify gain account credited
      const gainAccount = (await sql`SELECT balance FROM accounts WHERE account_code = ${ACCOUNT_KEUNTUNGAN_SELISIH}`).rows[0];
      equal(Number(gainAccount.balance), 15000, 'Inventory Gain should be credited');
    });

    it('shall record stock taking with shrinkage adjustment', async function () {
      await setupCompleteChartOfAccounts();

      const purchaseDate = new Date(2025, 5, 1, 8, 0, 0, 0);
      const auditDate = new Date(2025, 5, 15, 9, 0, 0, 0);

      // Setup
      const supplierId = await createSupplier('Supplier G');
      const inventoryId = await createInventory('Pensil', 2000, 'pcs', ACCOUNT_PERSEDIAAN);

      // Purchase: 100 pcs @ 100,000 (1,000 per unit)
      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 100, 100000);
      await postPurchase(purchaseId, purchaseDate);

      // Stock taking: found 90 pcs (shrinkage of 10 pcs)
      // Expected cost: 100,000, Actual cost = 90 * 1000 = 90,000
      await sql`
        INSERT INTO stock_takings (inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost)
        VALUES (${inventoryId}, ${auditDate.getTime()}, ${100}, ${90}, ${100000}, ${90000})
      `;

      // Verify inventory updated
      const updatedInventory = (await sql`SELECT * FROM inventories WHERE id = ${inventoryId}`).rows[0];
      equal(Number(updatedInventory.stock), 90);
      equal(Number(updatedInventory.cost), 90000);

      // Verify shrinkage account debited
      const shrinkageAccount = (await sql`SELECT balance FROM accounts WHERE account_code = ${ACCOUNT_SELISIH_PERSEDIAAN}`).rows[0];
      equal(Number(shrinkageAccount.balance), 10000, 'Inventory Shrinkage should be debited');
    });
  });

  describe('Fiscal Year Closing with POS', function () {
    it('shall prevent fiscal year closing with negative inventory', async function () {
      await setupCompleteChartOfAccounts();

      const saleDate = new Date(2025, 3, 1, 10, 0, 0, 0);
      const closingDate = new Date(2026, 0, 15, 0, 0, 0, 0);

      // Create fiscal year
      await sql`
        INSERT INTO fiscal_years (begin_time, end_time, name)
        VALUES (${new Date(2025, 0, 1, 0, 0, 0, 0).getTime()}, ${new Date(2025, 11, 31, 0, 0, 0, 0).getTime()}, ${'FY 2025'})
      `;

      // Create inventory with zero stock and make negative via sale
      const inventoryId = await createInventory('Backorder Item', 100000, 'pcs', ACCOUNT_PERSEDIAAN);
      const paymentMethodId = await createPaymentMethod(ACCOUNT_KAS, 'Tunai5');

      // Create sale causing negative stock
      const saleId = await createSale(saleDate);
      await addSaleLine(saleId, 1, inventoryId, 2, 200000);
      await addSalePayment(saleId, 1, paymentMethodId, 200000);
      await postSale(saleId, saleDate);

      // Verify negative stock
      const updatedInventory = (await sql`SELECT * FROM inventories WHERE id = ${inventoryId}`).rows[0];
      equal(Number(updatedInventory.stock), -2, 'Stock should be negative');

      // Try to close fiscal year
      const fiscalYear = (await sql`SELECT * FROM fiscal_years WHERE name = ${'FY 2025'}`).rows[0];

      try {
        await sql`UPDATE fiscal_years SET post_time = ${closingDate.getTime()} WHERE begin_time = ${fiscalYear.begin_time}`;
        ok(false, 'Should have thrown error');
      } catch (error) {
        ok(error.message.includes('Cannot close fiscal year') && error.message.includes('negative stock'), `Error message should mention negative stock, got: ${error.message}`);
      }
    });
  });

  describe('Manual Journal Entry Prevention', function () {
    it('shall prevent manual journal entry to POS inventory account', async function () {
      await setupCompleteChartOfAccounts();

      // Create inventory
      await createInventory('Protected Item', 10000, 'pcs', ACCOUNT_PERSEDIAAN);

      // Try to create manual journal entry to inventory account
      const entryTime = new Date(2025, 6, 1, 10, 0, 0, 0);

      const result = await sql`
        INSERT INTO journal_entries (entry_time, source_type) VALUES (${entryTime.getTime()}, ${'Manual'})
        RETURNING ref
      `;
      const journalEntryRef = Number(result.rows[0].ref);

      try {
        await sql`
          INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit)
          VALUES (${journalEntryRef}, ${1}, ${ACCOUNT_PERSEDIAAN}, ${10000}, ${0})
        `;
        ok(false, 'Should have thrown error');
      } catch (error) {
        ok(error.message.includes('Manual journal entries are not allowed for accounts tagged as "POS - Inventory"'));
      }
    });
  });

  describe('Sale Discount Validation', function () {
    it('shall reject discount for wrong inventory', async function () {
      await setupCompleteChartOfAccounts();

      const purchaseDate = new Date(2025, 7, 1, 8, 0, 0, 0);
      const saleDate = new Date(2025, 7, 5, 10, 0, 0, 0);

      // Setup
      const supplierId = await createSupplier('Supplier H');
      const inventoryAId = await createInventory('Item A', 10000, 'pcs', ACCOUNT_PERSEDIAAN);
      const inventoryBId = await createInventory('Item B', 15000, 'pcs', ACCOUNT_PERSEDIAAN);

      // Purchase
      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryAId, 50, 250000);
      await addPurchaseLine(purchaseId, 2, inventoryBId, 50, 375000);
      await postPurchase(purchaseId, purchaseDate);

      // Create discount for Item A only
      const discountAId = await createDiscount('Discount A', inventoryAId, 1, 1000);

      // Create sale with Item B
      const saleId = await createSale(saleDate);
      await addSaleLine(saleId, 1, inventoryBId, 5, 75000);

      // Try to apply discount A to sale line with Item B
      try {
        await sql`
          INSERT INTO sale_discounts (sale_id, line_number, discount_id, amount)
          VALUES (${saleId}, ${1}, ${discountAId}, ${5000})
        `;
        ok(false, 'Should have thrown error');
      } catch (error) {
        ok(error.message.includes('Discount is not applicable to this inventory'));
      }
    });
  });
});