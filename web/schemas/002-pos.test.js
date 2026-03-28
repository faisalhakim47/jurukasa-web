import { ok, equal, rejects } from 'node:assert/strict';
import { describe, it } from 'node:test';

import { useSql } from '#test/nodejs/hooks/use-sql.js';

describe('POS Schema Tests', function () {
  const sql = useSql();
  const testTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();

  let nextJeRef = 1000;
  function genJeRef() { return nextJeRef++; }

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
   * @param {number} collectTime
   */
  async function createDocument(collectTime) {
    await sql`INSERT INTO documents (collect_time) VALUES (${collectTime})`;
    return collectTime;
  }

  /**
   * @param {number} supplierId
   * @param {Date} purchaseDate
   * @param {number|null} [collectionCollectTime]
   */
  async function createPurchase(supplierId, purchaseDate, collectionCollectTime) {
    const result = await sql`
      INSERT INTO purchases (supplier_id, purchase_time, collection_collect_time)
      VALUES (${supplierId}, ${purchaseDate.getTime()}, ${collectionCollectTime ?? null})
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
   * @param {string} [supplierInventoryName]
   * @param {string} [supplierUnitOfMeasurement]
   */
  async function addPurchaseLine(purchaseId, lineNumber, inventoryId, quantity, price, supplierInventoryName, supplierUnitOfMeasurement) {
    await sql`
      INSERT INTO purchase_lines (
        purchase_id,
        line_number,
        inventory_id,
        supplier_inventory_name,
        supplier_quantity,
        supplier_unit_of_measurement,
        quantity,
        price
      )
      VALUES (
        ${purchaseId},
        ${lineNumber},
        ${inventoryId},
        ${supplierInventoryName ?? 'Supplier Item ' + inventoryId},
        ${quantity},
        ${supplierUnitOfMeasurement ?? 'pcs'},
        ${quantity},
        ${price}
      )
    `;
  }

  /**
   * @param {number} purchaseId
   * @param {Date} postDate
   */
  async function postPurchase(purchaseId, postDate) {
    await sql`UPDATE purchases SET journal_entry_ref = ${genJeRef()}, post_time = ${postDate.getTime()} WHERE id = ${purchaseId}`;
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
    await sql`UPDATE sales SET journal_entry_ref = ${genJeRef()}, post_time = ${postDate.getTime()} WHERE id = ${saleId}`;
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

      await rejects(sql`
        INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
        VALUES (${'Invalid Inventory'}, ${10000}, ${'pcs'}, ${ACCOUNT_KAS})
      `, /Inventory account code must be tagged as "POS - Inventory"/);
    });

    it('shall create inventory barcodes', async function () {
      await setupCompleteChartOfAccounts();

      const inventoryId = await createInventory('Susu Kotak', 8000, 'pcs', ACCOUNT_PERSEDIAAN);

      await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES (${'8991234567890'}, ${inventoryId})`;

      const barcode = (await sql`SELECT * FROM inventory_barcodes WHERE code = ${'8991234567890'}`).rows[0];
      equal(barcode.code, '8991234567890');
      equal(Number(barcode.inventory_id), inventoryId);
    });

    it('shall prevent manual updates to system-managed inventory valuation fields', async function () {
      await setupCompleteChartOfAccounts();

      const supplierId = await createSupplier('Supplier Guard');
      const inventoryId = await createInventory('Guarded Inventory', 12000, 'pcs', ACCOUNT_PERSEDIAAN);
      const purchaseDate = new Date(2025, 0, 20, 10, 0, 0, 0);

      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 10, 50000, 'Guarded Inventory Box', 'box');
      await postPurchase(purchaseId, purchaseDate);

      await rejects(
        sql`UPDATE inventories SET stock = ${20} WHERE id = ${inventoryId}`,
        'Cannot manually update inventories.account_code, cost, stock, or latest_stock_taking_time',
      );

      const inventory = (await sql`SELECT cost, stock FROM inventories WHERE id = ${inventoryId}`).rows[0];
      equal(Number(inventory.cost), 50000);
      equal(Number(inventory.stock), 10);
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

    it('shall create supplier inventory as supplier-specific label', async function () {
      await setupCompleteChartOfAccounts();

      const supplierId = await createSupplier('PT Suplai Grosir', '081111222333');
      const inventoryId = await createInventory('Mie Instan', 3000, 'pcs', ACCOUNT_PERSEDIAAN);
      const recordTime = testTime + 1;

      await sql`
        INSERT INTO supplier_inventories (record_time, supplier_id, inventory_id, name)
        VALUES (${recordTime}, ${supplierId}, ${inventoryId}, ${'Mie Instan Box'})
      `;

      const result = await sql`
        SELECT * FROM supplier_inventories WHERE record_time = ${recordTime}
      `;
      equal(result.rows.length, 1);
      equal(Number(result.rows[0].supplier_id), supplierId);
      equal(Number(result.rows[0].inventory_id), inventoryId);
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

      await rejects(
        sql`
          INSERT INTO payment_methods (account_code, name)
          VALUES (${ACCOUNT_PERSEDIAAN}, ${'Invalid Payment'})
        `,
        'Payment method account code must be tagged as "POS - Payment Method"',
      );
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
    it('shall reject purchase line with negative quantity', async function () {
      await setupCompleteChartOfAccounts();

      const supplierId = await createSupplier('Supplier Negative Quantity');
      const inventoryId = await createInventory('Negative Purchase Guard', 10000, 'pcs', ACCOUNT_PERSEDIAAN);
      const purchaseId = await createPurchase(supplierId, new Date(2025, 0, 10, 10, 0, 0, 0));

      await rejects(
        addPurchaseLine(purchaseId, 1, inventoryId, -5, 50000),
        /CHECK constraint failed/
      );
    });

    it('shall reject purchase line with negative price', async function () {
      await setupCompleteChartOfAccounts();

      const supplierId = await createSupplier('Supplier Negative Price');
      const inventoryId = await createInventory('Negative Price Guard', 10000, 'pcs', ACCOUNT_PERSEDIAAN);
      const purchaseId = await createPurchase(supplierId, new Date(2025, 0, 10, 10, 0, 0, 0));

      await rejects(
        addPurchaseLine(purchaseId, 1, inventoryId, 5, -50000),
        /CHECK constraint failed/
      );
    });

    it('shall create purchase linked to collected supplier document', async function () {
      await setupCompleteChartOfAccounts();

      const supplierId = await createSupplier('Supplier Receipt');
      const collectTime = await createDocument(testTime + 2);
      const purchaseDate = new Date(2025, 0, 12, 9, 0, 0, 0);

      const purchaseId = await createPurchase(supplierId, purchaseDate, collectTime);

      const result = await sql`SELECT * FROM purchases WHERE id = ${purchaseId}`;
      equal(result.rows.length, 1);
      equal(Number(result.rows[0].collection_collect_time), collectTime);
    });

    it('shall create and post purchase with journal entry', async function () {
      await setupCompleteChartOfAccounts();

      const purchaseDate = new Date(2025, 0, 15, 10, 0, 0, 0);
      const postDate = new Date(2025, 0, 15, 10, 30, 0, 0);

      // Create supplier and inventory
      const supplierId = await createSupplier('Supplier A');
      const inventoryId = await createInventory('Kopi Sachet', 2000, 'pcs', ACCOUNT_PERSEDIAAN);

      // Create and post purchase: 100 sachets @ 150,000 IDR
      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 100, 150000, 'Kopi Sachet Dus', 'dus');
      await postPurchase(purchaseId, postDate);

      // Verify inventory updated
      const updatedInventory = (await sql`SELECT * FROM inventories WHERE id = ${inventoryId}`).rows[0];
      equal(Number(updatedInventory.stock), 100);
      equal(Number(updatedInventory.cost), 150000);

      // Verify journal entry created
      const journalEntry = (await sql`
        SELECT * FROM journal_entries WHERE purchase_id = ${purchaseId}
      `).rows[0];
      ok(journalEntry, 'Journal entry should be created');
      ok(journalEntry.post_time, 'Journal entry should be posted');

      // Verify account balances
      const inventoryAccount = (await sql`SELECT balance FROM accounts WHERE account_code = ${ACCOUNT_PERSEDIAAN}`).rows[0];
      const apAccount = (await sql`SELECT balance FROM accounts WHERE account_code = ${ACCOUNT_UTANG_USAHA}`).rows[0];

      equal(Number(inventoryAccount.balance), 150000, 'Inventory account should be debited');
      equal(Number(apAccount.balance), 150000, 'AP account should be credited');
    });

    it('shall reject posting purchase without journal_entry_ref', async function () {
      await setupCompleteChartOfAccounts();

      const supplierId = await createSupplier('Supplier Missing Purchase Ref');
      const inventoryId = await createInventory('Missing Purchase Ref Item', 5000, 'pcs', ACCOUNT_PERSEDIAAN);
      const purchaseDate = new Date(2025, 0, 16, 10, 0, 0, 0);

      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 10, 40000, 'Missing Purchase Ref Item Box', 'box');

      await rejects(
        sql`UPDATE purchases SET post_time = ${purchaseDate.getTime()} WHERE id = ${purchaseId}`,
        /Cannot post purchase without journal_entry_ref/
      );
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
      await addPurchaseLine(purchase1Id, 1, inventoryId, 10, 120000, 'Gula Pasir Karung', 'karung');
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
      await addPurchaseLine(purchase2Id, 1, inventoryId, 20, 250000, 'Gula Pasir Karung', 'karung');
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

    it('shall reject catch-up purchase when POS COGS tag is missing', async function () {
      await setupCompleteChartOfAccounts();

      const firstPurchaseDate = new Date(2025, 1, 1, 10, 0, 0, 0);
      const saleDate = new Date(2025, 1, 2, 14, 0, 0, 0);
      const catchupPurchaseDate = new Date(2025, 1, 3, 10, 0, 0, 0);

      const supplierId = await createSupplier('Supplier Missing Catch-up COGS Tag');
      const inventoryId = await createInventory('Catch-up Guard Item', 15000, 'kg', ACCOUNT_PERSEDIAAN);

      const purchase1Id = await createPurchase(supplierId, firstPurchaseDate);
      await addPurchaseLine(purchase1Id, 1, inventoryId, 10, 120000, 'Catch-up Guard Item Sack', 'sack');
      await postPurchase(purchase1Id, firstPurchaseDate);

      const paymentMethodId = await createPaymentMethod(ACCOUNT_KAS, 'Tunai');
      const saleId = await createSale(saleDate);
      await addSaleLine(saleId, 1, inventoryId, 15, 225000);
      await addSalePayment(saleId, 1, paymentMethodId, 225000);
      await postSale(saleId, saleDate);

      await sql`DELETE FROM account_tags WHERE tag = 'POS - Cost of Goods Sold'`;

      const purchase2Id = await createPurchase(supplierId, catchupPurchaseDate);
      await addPurchaseLine(purchase2Id, 1, inventoryId, 20, 250000, 'Catch-up Guard Item Sack', 'sack');

      await rejects(
        sql`UPDATE purchases SET journal_entry_ref = ${genJeRef()}, post_time = ${catchupPurchaseDate.getTime()} WHERE id = ${purchase2Id}`,
        /Account with tag "POS - Cost of Goods Sold" not found for purchase posting/
      );
    });

    it('shall prevent mutating posted purchase header and lines', async function () {
      await setupCompleteChartOfAccounts();

      const purchaseDate = new Date(2025, 1, 10, 10, 0, 0, 0);
      const postDate = new Date(2025, 1, 10, 11, 0, 0, 0);
      const supplierId = await createSupplier('Supplier Posted Purchase');
      const inventoryId = await createInventory('Immutable Purchase Item', 5000, 'pcs', ACCOUNT_PERSEDIAAN);

      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 10, 30000, 'Immutable Purchase Item', 'box');
      await postPurchase(purchaseId, postDate);

      await rejects(
        sql`UPDATE purchases SET journal_entry_ref = NULL WHERE id = ${purchaseId}`,
        'Cannot unpost or change post_time of a posted purchase',
      );

      await rejects(
        sql`UPDATE purchases SET purchase_time = ${purchaseDate.getTime() + 86400000} WHERE id = ${purchaseId}`,
        'Cannot modify purchase_time or journal_entry_ref of a posted purchase',
      );

      await rejects(
        addPurchaseLine(purchaseId, 2, inventoryId, 5, 15000, 'Late Purchase Line', 'box'),
        'Cannot add lines to posted purchase',
      );

      await rejects(
        sql`UPDATE purchase_lines SET price = ${35000} WHERE purchase_id = ${purchaseId} AND line_number = ${1}`,
        'Cannot modify lines of posted purchase',
      );

      await rejects(
        sql`DELETE FROM purchase_lines WHERE purchase_id = ${purchaseId} AND line_number = ${1}`,
        'Cannot delete lines of posted purchase',
      );
    });
  });

  describe('Sales', function () {
    it('shall reject sale line with negative quantity', async function () {
      await setupCompleteChartOfAccounts();

      const inventoryId = await createInventory('Negative Sale Guard', 10000, 'pcs', ACCOUNT_PERSEDIAAN);
      const saleId = await createSale(new Date(2025, 0, 15, 12, 0, 0, 0));

      await rejects(
        addSaleLine(saleId, 1, inventoryId, -2, 20000),
        /CHECK constraint failed/
      );
    });

    it('shall reject sale line with negative price', async function () {
      await setupCompleteChartOfAccounts();

      const inventoryId = await createInventory('Negative Price Sale Guard', 10000, 'pcs', ACCOUNT_PERSEDIAAN);
      const saleId = await createSale(new Date(2025, 0, 15, 12, 0, 0, 0));

      await rejects(
        addSaleLine(saleId, 1, inventoryId, 2, -20000),
        /CHECK constraint failed/
      );
    });

    it('shall create and post sale with journal entry', async function () {
      await setupCompleteChartOfAccounts();

      const purchaseDate = new Date(2025, 0, 10, 8, 0, 0, 0);
      const saleDate = new Date(2025, 0, 15, 14, 0, 0, 0);

      // Setup supplier and inventory
      const supplierId = await createSupplier('Supplier C');
      const inventoryId = await createInventory('Air Mineral', 4000, 'btl', ACCOUNT_PERSEDIAAN);

      // Purchase first: 50 bottles @ 100,000 IDR (2,000 per bottle cost)
      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 50, 100000, 'Air Mineral Dus', 'dus');
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
      const journalEntry = (await sql`SELECT * FROM journal_entries WHERE sale_id = ${saleId}`).rows[0];
      ok(journalEntry, 'Journal entry should be created');

      // Verify account balances
      const cashAccount = (await sql`SELECT balance FROM accounts WHERE account_code = ${ACCOUNT_KAS}`).rows[0];
      const revenueAccount = (await sql`SELECT balance FROM accounts WHERE account_code = ${ACCOUNT_PENJUALAN}`).rows[0];
      const cogsAccount = (await sql`SELECT balance FROM accounts WHERE account_code = ${ACCOUNT_HPP}`).rows[0];

      equal(Number(cashAccount.balance), 40000, 'Cash should be debited');
      equal(Number(revenueAccount.balance), 40000, 'Revenue should be credited');
      equal(Number(cogsAccount.balance), 20000, 'COGS should be debited');
    });

    it('shall prevent modifying draft sale lines, including manual cost overrides', async function () {
      await setupCompleteChartOfAccounts();

      const purchaseDate = new Date(2025, 0, 12, 8, 0, 0, 0);
      const saleDate = new Date(2025, 0, 15, 14, 0, 0, 0);

      const supplierId = await createSupplier('Supplier Draft Sale Guard');
      const inventoryId = await createInventory('Draft Sale Guard Item', 4000, 'pcs', ACCOUNT_PERSEDIAAN);

      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 20, 40000, 'Draft Sale Guard Item Box', 'box');
      await postPurchase(purchaseId, purchaseDate);

      const saleId = await createSale(saleDate);
      await addSaleLine(saleId, 1, inventoryId, 5, 20000);

      await rejects(
        sql`UPDATE sale_lines SET cost = ${1} WHERE sale_id = ${saleId} AND line_number = ${1}`,
        /Sale lines can only be added or removed, not updated/
      );

      await rejects(
        sql`UPDATE sale_lines SET price = ${25000} WHERE sale_id = ${saleId} AND line_number = ${1}`,
        /Sale lines can only be added or removed, not updated/
      );

      const saleLine = (await sql`SELECT quantity, price, cost FROM sale_lines WHERE sale_id = ${saleId} AND line_number = ${1}`).rows[0];
      equal(Number(saleLine.quantity), 5);
      equal(Number(saleLine.price), 20000);
      equal(Number(saleLine.cost), 10000, 'Auto-calculated cost should remain unchanged');
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
      await addPurchaseLine(purchaseId, 1, inventoryId, 100, 500000, 'Snack Karton', 'karton');
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

    it('shall reject negative discount amounts', async function () {
      await setupCompleteChartOfAccounts();

      const supplierId = await createSupplier('Supplier Negative Discount');
      const inventoryId = await createInventory('Discount Guard Item', 10000, 'pcs', ACCOUNT_PERSEDIAAN);
      const discountId = await createDiscount('Simple Discount', inventoryId, 1, 500);
      const purchaseId = await createPurchase(supplierId, new Date(2025, 1, 1, 8, 0, 0, 0));
      await addPurchaseLine(purchaseId, 1, inventoryId, 10, 50000, 'Discount Guard Item', 'box');
      await postPurchase(purchaseId, new Date(2025, 1, 1, 8, 0, 0, 0));

      const saleId = await createSale(new Date(2025, 1, 5, 15, 0, 0, 0));
      await addSaleLine(saleId, 1, inventoryId, 2, 20000);

      await rejects(
        sql`
          INSERT INTO sale_discounts (sale_id, line_number, discount_id, amount)
          VALUES (${saleId}, ${1}, ${discountId}, ${-1000})
        `,
        /CHECK constraint failed/
      );
    });

    it('shall reject negative payment fees', async function () {
      await setupCompleteChartOfAccounts();

      const supplierId = await createSupplier('Supplier Negative Fee');
      const inventoryId = await createInventory('Fee Guard Item', 10000, 'pcs', ACCOUNT_PERSEDIAAN);
      const paymentMethodId = await createPaymentMethod(ACCOUNT_KAS, 'Cash Negative Fee');
      const purchaseDate = new Date(2025, 1, 1, 8, 0, 0, 0);
      const saleDate = new Date(2025, 1, 5, 15, 0, 0, 0);

      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 10, 50000, 'Fee Guard Item', 'box');
      await postPurchase(purchaseId, purchaseDate);

      const saleId = await createSale(saleDate);
      await addSaleLine(saleId, 1, inventoryId, 1, 10000);

      await rejects(
        sql`
          INSERT INTO sale_payments (sale_id, line_number, payment_method_id, amount, payment_fee)
          VALUES (${saleId}, ${1}, ${paymentMethodId}, ${10000}, ${-500})
        `,
        /CHECK constraint failed/
      );
    });

    it('shall reject payment fees greater than the payment amount', async function () {
      await setupCompleteChartOfAccounts();

      const supplierId = await createSupplier('Supplier Excessive Fee');
      const inventoryId = await createInventory('Excessive Fee Item', 10000, 'pcs', ACCOUNT_PERSEDIAAN);
      const paymentMethodId = await createPaymentMethod(ACCOUNT_KAS, 'Cash Excessive Fee');
      const purchaseDate = new Date(2025, 1, 1, 8, 0, 0, 0);
      const saleDate = new Date(2025, 1, 5, 15, 0, 0, 0);

      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 10, 50000, 'Excessive Fee Item', 'box');
      await postPurchase(purchaseId, purchaseDate);

      const saleId = await createSale(saleDate);
      await addSaleLine(saleId, 1, inventoryId, 1, 10000);

      await rejects(
        sql`
          INSERT INTO sale_payments (sale_id, line_number, payment_method_id, amount, payment_fee)
          VALUES (${saleId}, ${1}, ${paymentMethodId}, ${10000}, ${12000})
        `,
        /CHECK constraint failed/
      );
    });

    it('shall reject posting sale when payment total does not equal invoice amount', async function () {
      await setupCompleteChartOfAccounts();

      const supplierId = await createSupplier('Supplier Payment Mismatch');
      const inventoryId = await createInventory('Payment Mismatch Item', 10000, 'pcs', ACCOUNT_PERSEDIAAN);
      const paymentMethodId = await createPaymentMethod(ACCOUNT_KAS, 'Cash Payment Mismatch');
      const purchaseDate = new Date(2025, 1, 1, 8, 0, 0, 0);
      const saleDate = new Date(2025, 1, 5, 15, 0, 0, 0);

      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 10, 50000, 'Payment Mismatch Item', 'box');
      await postPurchase(purchaseId, purchaseDate);

      const saleId = await createSale(saleDate);
      await addSaleLine(saleId, 1, inventoryId, 1, 10000);
      await addSalePayment(saleId, 1, paymentMethodId, 9000);

      await rejects(
        postSale(saleId, saleDate),
        /Cannot post sale: payment total must equal invoice amount/
      );
    });

    it('shall reject posting sale when discount amount exceeds gross amount', async function () {
      await setupCompleteChartOfAccounts();

      const supplierId = await createSupplier('Supplier Discount Exceeds Gross');
      const inventoryId = await createInventory('Discount Exceeds Gross Item', 10000, 'pcs', ACCOUNT_PERSEDIAAN);
      const discountId = await createDiscount('Large Discount', inventoryId, 1, 20000);
      const paymentMethodId = await createPaymentMethod(ACCOUNT_KAS, 'Cash Discount Exceeds Gross');
      const purchaseDate = new Date(2025, 1, 1, 8, 0, 0, 0);
      const saleDate = new Date(2025, 1, 5, 15, 0, 0, 0);

      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 10, 50000, 'Discount Exceeds Gross Item', 'box');
      await postPurchase(purchaseId, purchaseDate);

      const saleId = await createSale(saleDate);
      await addSaleLine(saleId, 1, inventoryId, 1, 10000);
      await sql`
        INSERT INTO sale_discounts (sale_id, line_number, discount_id, amount)
        VALUES (${saleId}, ${1}, ${discountId}, ${15000})
      `;
      await addSalePayment(saleId, 1, paymentMethodId, 0);

      await rejects(
        postSale(saleId, saleDate),
        /Cannot post sale: discount amount exceeds gross amount/
      );
    });

    it('shall reject posting sale with explicit error when sales revenue tag is missing', async function () {
      await setupCompleteChartOfAccounts();

      const supplierId = await createSupplier('Supplier Missing Revenue Tag');
      const inventoryId = await createInventory('Missing Revenue Tag Item', 10000, 'pcs', ACCOUNT_PERSEDIAAN);
      const paymentMethodId = await createPaymentMethod(ACCOUNT_KAS, 'Cash Missing Revenue Tag');
      const purchaseDate = new Date(2025, 1, 1, 8, 0, 0, 0);
      const saleDate = new Date(2025, 1, 5, 15, 0, 0, 0);

      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 10, 50000, 'Missing Revenue Tag Item', 'box');
      await postPurchase(purchaseId, purchaseDate);

      await sql`DELETE FROM account_tags WHERE tag = ${'POS - Sales Revenue'}`;

      const saleId = await createSale(saleDate);
      await addSaleLine(saleId, 1, inventoryId, 1, 10000);
      await addSalePayment(saleId, 1, paymentMethodId, 10000);

      await rejects(
        postSale(saleId, saleDate),
        /Account with tag "POS - Sales Revenue" not found for sale posting/
      );
    });

    it('shall prevent deleting sale line for posted sale', async function () {
      await setupCompleteChartOfAccounts();

      const purchaseDate = new Date(2025, 2, 1, 8, 0, 0, 0);
      const saleDate = new Date(2025, 2, 5, 10, 0, 0, 0);

      // Setup
      const supplierId = await createSupplier('Supplier E');
      const inventoryId = await createInventory('Permen', 500, 'pcs', ACCOUNT_PERSEDIAAN);

      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 200, 40000, 'Permen Toples', 'toples');
      await postPurchase(purchaseId, purchaseDate);

      const paymentMethodId = await createPaymentMethod(ACCOUNT_KAS, 'Tunai3');
      const saleId = await createSale(saleDate);
      await addSaleLine(saleId, 1, inventoryId, 10, 5000);
      await addSalePayment(saleId, 1, paymentMethodId, 5000);
      await postSale(saleId, saleDate);

      // Try to delete sale line
      await rejects(
        sql`DELETE FROM sale_lines WHERE sale_id = ${saleId} AND line_number = ${1}`,
        'Cannot delete sale line for posted sale',
      );
    });

    it('shall prevent duplicate inventory lines in same sale', async function () {
      await setupCompleteChartOfAccounts();

      const purchaseDate = new Date(2025, 2, 10, 8, 0, 0, 0);
      const saleDate = new Date(2025, 2, 15, 14, 0, 0, 0);

      // Setup
      const supplierId = await createSupplier('Supplier Dup');
      const inventoryId = await createInventory('Widget', 5000, 'pcs', ACCOUNT_PERSEDIAAN);

      // Purchase: 100 pcs @ 200,000 IDR
      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 100, 200000, 'Widget Box', 'box');
      await postPurchase(purchaseId, purchaseDate);

      const paymentMethodId = await createPaymentMethod(ACCOUNT_KAS, 'Tunai-Dup');
      const saleId = await createSale(saleDate);
      await addSaleLine(saleId, 1, inventoryId, 5, 25000);

      // Adding a second line for the same inventory should fail
      await rejects(
        addSaleLine(saleId, 2, inventoryId, 3, 15000),
        'UNIQUE constraint failed',
      );
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

    it('shall prevent mutating posted sale header and detail rows', async function () {
      await setupCompleteChartOfAccounts();

      const purchaseDate = new Date(2025, 3, 5, 8, 0, 0, 0);
      const saleDate = new Date(2025, 3, 8, 10, 0, 0, 0);
      const supplierId = await createSupplier('Supplier Posted Sale');
      const inventoryId = await createInventory('Immutable Sale Item', 10000, 'pcs', ACCOUNT_PERSEDIAAN);
      const discountId = await createDiscount('Immutable Sale Discount', inventoryId, 1, 500);
      const paymentMethodId = await createPaymentMethod(ACCOUNT_KAS, 'Immutable Cash');

      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 20, 80000, 'Immutable Sale Item', 'box');
      await postPurchase(purchaseId, purchaseDate);

      const saleId = await createSale(saleDate);
      await addSaleLine(saleId, 1, inventoryId, 2, 20000);
      await sql`
        INSERT INTO sale_discounts (sale_id, line_number, discount_id, amount)
        VALUES (${saleId}, ${1}, ${discountId}, ${500})
      `;
      await addSalePayment(saleId, 1, paymentMethodId, 19500);
      await postSale(saleId, saleDate);

      await rejects(
        sql`UPDATE sales SET journal_entry_ref = NULL WHERE id = ${saleId}`,
        'Cannot unpost or change post_time of a posted sale',
      );

      await rejects(
        sql`UPDATE sales SET sale_time = ${saleDate.getTime() + 86400000} WHERE id = ${saleId}`,
        'Cannot modify sale_time or journal_entry_ref of a posted sale',
      );

      await rejects(
        addSaleLine(saleId, 2, inventoryId, 1, 10000),
        'Cannot add sale line for posted sale',
      );

      await rejects(
        sql`
          INSERT INTO sale_discounts (sale_id, line_number, discount_id, amount)
          VALUES (${saleId}, ${2}, ${discountId}, ${500})
        `,
        'Cannot add discount to posted sale',
      );

      await rejects(
        sql`UPDATE sale_payments SET amount = ${19000} WHERE sale_id = ${saleId} AND line_number = ${1}`,
        'Cannot modify payment of posted sale',
      );

      await rejects(
        sql`DELETE FROM sale_discounts WHERE sale_id = ${saleId} AND line_number = ${1}`,
        'Cannot delete discount of posted sale',
      );
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
      await addPurchaseLine(purchaseId, 1, inventoryId, 50, 150000, 'Buku Tulis Pack', 'pack');
      await postPurchase(purchaseId, purchaseDate);

      // Stock taking: found 55 pcs (gain of 5 pcs)
      // Expected cost: 150,000, Actual cost = 55 * 3000 = 165,000
      await sql`
        INSERT INTO stock_takings (inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost, journal_entry_ref)
        VALUES (${inventoryId}, ${auditDate.getTime()}, ${50}, ${55}, ${150000}, ${165000}, ${genJeRef()})
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
      await addPurchaseLine(purchaseId, 1, inventoryId, 100, 100000, 'Pensil Box', 'box');
      await postPurchase(purchaseId, purchaseDate);

      // Stock taking: found 90 pcs (shrinkage of 10 pcs)
      // Expected cost: 100,000, Actual cost = 90 * 1000 = 90,000
      await sql`
        INSERT INTO stock_takings (inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost, journal_entry_ref)
        VALUES (${inventoryId}, ${auditDate.getTime()}, ${100}, ${90}, ${100000}, ${90000}, ${genJeRef()})
      `;

      // Verify inventory updated
      const updatedInventory = (await sql`SELECT * FROM inventories WHERE id = ${inventoryId}`).rows[0];
      equal(Number(updatedInventory.stock), 90);
      equal(Number(updatedInventory.cost), 90000);

      // Verify shrinkage account debited
      const shrinkageAccount = (await sql`SELECT balance FROM accounts WHERE account_code = ${ACCOUNT_SELISIH_PERSEDIAAN}`).rows[0];
      equal(Number(shrinkageAccount.balance), 10000, 'Inventory Shrinkage should be debited');
    });

    it('shall reject stock taking when expected snapshot does not match current inventory state', async function () {
      await setupCompleteChartOfAccounts();

      const purchaseDate = new Date(2025, 5, 20, 8, 0, 0, 0);
      const auditDate = new Date(2025, 5, 21, 9, 0, 0, 0);
      const supplierId = await createSupplier('Supplier Snapshot Guard');
      const inventoryId = await createInventory('Snapshot Guard Item', 2000, 'pcs', ACCOUNT_PERSEDIAAN);

      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 10, 50000, 'Snapshot Guard Item', 'box');
      await postPurchase(purchaseId, purchaseDate);

      await rejects(
        sql`
          INSERT INTO stock_takings (inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost, journal_entry_ref)
          VALUES (${inventoryId}, ${auditDate.getTime()}, ${10}, ${10}, ${999999}, ${999999}, ${genJeRef()})
        `,
        /Stock taking expected_cost must match current inventory cost/
      );

      const inventory = (await sql`SELECT stock, cost FROM inventories WHERE id = ${inventoryId}`).rows[0];
      const inventoryAccount = (await sql`SELECT balance FROM accounts WHERE account_code = ${ACCOUNT_PERSEDIAAN}`).rows[0];
      equal(Number(inventory.stock), 10);
      equal(Number(inventory.cost), 50000);
      equal(Number(inventoryAccount.balance), 50000);
    });

    it('shall reject stock taking inside a closed fiscal year even when no cost adjustment is needed', async function () {
      await setupCompleteChartOfAccounts();

      const purchaseDate = new Date(2025, 0, 10, 8, 0, 0, 0);
      const closingDate = new Date(2026, 0, 15, 0, 0, 0, 0);
      const auditDate = new Date(2025, 6, 1, 9, 0, 0, 0);
      const supplierId = await createSupplier('Supplier Closed Period Guard');
      const inventoryId = await createInventory('Closed Period Guard Item', 3000, 'pcs', ACCOUNT_PERSEDIAAN);

      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 10, 50000, 'Closed Period Guard Item', 'box');
      await postPurchase(purchaseId, purchaseDate);

      await sql`
        INSERT INTO fiscal_years (begin_time, end_time, name)
        VALUES (${new Date(2025, 0, 1, 0, 0, 0, 0).getTime()}, ${new Date(2025, 11, 31, 0, 0, 0, 0).getTime()}, ${'FY 2025'})
      `;

      await sql`
        UPDATE fiscal_years
        SET closing_journal_entry_ref = ${genJeRef()}, depreciation_journal_entry_ref = ${genJeRef()}, post_time = ${closingDate.getTime()}
        WHERE name = ${'FY 2025'}
      `;

      await rejects(
        sql`
          INSERT INTO stock_takings (inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost, journal_entry_ref)
          VALUES (${inventoryId}, ${auditDate.getTime()}, ${10}, ${8}, ${50000}, ${50000}, ${genJeRef()})
        `,
        /Cannot record stock taking in a closed fiscal year/
      );

      const inventory = (await sql`SELECT stock, cost, latest_stock_taking_time FROM inventories WHERE id = ${inventoryId}`).rows[0];
      equal(Number(inventory.stock), 10);
      equal(Number(inventory.cost), 50000);
      equal(inventory.latest_stock_taking_time, null);
    });

    it('shall prevent modifying stock taking after it is recorded', async function () {
      await setupCompleteChartOfAccounts();

      const purchaseDate = new Date(2025, 6, 1, 8, 0, 0, 0);
      const auditDate = new Date(2025, 6, 2, 9, 0, 0, 0);
      const supplierId = await createSupplier('Supplier Immutable Stock Taking');
      const inventoryId = await createInventory('Immutable Stock Item', 2000, 'pcs', ACCOUNT_PERSEDIAAN);

      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 10, 50000, 'Immutable Stock Item', 'box');
      await postPurchase(purchaseId, purchaseDate);

      await sql`
        INSERT INTO stock_takings (inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost, journal_entry_ref)
        VALUES (${inventoryId}, ${auditDate.getTime()}, ${10}, ${8}, ${50000}, ${40000}, ${genJeRef()})
      `;

      await rejects(
        sql`UPDATE stock_takings SET actual_stock = ${9}, actual_cost = ${45000} WHERE inventory_id = ${inventoryId}`,
        /Stock takings are immutable once recorded/
      );

      const stockTaking = (await sql`
        SELECT actual_stock, actual_cost FROM stock_takings WHERE inventory_id = ${inventoryId}
      `).rows[0];
      equal(Number(stockTaking.actual_stock), 8);
      equal(Number(stockTaking.actual_cost), 40000);

      const inventory = (await sql`SELECT stock, cost FROM inventories WHERE id = ${inventoryId}`).rows[0];
      equal(Number(inventory.stock), 8);
      equal(Number(inventory.cost), 40000);
    });

    it('shall prevent deleting stock taking after it is recorded', async function () {
      await setupCompleteChartOfAccounts();

      const purchaseDate = new Date(2025, 6, 3, 8, 0, 0, 0);
      const auditDate = new Date(2025, 6, 4, 9, 0, 0, 0);
      const supplierId = await createSupplier('Supplier No Delete Stock Taking');
      const inventoryId = await createInventory('No Delete Stock Item', 3000, 'pcs', ACCOUNT_PERSEDIAAN);

      const purchaseId = await createPurchase(supplierId, purchaseDate);
      await addPurchaseLine(purchaseId, 1, inventoryId, 10, 50000, 'No Delete Stock Item', 'box');
      await postPurchase(purchaseId, purchaseDate);

      await sql`
        INSERT INTO stock_takings (inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost)
        VALUES (${inventoryId}, ${auditDate.getTime()}, ${10}, ${10}, ${50000}, ${50000})
      `;

      await rejects(
        sql`DELETE FROM stock_takings WHERE inventory_id = ${inventoryId}`,
        /Stock takings cannot be deleted once recorded/
      );

      const count = (await sql`SELECT COUNT(*) AS count FROM stock_takings WHERE inventory_id = ${inventoryId}`).rows[0];
      equal(Number(count.count), 1);

      const inventory = (await sql`SELECT latest_stock_taking_time FROM inventories WHERE id = ${inventoryId}`).rows[0];
      equal(Number(inventory.latest_stock_taking_time), auditDate.getTime());
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

      await rejects(
        sql`UPDATE fiscal_years SET closing_journal_entry_ref = ${genJeRef()}, depreciation_journal_entry_ref = ${genJeRef()}, post_time = ${closingDate.getTime()} WHERE begin_time = ${fiscalYear.begin_time}`,
        /(?=.*Cannot close fiscal year)(?=.*negative stock)/
      );
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
        INSERT INTO journal_entries (entry_time) VALUES (${entryTime.getTime()})
        RETURNING ref
      `;
      const journalEntryRef = Number(result.rows[0].ref);

      await rejects(
        sql`
          INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit)
          VALUES (${journalEntryRef}, ${1}, ${ACCOUNT_PERSEDIAAN}, ${10000}, ${0})
        `,
        /Manual journal entries are not allowed for accounts tagged as "POS - Inventory"/
      );
    });

    it('shall prevent updating a draft manual journal entry line into a POS inventory account', async function () {
      await setupCompleteChartOfAccounts();

      await createInventory('Protected Item', 10000, 'pcs', ACCOUNT_PERSEDIAAN);

      const entryTime = new Date(2025, 6, 1, 10, 0, 0, 0);
      const result = await sql`
        INSERT INTO journal_entries (entry_time) VALUES (${entryTime.getTime()})
        RETURNING ref
      `;
      const journalEntryRef = Number(result.rows[0].ref);

      await sql`
        INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit)
        VALUES (${journalEntryRef}, ${1}, ${61100}, ${10000}, ${0})
      `;

      await sql`
        INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit)
        VALUES (${journalEntryRef}, ${2}, ${31000}, ${0}, ${10000})
      `;

      await rejects(
        sql`
          UPDATE journal_entry_lines
          SET account_code = ${ACCOUNT_PERSEDIAAN}
          WHERE journal_entry_ref = ${journalEntryRef} AND line_number = ${1}
        `,
        /Manual journal entries are not allowed for accounts tagged as "POS - Inventory"/
      );
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
      await addPurchaseLine(purchaseId, 1, inventoryAId, 50, 250000, 'Item A Box', 'box');
      await addPurchaseLine(purchaseId, 2, inventoryBId, 50, 375000, 'Item B Box', 'box');
      await postPurchase(purchaseId, purchaseDate);

      // Create discount for Item A only
      const discountAId = await createDiscount('Discount A', inventoryAId, 1, 1000);

      // Create sale with Item B
      const saleId = await createSale(saleDate);
      await addSaleLine(saleId, 1, inventoryBId, 5, 75000);

      // Try to apply discount A to sale line with Item B
      await rejects(
        sql`
          INSERT INTO sale_discounts (sale_id, line_number, discount_id, amount)
          VALUES (${saleId}, ${1}, ${discountAId}, ${5000})
        `,
        /Discount is not applicable to this sale/,
      );
    });
  });
});