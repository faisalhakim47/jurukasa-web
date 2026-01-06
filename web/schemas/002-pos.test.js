import { describe, it } from 'node:test';
import { equal, rejects, ok } from 'node:assert/strict';
import { useAccountingDatabase } from '#web/schemas/test/hooks/use-accounting-database.js';

describe('POS Schema Tests', function () {
  const db = useAccountingDatabase();

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

  describe('Inventories', function () {
    it('shall create inventory with valid POS inventory account', async function () {
      const client = db();

      await client.execute(
        `INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
         VALUES (?, ?, ?, ?)`,
        ['Roti Tawar', 15000, 'pcs', ACCOUNT_PERSEDIAAN]
      );

      const result = await client.execute(`SELECT * FROM inventories WHERE name = 'Roti Tawar'`);
      equal(result.rows.length, 1);
      equal(result.rows[0].name, 'Roti Tawar');
      equal(Number(result.rows[0].unit_price), 15000);
      equal(Number(result.rows[0].stock), 0);
      equal(Number(result.rows[0].cost), 0);
      equal(Number(result.rows[0].num_of_sales), 0);
    });

    it('shall reject inventory creation with non-POS inventory account', async function () {
      const client = db();

      await rejects(
        client.execute(
          `INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
           VALUES (?, ?, ?, ?)`,
          ['Invalid Inventory', 10000, 'pcs', ACCOUNT_KAS]
        ),
        /Inventory account code must be tagged as "POS - Inventory"/
      );
    });

    it('shall create inventory barcodes', async function () {
      const client = db();

      await client.execute(
        `INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
         VALUES (?, ?, ?, ?)`,
        ['Susu Kotak', 8000, 'pcs', ACCOUNT_PERSEDIAAN]
      );

      const inventory = (await client.execute(`SELECT id FROM inventories WHERE name = 'Susu Kotak'`)).rows[0];

      await client.execute(
        `INSERT INTO inventory_barcodes (code, inventory_id) VALUES (?, ?)`,
        ['8991234567890', Number(inventory.id)]
      );

      const barcode = (await client.execute(`SELECT * FROM inventory_barcodes WHERE code = '8991234567890'`)).rows[0];
      equal(barcode.code, '8991234567890');
      equal(Number(barcode.inventory_id), Number(inventory.id));
    });
  });

  describe('Suppliers', function () {
    it('shall create supplier', async function () {
      const client = db();

      await client.execute(
        `INSERT INTO suppliers (name, phone_number) VALUES (?, ?)`,
        ['PT Supplier Utama', '081234567890']
      );

      const result = await client.execute(`SELECT * FROM suppliers WHERE name = 'PT Supplier Utama'`);
      equal(result.rows.length, 1);
      equal(result.rows[0].name, 'PT Supplier Utama');
      equal(result.rows[0].phone_number, '081234567890');
    });

    it('shall create supplier inventory with quantity conversion', async function () {
      const client = db();

      await client.execute(
        `INSERT INTO suppliers (name, phone_number) VALUES (?, ?)`,
        ['PT Suplai Grosir', '081111222333']
      );
      const supplier = (await client.execute(`SELECT id FROM suppliers WHERE name = 'PT Suplai Grosir'`)).rows[0];

      await client.execute(
        `INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
         VALUES (?, ?, ?, ?)`,
        ['Mie Instan', 3000, 'pcs', ACCOUNT_PERSEDIAAN]
      );
      const inventory = (await client.execute(`SELECT id FROM inventories WHERE name = 'Mie Instan'`)).rows[0];

      // Supplier sells in boxes of 40 pieces
      await client.execute(
        `INSERT INTO supplier_inventories (supplier_id, inventory_id, quantity_conversion, name)
         VALUES (?, ?, ?, ?)`,
        [Number(supplier.id), Number(inventory.id), 40, 'Mie Instan Box']
      );

      const result = await client.execute(
        `SELECT * FROM supplier_inventories WHERE supplier_id = ? AND inventory_id = ?`,
        [Number(supplier.id), Number(inventory.id)]
      );
      equal(result.rows.length, 1);
      equal(Number(result.rows[0].quantity_conversion), 40);
      equal(result.rows[0].name, 'Mie Instan Box');
    });
  });

  describe('Payment Methods', function () {
    it('shall create payment method with valid POS payment account', async function () {
      const client = db();

      await client.execute(
        `INSERT INTO payment_methods (account_code, name, min_fee, max_fee, rel_fee)
         VALUES (?, ?, ?, ?, ?)`,
        [ACCOUNT_KAS, 'Cash', 0, 0, 0]
      );

      const result = await client.execute(`SELECT * FROM payment_methods WHERE name = 'Cash'`);
      equal(result.rows.length, 1);
      equal(result.rows[0].name, 'Cash');
      equal(Number(result.rows[0].account_code), ACCOUNT_KAS);
    });

    it('shall reject payment method with non-POS payment account', async function () {
      const client = db();

      await rejects(
        client.execute(
          `INSERT INTO payment_methods (account_code, name)
           VALUES (?, ?)`,
          [ACCOUNT_PERSEDIAAN, 'Invalid Payment']
        ),
        /Payment method account code must be tagged as "POS - Payment Method"/
      );
    });

    it('shall create payment method with fees', async function () {
      const client = db();

      // QRIS with 0.7% fee (rel_fee = 7000 = 0.7%)
      await client.execute(
        `INSERT INTO payment_methods (account_code, name, min_fee, max_fee, rel_fee)
         VALUES (?, ?, ?, ?, ?)`,
        [ACCOUNT_QRIS, 'QRIS', 0, 5000, 7000]
      );

      const result = await client.execute(`SELECT * FROM payment_methods WHERE name = 'QRIS'`);
      equal(Number(result.rows[0].rel_fee), 7000);
      equal(Number(result.rows[0].max_fee), 5000);
    });
  });

  describe('Discounts', function () {
    it('shall create global discount', async function () {
      const client = db();

      await client.execute(
        `INSERT INTO discounts (name, inventory_id, multiple_of_quantity, amount)
         VALUES (?, ?, ?, ?)`,
        ['Weekend Promo', null, 1, 5000]
      );

      const result = await client.execute(`SELECT * FROM discounts WHERE name = 'Weekend Promo'`);
      equal(result.rows.length, 1);
      equal(result.rows[0].inventory_id, null);
      equal(Number(result.rows[0].amount), 5000);
    });

    it('shall create inventory-specific discount', async function () {
      const client = db();

      await client.execute(
        `INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
         VALUES (?, ?, ?, ?)`,
        ['Teh Botol', 5000, 'pcs', ACCOUNT_PERSEDIAAN]
      );
      const inventory = (await client.execute(`SELECT id FROM inventories WHERE name = 'Teh Botol'`)).rows[0];

      // Buy 3, get 500 IDR off
      await client.execute(
        `INSERT INTO discounts (name, inventory_id, multiple_of_quantity, amount)
         VALUES (?, ?, ?, ?)`,
        ['Beli 3 Hemat 500', Number(inventory.id), 3, 500]
      );

      const result = await client.execute(`SELECT * FROM discounts WHERE name = 'Beli 3 Hemat 500'`);
      equal(Number(result.rows[0].inventory_id), Number(inventory.id));
      equal(Number(result.rows[0].multiple_of_quantity), 3);
      equal(Number(result.rows[0].amount), 500);
    });
  });

  describe('Purchases', function () {
    it('shall create and post purchase with journal entry', async function () {
      const client = db();
      const purchaseTime = new Date(2025, 0, 15, 10, 0, 0, 0).getTime();
      const postTime = new Date(2025, 0, 15, 10, 30, 0, 0).getTime();

      // Create supplier
      await client.execute(
        `INSERT INTO suppliers (name) VALUES (?)`,
        ['Supplier A']
      );
      const supplier = (await client.execute(`SELECT id FROM suppliers WHERE name = 'Supplier A'`)).rows[0];

      // Create inventory
      await client.execute(
        `INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
         VALUES (?, ?, ?, ?)`,
        ['Kopi Sachet', 2000, 'pcs', ACCOUNT_PERSEDIAAN]
      );
      const inventory = (await client.execute(`SELECT id FROM inventories WHERE name = 'Kopi Sachet'`)).rows[0];

      // Create purchase
      await client.execute(
        `INSERT INTO purchases (supplier_id, purchase_time) VALUES (?, ?)`,
        [Number(supplier.id), purchaseTime]
      );
      const purchase = (await client.execute(`SELECT id FROM purchases ORDER BY id DESC LIMIT 1`)).rows[0];

      // Add purchase line: 100 sachets @ 150,000 IDR
      await client.execute(
        `INSERT INTO purchase_lines (purchase_id, line_number, inventory_id, supplier_quantity, quantity, price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(purchase.id), 1, Number(inventory.id), 100, 100, 150000]
      );

      // Post the purchase
      await client.execute(
        `UPDATE purchases SET post_time = ? WHERE id = ?`,
        [postTime, Number(purchase.id)]
      );

      // Verify inventory updated
      const updatedInventory = (await client.execute(`SELECT * FROM inventories WHERE id = ?`, [Number(inventory.id)])).rows[0];
      equal(Number(updatedInventory.stock), 100);
      equal(Number(updatedInventory.cost), 150000);

      // Verify journal entry created
      const journalEntry = (await client.execute(
        `SELECT * FROM journal_entries WHERE source_reference = ?`,
        ['Purchase #' + purchase.id]
      )).rows[0];
      ok(journalEntry, 'Journal entry should be created');
      ok(journalEntry.post_time, 'Journal entry should be posted');

      // Verify account balances
      const inventoryAccount = (await client.execute(`SELECT balance FROM accounts WHERE account_code = ?`, [ACCOUNT_PERSEDIAAN])).rows[0];
      const apAccount = (await client.execute(`SELECT balance FROM accounts WHERE account_code = ?`, [ACCOUNT_UTANG_USAHA])).rows[0];

      equal(Number(inventoryAccount.balance), 150000, 'Inventory account should be debited');
      equal(Number(apAccount.balance), 150000, 'AP account should be credited');
    });

    it('shall handle purchase with catch-up COGS for negative stock', async function () {
      const client = db();
      const purchaseTime = new Date(2025, 1, 1, 10, 0, 0, 0).getTime();
      const saleTime = new Date(2025, 1, 2, 14, 0, 0, 0).getTime();
      const postTime = new Date(2025, 1, 2, 14, 30, 0, 0).getTime();
      const catchupPurchaseTime = new Date(2025, 1, 3, 10, 0, 0, 0).getTime();
      const catchupPostTime = new Date(2025, 1, 3, 10, 30, 0, 0).getTime();

      // Setup
      await client.execute(`INSERT INTO suppliers (name) VALUES (?)`, ['Supplier B']);
      const supplier = (await client.execute(`SELECT id FROM suppliers ORDER BY id DESC LIMIT 1`)).rows[0];

      await client.execute(
        `INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
         VALUES (?, ?, ?, ?)`,
        ['Gula Pasir', 15000, 'kg', ACCOUNT_PERSEDIAAN]
      );
      const inventory = (await client.execute(`SELECT id FROM inventories WHERE name = 'Gula Pasir'`)).rows[0];

      // First purchase: 10 kg @ 120,000 IDR
      await client.execute(`INSERT INTO purchases (supplier_id, purchase_time) VALUES (?, ?)`, [Number(supplier.id), purchaseTime]);
      const purchase1 = (await client.execute(`SELECT id FROM purchases ORDER BY id DESC LIMIT 1`)).rows[0];
      await client.execute(
        `INSERT INTO purchase_lines (purchase_id, line_number, inventory_id, supplier_quantity, quantity, price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(purchase1.id), 1, Number(inventory.id), 10, 10, 120000]
      );
      await client.execute(`UPDATE purchases SET post_time = ? WHERE id = ?`, [purchaseTime, Number(purchase1.id)]);

      // Sale: 15 kg (this will create negative stock of -5)
      await client.execute(
        `INSERT INTO payment_methods (account_code, name) VALUES (?, ?)`,
        [ACCOUNT_KAS, 'Tunai']
      );
      const paymentMethod = (await client.execute(`SELECT id FROM payment_methods WHERE name = 'Tunai'`)).rows[0];

      await client.execute(`INSERT INTO sales (sale_time) VALUES (?)`, [saleTime]);
      const sale = (await client.execute(`SELECT id FROM sales ORDER BY id DESC LIMIT 1`)).rows[0];
      await client.execute(
        `INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(sale.id), 1, Number(inventory.id), 15, 225000, 0]
      );
      await client.execute(
        `INSERT INTO sale_payments (sale_id, line_number, payment_method_id, amount)
         VALUES (?, ?, ?, ?)`,
        [Number(sale.id), 1, Number(paymentMethod.id), 225000]
      );
      await client.execute(`UPDATE sales SET post_time = ? WHERE id = ?`, [postTime, Number(sale.id)]);

      // Verify negative stock
      let inventoryState = (await client.execute(`SELECT * FROM inventories WHERE id = ?`, [Number(inventory.id)])).rows[0];
      equal(Number(inventoryState.stock), -5, 'Stock should be negative after overselling');

      // Catch-up purchase: 20 kg @ 250,000 IDR (12,500 per kg)
      await client.execute(`INSERT INTO purchases (supplier_id, purchase_time) VALUES (?, ?)`, [Number(supplier.id), catchupPurchaseTime]);
      const purchase2 = (await client.execute(`SELECT id FROM purchases ORDER BY id DESC LIMIT 1`)).rows[0];
      await client.execute(
        `INSERT INTO purchase_lines (purchase_id, line_number, inventory_id, supplier_quantity, quantity, price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(purchase2.id), 1, Number(inventory.id), 20, 20, 250000]
      );
      await client.execute(`UPDATE purchases SET post_time = ? WHERE id = ?`, [catchupPostTime, Number(purchase2.id)]);

      // Verify catch-up COGS
      // Catch-up COGS = MIN(5, 20) * (250000 / 20) = 5 * 12500 = 62,500
      // Inventory increase = 250000 - 62500 = 187,500
      inventoryState = (await client.execute(`SELECT * FROM inventories WHERE id = ?`, [Number(inventory.id)])).rows[0];
      equal(Number(inventoryState.stock), 15, 'Stock should be 15 after catch-up purchase');
      // Cost should be: remaining from sale (0) + catch-up purchase net = 187,500
      equal(Number(inventoryState.cost), 187500, 'Cost should reflect catch-up COGS deduction');

      // Verify COGS account was debited for catch-up
      const cogsAccount = (await client.execute(`SELECT balance FROM accounts WHERE account_code = ?`, [ACCOUNT_HPP])).rows[0];
      ok(Number(cogsAccount.balance) > 0, 'COGS should be recorded for catch-up');
    });
  });

  describe('Sales', function () {
    it('shall create and post sale with journal entry', async function () {
      const client = db();
      const purchaseTime = new Date(2025, 0, 10, 8, 0, 0, 0).getTime();
      const saleTime = new Date(2025, 0, 15, 14, 0, 0, 0).getTime();
      const postTime = new Date(2025, 0, 15, 14, 5, 0, 0).getTime();

      // Setup supplier and inventory
      await client.execute(`INSERT INTO suppliers (name) VALUES (?)`, ['Supplier C']);
      const supplier = (await client.execute(`SELECT id FROM suppliers ORDER BY id DESC LIMIT 1`)).rows[0];

      await client.execute(
        `INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
         VALUES (?, ?, ?, ?)`,
        ['Air Mineral', 4000, 'btl', ACCOUNT_PERSEDIAAN]
      );
      const inventory = (await client.execute(`SELECT id FROM inventories WHERE name = 'Air Mineral'`)).rows[0];

      // Purchase first: 50 bottles @ 100,000 IDR (2,000 per bottle cost)
      await client.execute(`INSERT INTO purchases (supplier_id, purchase_time) VALUES (?, ?)`, [Number(supplier.id), purchaseTime]);
      const purchase = (await client.execute(`SELECT id FROM purchases ORDER BY id DESC LIMIT 1`)).rows[0];
      await client.execute(
        `INSERT INTO purchase_lines (purchase_id, line_number, inventory_id, supplier_quantity, quantity, price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(purchase.id), 1, Number(inventory.id), 50, 50, 100000]
      );
      await client.execute(`UPDATE purchases SET post_time = ? WHERE id = ?`, [purchaseTime, Number(purchase.id)]);

      // Setup payment method
      await client.execute(
        `INSERT INTO payment_methods (account_code, name) VALUES (?, ?)`,
        [ACCOUNT_KAS, 'Kas']
      );
      const paymentMethod = (await client.execute(`SELECT id FROM payment_methods WHERE name = 'Kas'`)).rows[0];

      // Create sale: 10 bottles @ 40,000 IDR
      await client.execute(`INSERT INTO sales (sale_time) VALUES (?)`, [saleTime]);
      const sale = (await client.execute(`SELECT id FROM sales ORDER BY id DESC LIMIT 1`)).rows[0];

      await client.execute(
        `INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(sale.id), 1, Number(inventory.id), 10, 40000, 0]
      );

      // Verify cost is auto-calculated
      const saleLine = (await client.execute(
        `SELECT * FROM sale_lines WHERE sale_id = ? AND line_number = 1`,
        [Number(sale.id)]
      )).rows[0];
      equal(Number(saleLine.cost), 20000, 'Cost should be auto-calculated (10 * 2000)');

      await client.execute(
        `INSERT INTO sale_payments (sale_id, line_number, payment_method_id, amount)
         VALUES (?, ?, ?, ?)`,
        [Number(sale.id), 1, Number(paymentMethod.id), 40000]
      );

      // Post the sale
      await client.execute(`UPDATE sales SET post_time = ? WHERE id = ?`, [postTime, Number(sale.id)]);

      // Verify sale totals updated
      const postedSale = (await client.execute(`SELECT * FROM sales WHERE id = ?`, [Number(sale.id)])).rows[0];
      equal(Number(postedSale.gross_amount), 40000);
      equal(Number(postedSale.discount_amount), 0);
      equal(Number(postedSale.invoice_amount), 40000);

      // Verify inventory updated
      const updatedInventory = (await client.execute(`SELECT * FROM inventories WHERE id = ?`, [Number(inventory.id)])).rows[0];
      equal(Number(updatedInventory.stock), 40, 'Stock should decrease by 10');
      equal(Number(updatedInventory.cost), 80000, 'Cost should decrease by 20000');
      equal(Number(updatedInventory.num_of_sales), 10, 'num_of_sales should increase by 10');

      // Verify journal entry
      const journalEntry = (await client.execute(
        `SELECT * FROM journal_entries WHERE source_reference = ?`,
        ['Sale #' + sale.id]
      )).rows[0];
      ok(journalEntry, 'Journal entry should be created');

      // Verify account balances
      const cashAccount = (await client.execute(`SELECT balance FROM accounts WHERE account_code = ?`, [ACCOUNT_KAS])).rows[0];
      const revenueAccount = (await client.execute(`SELECT balance FROM accounts WHERE account_code = ?`, [ACCOUNT_PENJUALAN])).rows[0];
      const cogsAccount = (await client.execute(`SELECT balance FROM accounts WHERE account_code = ?`, [ACCOUNT_HPP])).rows[0];

      equal(Number(cashAccount.balance), 40000, 'Cash should be debited');
      equal(Number(revenueAccount.balance), 40000, 'Revenue should be credited');
      equal(Number(cogsAccount.balance), 20000, 'COGS should be debited');
    });

    it('shall create sale with discount', async function () {
      const client = db();
      const purchaseTime = new Date(2025, 1, 1, 8, 0, 0, 0).getTime();
      const saleTime = new Date(2025, 1, 5, 15, 0, 0, 0).getTime();
      const postTime = new Date(2025, 1, 5, 15, 5, 0, 0).getTime();

      // Setup
      await client.execute(`INSERT INTO suppliers (name) VALUES (?)`, ['Supplier D']);
      const supplier = (await client.execute(`SELECT id FROM suppliers ORDER BY id DESC LIMIT 1`)).rows[0];

      await client.execute(
        `INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
         VALUES (?, ?, ?, ?)`,
        ['Snack', 10000, 'pcs', ACCOUNT_PERSEDIAAN]
      );
      const inventory = (await client.execute(`SELECT id FROM inventories WHERE name = 'Snack'`)).rows[0];

      // Purchase: 100 pcs @ 500,000 IDR
      await client.execute(`INSERT INTO purchases (supplier_id, purchase_time) VALUES (?, ?)`, [Number(supplier.id), purchaseTime]);
      const purchase = (await client.execute(`SELECT id FROM purchases ORDER BY id DESC LIMIT 1`)).rows[0];
      await client.execute(
        `INSERT INTO purchase_lines (purchase_id, line_number, inventory_id, supplier_quantity, quantity, price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(purchase.id), 1, Number(inventory.id), 100, 100, 500000]
      );
      await client.execute(`UPDATE purchases SET post_time = ? WHERE id = ?`, [purchaseTime, Number(purchase.id)]);

      // Create discount: Buy 3 get 2000 off
      await client.execute(
        `INSERT INTO discounts (name, inventory_id, multiple_of_quantity, amount)
         VALUES (?, ?, ?, ?)`,
        ['Beli 3 Diskon', Number(inventory.id), 3, 2000]
      );
      const discount = (await client.execute(`SELECT id FROM discounts WHERE name = 'Beli 3 Diskon'`)).rows[0];

      // Payment method
      await client.execute(`INSERT INTO payment_methods (account_code, name) VALUES (?, ?)`, [ACCOUNT_KAS, 'Tunai2']);
      const paymentMethod = (await client.execute(`SELECT id FROM payment_methods WHERE name = 'Tunai2'`)).rows[0];

      // Create sale: 7 pieces (floor(7/3) * 2000 = 4000 discount)
      await client.execute(`INSERT INTO sales (sale_time) VALUES (?)`, [saleTime]);
      const sale = (await client.execute(`SELECT id FROM sales ORDER BY id DESC LIMIT 1`)).rows[0];

      await client.execute(
        `INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(sale.id), 1, Number(inventory.id), 7, 70000, 0]
      );

      await client.execute(
        `INSERT INTO sale_discounts (sale_id, line_number, discount_id, amount)
         VALUES (?, ?, ?, ?)`,
        [Number(sale.id), 1, Number(discount.id), 4000]
      );

      // Payment: 70000 - 4000 = 66000
      await client.execute(
        `INSERT INTO sale_payments (sale_id, line_number, payment_method_id, amount)
         VALUES (?, ?, ?, ?)`,
        [Number(sale.id), 1, Number(paymentMethod.id), 66000]
      );

      // Post sale
      await client.execute(`UPDATE sales SET post_time = ? WHERE id = ?`, [postTime, Number(sale.id)]);

      // Verify sale totals
      const postedSale = (await client.execute(`SELECT * FROM sales WHERE id = ?`, [Number(sale.id)])).rows[0];
      equal(Number(postedSale.gross_amount), 70000);
      equal(Number(postedSale.discount_amount), 4000);
      equal(Number(postedSale.invoice_amount), 66000);

      // Verify discount account
      const discountAccount = (await client.execute(`SELECT balance FROM accounts WHERE account_code = ?`, [ACCOUNT_DISKON_PENJUALAN])).rows[0];
      equal(Number(discountAccount.balance), 4000, 'Discount contra-revenue should be debited');
    });

    it('shall prevent deleting sale line for posted sale', async function () {
      const client = db();
      const purchaseTime = new Date(2025, 2, 1, 8, 0, 0, 0).getTime();
      const saleTime = new Date(2025, 2, 5, 10, 0, 0, 0).getTime();
      const postTime = new Date(2025, 2, 5, 10, 5, 0, 0).getTime();

      // Setup
      await client.execute(`INSERT INTO suppliers (name) VALUES (?)`, ['Supplier E']);
      const supplier = (await client.execute(`SELECT id FROM suppliers ORDER BY id DESC LIMIT 1`)).rows[0];

      await client.execute(
        `INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
         VALUES (?, ?, ?, ?)`,
        ['Permen', 500, 'pcs', ACCOUNT_PERSEDIAAN]
      );
      const inventory = (await client.execute(`SELECT id FROM inventories WHERE name = 'Permen'`)).rows[0];

      await client.execute(`INSERT INTO purchases (supplier_id, purchase_time) VALUES (?, ?)`, [Number(supplier.id), purchaseTime]);
      const purchase = (await client.execute(`SELECT id FROM purchases ORDER BY id DESC LIMIT 1`)).rows[0];
      await client.execute(
        `INSERT INTO purchase_lines (purchase_id, line_number, inventory_id, supplier_quantity, quantity, price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(purchase.id), 1, Number(inventory.id), 200, 200, 40000]
      );
      await client.execute(`UPDATE purchases SET post_time = ? WHERE id = ?`, [purchaseTime, Number(purchase.id)]);

      await client.execute(`INSERT INTO payment_methods (account_code, name) VALUES (?, ?)`, [ACCOUNT_KAS, 'Tunai3']);
      const paymentMethod = (await client.execute(`SELECT id FROM payment_methods WHERE name = 'Tunai3'`)).rows[0];

      await client.execute(`INSERT INTO sales (sale_time) VALUES (?)`, [saleTime]);
      const sale = (await client.execute(`SELECT id FROM sales ORDER BY id DESC LIMIT 1`)).rows[0];

      await client.execute(
        `INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(sale.id), 1, Number(inventory.id), 10, 5000, 0]
      );

      await client.execute(
        `INSERT INTO sale_payments (sale_id, line_number, payment_method_id, amount)
         VALUES (?, ?, ?, ?)`,
        [Number(sale.id), 1, Number(paymentMethod.id), 5000]
      );

      await client.execute(`UPDATE sales SET post_time = ? WHERE id = ?`, [postTime, Number(sale.id)]);

      // Try to delete sale line
      await rejects(
        client.execute(`DELETE FROM sale_lines WHERE sale_id = ?`, [Number(sale.id)]),
        /Cannot delete sale line for posted sale/
      );
    });

    it('shall allow zero-cost sale when stock is zero or negative', async function () {
      const client = db();
      const saleTime = new Date(2025, 3, 1, 10, 0, 0, 0).getTime();
      const postTime = new Date(2025, 3, 1, 10, 5, 0, 0).getTime();

      // Create inventory with zero stock
      await client.execute(
        `INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
         VALUES (?, ?, ?, ?)`,
        ['Pre-order Item', 50000, 'pcs', ACCOUNT_PERSEDIAAN]
      );
      const inventory = (await client.execute(`SELECT id FROM inventories WHERE name = 'Pre-order Item'`)).rows[0];

      await client.execute(`INSERT INTO payment_methods (account_code, name) VALUES (?, ?)`, [ACCOUNT_KAS, 'Tunai4']);
      const paymentMethod = (await client.execute(`SELECT id FROM payment_methods WHERE name = 'Tunai4'`)).rows[0];

      // Create and post sale with zero stock
      await client.execute(`INSERT INTO sales (sale_time) VALUES (?)`, [saleTime]);
      const sale = (await client.execute(`SELECT id FROM sales ORDER BY id DESC LIMIT 1`)).rows[0];

      await client.execute(
        `INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(sale.id), 1, Number(inventory.id), 5, 250000, 0]
      );

      // Verify cost is 0 due to zero stock
      const saleLine = (await client.execute(`SELECT * FROM sale_lines WHERE sale_id = ?`, [Number(sale.id)])).rows[0];
      equal(Number(saleLine.cost), 0, 'Cost should be 0 when stock is zero');

      await client.execute(
        `INSERT INTO sale_payments (sale_id, line_number, payment_method_id, amount)
         VALUES (?, ?, ?, ?)`,
        [Number(sale.id), 1, Number(paymentMethod.id), 250000]
      );

      await client.execute(`UPDATE sales SET post_time = ? WHERE id = ?`, [postTime, Number(sale.id)]);

      // Verify negative stock
      const updatedInventory = (await client.execute(`SELECT * FROM inventories WHERE id = ?`, [Number(inventory.id)])).rows[0];
      equal(Number(updatedInventory.stock), -5, 'Stock should be negative');
      equal(Number(updatedInventory.cost), 0, 'Cost should remain 0');
    });
  });

  describe('Stock Taking', function () {
    it('shall record stock taking with gain adjustment', async function () {
      const client = db();
      const purchaseTime = new Date(2025, 4, 1, 8, 0, 0, 0).getTime();
      const auditTime = new Date(2025, 4, 15, 9, 0, 0, 0).getTime();

      // Setup
      await client.execute(`INSERT INTO suppliers (name) VALUES (?)`, ['Supplier F']);
      const supplier = (await client.execute(`SELECT id FROM suppliers ORDER BY id DESC LIMIT 1`)).rows[0];

      await client.execute(
        `INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
         VALUES (?, ?, ?, ?)`,
        ['Buku Tulis', 5000, 'pcs', ACCOUNT_PERSEDIAAN]
      );
      const inventory = (await client.execute(`SELECT id FROM inventories WHERE name = 'Buku Tulis'`)).rows[0];

      // Purchase: 50 pcs @ 150,000 (3,000 per unit)
      await client.execute(`INSERT INTO purchases (supplier_id, purchase_time) VALUES (?, ?)`, [Number(supplier.id), purchaseTime]);
      const purchase = (await client.execute(`SELECT id FROM purchases ORDER BY id DESC LIMIT 1`)).rows[0];
      await client.execute(
        `INSERT INTO purchase_lines (purchase_id, line_number, inventory_id, supplier_quantity, quantity, price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(purchase.id), 1, Number(inventory.id), 50, 50, 150000]
      );
      await client.execute(`UPDATE purchases SET post_time = ? WHERE id = ?`, [purchaseTime, Number(purchase.id)]);

      // Stock taking: found 55 pcs (gain of 5 pcs)
      // Expected cost: 150,000, Actual cost = 55 * 3000 = 165,000
      await client.execute(
        `INSERT INTO stock_takings (inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(inventory.id), auditTime, 50, 55, 150000, 165000]
      );

      // Verify inventory updated
      const updatedInventory = (await client.execute(`SELECT * FROM inventories WHERE id = ?`, [Number(inventory.id)])).rows[0];
      equal(Number(updatedInventory.stock), 55);
      equal(Number(updatedInventory.cost), 165000);

      // Verify gain account credited
      const gainAccount = (await client.execute(`SELECT balance FROM accounts WHERE account_code = ?`, [ACCOUNT_KEUNTUNGAN_SELISIH])).rows[0];
      equal(Number(gainAccount.balance), 15000, 'Inventory Gain should be credited');
    });

    it('shall record stock taking with shrinkage adjustment', async function () {
      const client = db();
      const purchaseTime = new Date(2025, 5, 1, 8, 0, 0, 0).getTime();
      const auditTime = new Date(2025, 5, 15, 9, 0, 0, 0).getTime();

      // Setup
      await client.execute(`INSERT INTO suppliers (name) VALUES (?)`, ['Supplier G']);
      const supplier = (await client.execute(`SELECT id FROM suppliers ORDER BY id DESC LIMIT 1`)).rows[0];

      await client.execute(
        `INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
         VALUES (?, ?, ?, ?)`,
        ['Pensil', 2000, 'pcs', ACCOUNT_PERSEDIAAN]
      );
      const inventory = (await client.execute(`SELECT id FROM inventories WHERE name = 'Pensil'`)).rows[0];

      // Purchase: 100 pcs @ 100,000 (1,000 per unit)
      await client.execute(`INSERT INTO purchases (supplier_id, purchase_time) VALUES (?, ?)`, [Number(supplier.id), purchaseTime]);
      const purchase = (await client.execute(`SELECT id FROM purchases ORDER BY id DESC LIMIT 1`)).rows[0];
      await client.execute(
        `INSERT INTO purchase_lines (purchase_id, line_number, inventory_id, supplier_quantity, quantity, price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(purchase.id), 1, Number(inventory.id), 100, 100, 100000]
      );
      await client.execute(`UPDATE purchases SET post_time = ? WHERE id = ?`, [purchaseTime, Number(purchase.id)]);

      // Stock taking: found 90 pcs (shrinkage of 10 pcs)
      // Expected cost: 100,000, Actual cost = 90 * 1000 = 90,000
      await client.execute(
        `INSERT INTO stock_takings (inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(inventory.id), auditTime, 100, 90, 100000, 90000]
      );

      // Verify inventory updated
      const updatedInventory = (await client.execute(`SELECT * FROM inventories WHERE id = ?`, [Number(inventory.id)])).rows[0];
      equal(Number(updatedInventory.stock), 90);
      equal(Number(updatedInventory.cost), 90000);

      // Verify shrinkage account debited
      const shrinkageAccount = (await client.execute(`SELECT balance FROM accounts WHERE account_code = ?`, [ACCOUNT_SELISIH_PERSEDIAAN])).rows[0];
      equal(Number(shrinkageAccount.balance), 10000, 'Inventory Shrinkage should be debited');
    });
  });

  describe('Fiscal Year Closing with POS', function () {
    it('shall prevent fiscal year closing with negative inventory', async function () {
      const client = db();
      const saleTime = new Date(2025, 3, 1, 10, 0, 0, 0).getTime();
      const postTime = new Date(2025, 3, 1, 10, 5, 0, 0).getTime();
      const closingTime = new Date(2026, 0, 15, 0, 0, 0, 0).getTime();

      // Create inventory with zero stock and make negative via sale
      await client.execute(
        `INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
         VALUES (?, ?, ?, ?)`,
        ['Backorder Item', 100000, 'pcs', ACCOUNT_PERSEDIAAN]
      );
      const inventory = (await client.execute(`SELECT id FROM inventories WHERE name = 'Backorder Item'`)).rows[0];

      await client.execute(`INSERT INTO payment_methods (account_code, name) VALUES (?, ?)`, [ACCOUNT_KAS, 'Tunai5']);
      const paymentMethod = (await client.execute(`SELECT id FROM payment_methods WHERE name = 'Tunai5'`)).rows[0];

      // Create sale causing negative stock
      await client.execute(`INSERT INTO sales (sale_time) VALUES (?)`, [saleTime]);
      const sale = (await client.execute(`SELECT id FROM sales ORDER BY id DESC LIMIT 1`)).rows[0];

      await client.execute(
        `INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(sale.id), 1, Number(inventory.id), 2, 200000, 0]
      );

      await client.execute(
        `INSERT INTO sale_payments (sale_id, line_number, payment_method_id, amount)
         VALUES (?, ?, ?, ?)`,
        [Number(sale.id), 1, Number(paymentMethod.id), 200000]
      );

      await client.execute(`UPDATE sales SET post_time = ? WHERE id = ?`, [postTime, Number(sale.id)]);

      // Verify negative stock
      const updatedInventory = (await client.execute(`SELECT * FROM inventories WHERE id = ?`, [Number(inventory.id)])).rows[0];
      equal(Number(updatedInventory.stock), -2, 'Stock should be negative');

      // Try to close fiscal year
      const fiscalYear = (await client.execute(`SELECT * FROM fiscal_years LIMIT 1`)).rows[0];

      await rejects(
        client.execute(`UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`, [closingTime, Number(fiscalYear.begin_time)]),
        /Cannot close fiscal year: One or more inventories have negative stock/
      );
    });
  });

  describe('Manual Journal Entry Prevention', function () {
    it('shall prevent manual journal entry to POS inventory account', async function () {
      const client = db();

      // Create inventory
      await client.execute(
        `INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
         VALUES (?, ?, ?, ?)`,
        ['Protected Item', 10000, 'pcs', ACCOUNT_PERSEDIAAN]
      );

      // Try to create manual journal entry to inventory account
      const entryTime = new Date(2025, 6, 1, 10, 0, 0, 0).getTime();

      await client.execute(
        `INSERT INTO journal_entries (entry_time, source_type) VALUES (?, ?)`,
        [entryTime, 'Manual']
      );
      const journalEntry = (await client.execute(`SELECT ref FROM journal_entries ORDER BY ref DESC LIMIT 1`)).rows[0];

      await rejects(
        client.execute(
          `INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit)
           VALUES (?, ?, ?, ?, ?)`,
          [Number(journalEntry.ref), 1, ACCOUNT_PERSEDIAAN, 10000, 0]
        ),
        /Manual journal entries are not allowed for accounts tagged as "POS - Inventory"/
      );
    });
  });

  describe('Sale Discount Validation', function () {
    it('shall reject discount for wrong inventory', async function () {
      const client = db();
      const purchaseTime = new Date(2025, 7, 1, 8, 0, 0, 0).getTime();
      const saleTime = new Date(2025, 7, 5, 10, 0, 0, 0).getTime();

      // Setup
      await client.execute(`INSERT INTO suppliers (name) VALUES (?)`, ['Supplier H']);
      const supplier = (await client.execute(`SELECT id FROM suppliers ORDER BY id DESC LIMIT 1`)).rows[0];

      await client.execute(
        `INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
         VALUES (?, ?, ?, ?)`,
        ['Item A', 10000, 'pcs', ACCOUNT_PERSEDIAAN]
      );
      const inventoryA = (await client.execute(`SELECT id FROM inventories WHERE name = 'Item A'`)).rows[0];

      await client.execute(
        `INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
         VALUES (?, ?, ?, ?)`,
        ['Item B', 15000, 'pcs', ACCOUNT_PERSEDIAAN]
      );
      const inventoryB = (await client.execute(`SELECT id FROM inventories WHERE name = 'Item B'`)).rows[0];

      // Purchase
      await client.execute(`INSERT INTO purchases (supplier_id, purchase_time) VALUES (?, ?)`, [Number(supplier.id), purchaseTime]);
      const purchase = (await client.execute(`SELECT id FROM purchases ORDER BY id DESC LIMIT 1`)).rows[0];
      await client.execute(
        `INSERT INTO purchase_lines (purchase_id, line_number, inventory_id, supplier_quantity, quantity, price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(purchase.id), 1, Number(inventoryA.id), 50, 50, 250000]
      );
      await client.execute(
        `INSERT INTO purchase_lines (purchase_id, line_number, inventory_id, supplier_quantity, quantity, price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(purchase.id), 2, Number(inventoryB.id), 50, 50, 375000]
      );
      await client.execute(`UPDATE purchases SET post_time = ? WHERE id = ?`, [purchaseTime, Number(purchase.id)]);

      // Create discount for Item A only
      await client.execute(
        `INSERT INTO discounts (name, inventory_id, multiple_of_quantity, amount)
         VALUES (?, ?, ?, ?)`,
        ['Discount A', Number(inventoryA.id), 1, 1000]
      );
      const discountA = (await client.execute(`SELECT id FROM discounts WHERE name = 'Discount A'`)).rows[0];

      // Create sale with Item B
      await client.execute(`INSERT INTO sales (sale_time) VALUES (?)`, [saleTime]);
      const sale = (await client.execute(`SELECT id FROM sales ORDER BY id DESC LIMIT 1`)).rows[0];

      await client.execute(
        `INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(sale.id), 1, Number(inventoryB.id), 5, 75000, 0]
      );

      // Try to apply discount A to sale line with Item B
      await rejects(
        client.execute(
          `INSERT INTO sale_discounts (sale_id, line_number, discount_id, amount)
           VALUES (?, ?, ?, ?)`,
          [Number(sale.id), 1, Number(discountA.id), 5000]
        ),
        /Discount is not applicable to this inventory/
      );
    });
  });
});