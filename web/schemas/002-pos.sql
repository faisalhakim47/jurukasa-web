-- =================================================================
-- POS Database Migration Script
-- Version: 1.0
-- Date: 2025-12-22
-- SQLite Version: 3.43.0
-- Dependencies: 001-accounting.sql
-- 
-- This script extends the accounting schema.
-- This script creates the POS schema.
-- 
-- Notes:
-- - When a table includes both quantity and price columns, the price always represents total price for the quantity, not unit price.
-- - On the Database Normalization Theory, to store unit price is bullshit (the golden example is when the buyer and seller are CONTRACTUALLY AGREED to sell 3 eggs for 10k IDR. It is impossible to use unit price, we REQUIRE to store total price as truth factual information that happen). Always use total price as source of truth.
-- - The business requires allowing negative stock to handle backorder situations. We have decided to implement Zero-Cost Sales + Catch-up Purchases solution for negative stock handling.
-- 
-- Migration Features:
-- - ACID transaction boundary
-- - Performance-optimized indexes
-- - Each top-level statement is followed by end-of-statement (EOS) marker
-- =================================================================

CREATE TABLE inventories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  unit_of_measurement TEXT, -- must be the lowest possible unit possible (e.g., 'piece', 'mg', etc.)
  account_code INTEGER NOT NULL REFERENCES accounts (account_code), -- the account balance must be equal to sum of inventory cost with the same account_code
  cost INTEGER NOT NULL DEFAULT 0 CHECK (cost >= 0), -- the total purchase cost of its inventory stock. We are strictly using simple average cost method for inventory valuation.
  stock INTEGER NOT NULL DEFAULT 0, -- our system allows negative stock. We implement Zero-Cost Sales + Catch-up Purchases solution for negative stock handling.
  num_of_sales INTEGER NOT NULL DEFAULT 0,
  latest_stock_taking_time INTEGER -- timestamp of the most recent stock taking for this inventory, used for ordering stock taking priority
) STRICT; -- EOS

-- Ensure inventory account is a Current Asset
CREATE TRIGGER inventories_account_code_validation_trigger
BEFORE INSERT ON inventories FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM account_tags
        WHERE account_code = NEW.account_code
          AND tag = 'POS - Inventory'
      ) THEN RAISE(ABORT, 'Insert failed. Inventory account code must be tagged as "POS - Inventory"')
    END;
END; -- EOS

CREATE TRIGGER inventories_account_code_update_validation_trigger
BEFORE UPDATE OF account_code ON inventories FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM account_tags
        WHERE account_code = NEW.account_code
          AND tag = 'POS - Inventory'
      ) THEN RAISE(ABORT, 'Update failed. Inventory account code must be tagged as "POS - Inventory"')
    END;
END; -- EOS

-- Ensure account balance matches sum of inventory costs
CREATE TRIGGER inventories_account_balance_insert_validation_trigger
AFTER INSERT ON inventories FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN (
        SELECT SUM(cost) FROM inventories WHERE account_code = NEW.account_code
      ) != (
        SELECT balance FROM accounts WHERE account_code = NEW.account_code
      ) THEN RAISE(ABORT, 'Account balance must match sum of inventory costs')
    END;
END; -- EOS

-- Note: Update validation is intentionally omitted because SQLite's FOR EACH ROW
-- trigger semantics make it incompatible with multi-row UPDATE statements used
-- in purchase/sale posting. The integrity is maintained by system triggers that
-- update both accounts and inventories atomically within the same transaction.

CREATE TABLE inventory_barcodes (
  code TEXT PRIMARY KEY,
  inventory_id INTEGER NOT NULL REFERENCES inventories (id)
) STRICT, WITHOUT ROWID; -- EOS

CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone_number TEXT
) STRICT; -- EOS

-- This is alias inventories for specific suppliers
-- This would help for LLM based purchase order generation
CREATE TABLE supplier_inventories (
  supplier_id INTEGER NOT NULL REFERENCES suppliers (id),
  inventory_id INTEGER NOT NULL REFERENCES inventories (id),
  quantity_conversion INTEGER NOT NULL DEFAULT 1 CHECK (quantity_conversion > 0), -- number of internal SKU units per supplier unit. All supplier unit MUST be larger than or equal to 1 internal SKU unit
  name TEXT, -- the name of inventory as mentioned in supplier catalog or purchase order
  PRIMARY KEY (supplier_id, inventory_id, quantity_conversion)
) STRICT, WITHOUT ROWID; -- EOS

CREATE TABLE purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers (id),
  purchase_time INTEGER NOT NULL,
  post_time INTEGER
) STRICT; -- EOS

CREATE TRIGGER purchases_post_trigger
AFTER UPDATE OF post_time ON purchases FOR EACH ROW
WHEN OLD.post_time IS NULL AND NEW.post_time IS NOT NULL
BEGIN
  -- Draft Journal Entry
  INSERT INTO journal_entries (entry_time, note, source_type, source_reference, created_by)
  VALUES (
    NEW.purchase_time,
    'Purchase #' || NEW.id,
    'System',
    'Purchase #' || NEW.id,
    'System'
  );

  -- Debit Inventory (Inventory Accounts)
  -- Amount = Purchase Price - Catchup COGS
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description)
  SELECT
    last_insert_rowid(),
    account_code,
    CAST(SUM(total_price) - SUM(catchup_cogs_rounded) AS INTEGER),
    0,
    'Purchase Stock'
  FROM (
    SELECT
      p.account_code,
      SUM(pl.price) as total_price,
      CAST(ROUND(CASE
        WHEN p.stock >= 0 THEN 0
        ELSE CAST(MIN(ABS(p.stock), SUM(pl.quantity)) AS REAL) * CAST(SUM(pl.price) AS REAL) / SUM(pl.quantity)
      END) AS INTEGER) as catchup_cogs_rounded
    FROM purchase_lines pl
    JOIN inventories p ON p.id = pl.inventory_id
    WHERE pl.purchase_id = NEW.id
    GROUP BY p.id, p.account_code, p.stock
  )
  GROUP BY account_code
  HAVING CAST(SUM(total_price) - SUM(catchup_cogs_rounded) AS INTEGER) > 0;

  -- Debit COGS (Expense) for Catch-up
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description)
  SELECT
    last_insert_rowid(),
    (SELECT account_code FROM account_tags WHERE tag = 'POS - Cost of Goods Sold' LIMIT 1),
    catchup_total,
    0,
    'COGS Catch-up'
  FROM (
    SELECT
      SUM(CAST(ROUND(
        CASE
          WHEN p.stock >= 0 THEN 0
          ELSE CAST(MIN(ABS(p.stock), pl_quantity) AS REAL) * CAST(pl_price AS REAL) / pl_quantity
        END
      ) AS INTEGER)) as catchup_total
    FROM (
      SELECT
        p.id as inventory_id,
        p.stock,
        SUM(pl.quantity) as pl_quantity,
        SUM(pl.price) as pl_price
      FROM purchase_lines pl
      JOIN inventories p ON p.id = pl.inventory_id
      WHERE pl.purchase_id = NEW.id
      GROUP BY p.id, p.stock
    ) sub
    JOIN inventories p ON p.id = sub.inventory_id
  )
  WHERE catchup_total > 0;

  -- Credit Accounts Payable
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description)
  SELECT
    last_insert_rowid(),
    (SELECT account_code FROM account_tags WHERE tag = 'POS - Accounts Payable' LIMIT 1),
    0,
    (SELECT SUM(price) FROM purchase_lines WHERE purchase_id = NEW.id),
    'Purchase Payable'
  WHERE EXISTS (SELECT 1 FROM account_tags WHERE tag = 'POS - Accounts Payable')
    AND (SELECT SUM(price) FROM purchase_lines WHERE purchase_id = NEW.id) > 0;

  -- Validation: Ensure AP account was found
  SELECT
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM account_tags WHERE tag = 'POS - Accounts Payable')
      THEN RAISE(ABORT, 'Account with tag "POS - Accounts Payable" not found for purchase posting')
    END;

  -- Post the journal entry (triggers account balance updates)
  UPDATE journal_entries
  SET post_time = NEW.post_time
  WHERE ref = (
    SELECT ref FROM journal_entries
    WHERE source_reference = 'Purchase #' || NEW.id
      AND source_type = 'System'
      AND post_time IS NULL
    ORDER BY ref DESC
    LIMIT 1
  );

  -- Update inventory stock and cost (after account balance updates)
  UPDATE inventories
  SET
    stock = stock + (
      SELECT SUM(quantity)
      FROM purchase_lines
      WHERE purchase_id = NEW.id AND inventory_id = inventories.id
    ),
    cost = cost + (
      SELECT SUM(price)
      FROM purchase_lines
      WHERE purchase_id = NEW.id AND inventory_id = inventories.id
    ) - (
      -- Catch-up COGS subtraction
      SELECT
        CAST(ROUND(
          CASE
            WHEN inventories.stock >= 0 THEN 0
            ELSE CAST(MIN(ABS(inventories.stock), SUM(quantity)) AS REAL) * CAST(SUM(price) AS REAL) / SUM(quantity)
          END
        ) AS INTEGER)
      FROM purchase_lines
      WHERE purchase_id = NEW.id AND inventory_id = inventories.id
      GROUP BY inventory_id
    )
  WHERE id IN (SELECT inventory_id FROM purchase_lines WHERE purchase_id = NEW.id);

END; -- EOS

-- We differentciate between supplier_quantity and quantity to handle cases where
-- the supplier uses different unit of measurement or packaging than our internal SKU system
CREATE TABLE purchase_lines (
  purchase_id INTEGER NOT NULL REFERENCES purchases (id),
  line_number INTEGER NOT NULL,
  inventory_id INTEGER NOT NULL REFERENCES inventories (id),
  supplier_quantity INTEGER NOT NULL, -- quantity as mentioned in supplier purchase order receipt
  quantity INTEGER NOT NULL, -- quantity for our SKU system
  price INTEGER NOT NULL,
  PRIMARY KEY (purchase_id, line_number)
) STRICT, WITHOUT ROWID; -- EOS

CREATE TRIGGER purchase_lines_auto_supplier_inventory_trigger
AFTER INSERT ON purchase_lines FOR EACH ROW
BEGIN
  INSERT OR IGNORE INTO supplier_inventories (supplier_id, inventory_id, quantity_conversion)
  SELECT
    (SELECT supplier_id FROM purchases WHERE id = NEW.purchase_id),
    NEW.inventory_id,
    NEW.quantity / NEW.supplier_quantity
  WHERE NEW.supplier_quantity > 0;
END; -- EOS

CREATE TRIGGER purchase_lines_quantity_validation_trigger
BEFORE INSERT ON purchase_lines FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1 FROM supplier_inventories sp
        WHERE sp.supplier_id = (SELECT supplier_id FROM purchases WHERE id = NEW.purchase_id)
          AND sp.inventory_id = NEW.inventory_id
          AND NEW.quantity != NEW.supplier_quantity * sp.quantity_conversion
      ) THEN RAISE(ABORT, 'Quantity must match supplier_quantity * quantity_conversion')
    END;
END; -- EOS

-- Our discount system use case is very simple.
-- Each quantity of multiple_of_quantity entitles the buyer to a multiple of amount discount.
-- For example, "Each purchase of 3 pieces get 500 IDR off" would be represented as multiple_of_quantity = 3 and amount = 500. When a buyer purchases 7 pieces, they would get (7 // 3) * 500 = 1000 IDR off.
CREATE TABLE discounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  inventory_id INTEGER REFERENCES inventories (id),
  multiple_of_quantity INTEGER NOT NULL CHECK (multiple_of_quantity > 0),
  amount INTEGER NOT NULL
) STRICT; -- EOS

CREATE TABLE payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_code INTEGER NOT NULL REFERENCES accounts (account_code),
  name TEXT NOT NULL,
  min_fee INTEGER NOT NULL DEFAULT 0,
  max_fee INTEGER NOT NULL DEFAULT 0,
  rel_fee INTEGER NOT NULL DEFAULT 0 -- percentage fee (0 - 1000000); The lowest possible is 0.0001% the highest possible is 100%
) STRICT; -- EOS

CREATE TRIGGER payment_methods_account_code_validation_trigger
BEFORE INSERT ON payment_methods FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM account_tags
        WHERE account_code = NEW.account_code
          AND tag = 'POS - Payment Method'
      ) THEN RAISE(ABORT, 'Payment method account code must be tagged as "POS - Payment Method"')
    END;
END; -- EOS

CREATE TRIGGER payment_methods_account_code_update_validation_trigger
BEFORE UPDATE OF account_code ON payment_methods FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM account_tags
        WHERE account_code = NEW.account_code
          AND tag = 'POS - Payment Method'
      ) THEN RAISE(ABORT, 'Payment method account code must be tagged as "POS - Payment Method"')
    END;
END; -- EOS

CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT,
  sale_time INTEGER NOT NULL,
  post_time INTEGER,
  gross_amount INTEGER, -- calculated upon posting
  discount_amount INTEGER, -- calculated upon posting
  fee_amount INTEGER, -- calculated upon posting
  invoice_amount INTEGER -- calculated upon posting, the invoice_amount must be equal to gross_amount - discount_amount
) STRICT; -- EOS

CREATE TABLE sale_lines (
  sale_id INTEGER NOT NULL REFERENCES sales (id),
  line_number INTEGER NOT NULL,
  inventory_id INTEGER NOT NULL REFERENCES inventories (id),
  quantity INTEGER NOT NULL,
  price INTEGER NOT NULL,
  cost INTEGER NOT NULL, -- the cost of goods sold for its line quantity (We are using simple average cost method, the small lost of precision is acceptable for POS system). The cost data will be calculated automatically upon insertion.
  PRIMARY KEY (sale_id, line_number)
) STRICT, WITHOUT ROWID; -- EOS

CREATE TRIGGER sale_lines_insert_cost_trigger
AFTER INSERT ON sale_lines FOR EACH ROW
BEGIN
  UPDATE sale_lines
  SET cost = (
    SELECT
      CASE
        WHEN p.stock <= 0 THEN 0
        WHEN NEW.quantity >= p.stock THEN p.cost -- selling all or more than available
        ELSE CAST(ROUND(CAST(p.cost AS REAL) * NEW.quantity / p.stock) AS INTEGER)
      END
    FROM inventories p
    WHERE p.id = NEW.inventory_id
  )
  WHERE sale_id = NEW.sale_id AND line_number = NEW.line_number;
END; -- EOS

CREATE TRIGGER sale_lines_prevent_update_trigger
BEFORE UPDATE ON sale_lines FOR EACH ROW WHEN OLD.cost = NEW.cost AND (
  OLD.sale_id != NEW.sale_id OR
  OLD.line_number != NEW.line_number OR
  OLD.inventory_id != NEW.inventory_id OR
  OLD.quantity != NEW.quantity OR
  OLD.price != NEW.price
)
BEGIN
   SELECT RAISE(ABORT, 'Sale lines can only be added or removed, not updated');
END; -- EOS

CREATE TRIGGER sale_lines_prevent_delete_posted_trigger
BEFORE DELETE ON sale_lines FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN (SELECT post_time FROM sales WHERE id = OLD.sale_id) IS NOT NULL THEN
      RAISE(ABORT, 'Cannot delete sale line for posted sale')
  END;
END; -- EOS

CREATE TRIGGER sales_post_trigger
AFTER UPDATE OF post_time ON sales FOR EACH ROW
WHEN OLD.post_time IS NULL AND NEW.post_time IS NOT NULL
BEGIN
  -- Update Sales Totals
  UPDATE sales
  SET 
    gross_amount = (SELECT COALESCE(SUM(price), 0) FROM sale_lines WHERE sale_id = NEW.id),
    discount_amount = (SELECT COALESCE(SUM(amount), 0) FROM sale_discounts WHERE sale_id = NEW.id),
    fee_amount = (SELECT COALESCE(SUM(payment_fee), 0) FROM sale_payments WHERE sale_id = NEW.id),
    invoice_amount = (SELECT COALESCE(SUM(price), 0) FROM sale_lines WHERE sale_id = NEW.id) - (SELECT COALESCE(SUM(amount), 0) FROM sale_discounts WHERE sale_id = NEW.id)
  WHERE id = NEW.id;

  -- Draft Journal Entry
  INSERT INTO journal_entries (entry_time, note, source_type, source_reference, created_by)
  VALUES (
    NEW.sale_time,
    'Sale #' || NEW.id,
    'System',
    'Sale #' || NEW.id,
    'System'
  );

  -- 1. Debit Cash/Bank (Payment Methods)
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description)
  SELECT
    last_insert_rowid(),
    pm.account_code,
    sp.amount - sp.payment_fee,
    0,
    'Sale Payment'
  FROM sale_payments sp
  JOIN payment_methods pm ON pm.id = sp.payment_method_id
  WHERE sp.sale_id = NEW.id AND (sp.amount - sp.payment_fee) > 0;

  -- 2. Debit Payment Fees (Expense)
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description)
  SELECT
    last_insert_rowid(),
    (SELECT account_code FROM account_tags WHERE tag = 'POS - Bank Fees' LIMIT 1),
    sp.payment_fee,
    0,
    'Payment Fee'
  FROM sale_payments sp
  WHERE sp.sale_id = NEW.id AND sp.payment_fee > 0;

  -- 3. Credit Sales Revenue
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description)
  SELECT
    last_insert_rowid(),
    (SELECT account_code FROM account_tags WHERE tag = 'POS - Sales Revenue' LIMIT 1),
    0,
    SUM(sl.price),
    'Sale Revenue'
  FROM sale_lines sl
  WHERE sl.sale_id = NEW.id
  GROUP BY sl.sale_id
  HAVING SUM(sl.price) > 0;

  -- 4. Debit Sales Discount (Contra Revenue)
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description)
  SELECT
    last_insert_rowid(),
    (SELECT account_code FROM account_tags WHERE tag = 'POS - Sales Discount' LIMIT 1),
    sd.amount,
    0,
    'Sale Discount'
  FROM sale_discounts sd
  WHERE sd.sale_id = NEW.id AND sd.amount > 0;

  -- 5. Debit COGS (Expense)
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description)
  SELECT
    last_insert_rowid(),
    (SELECT account_code FROM account_tags WHERE tag = 'POS - Cost of Goods Sold' LIMIT 1),
    sl.cost,
    0,
    'COGS'
  FROM sale_lines sl
  WHERE sl.sale_id = NEW.id AND sl.cost > 0;

  -- 6. Credit Inventory (Asset)
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description)
  SELECT
    last_insert_rowid(),
    p.account_code,
    0,
    sl.cost,
    'Inventory Reduction'
  FROM sale_lines sl
  JOIN inventories p ON p.id = sl.inventory_id
  WHERE sl.sale_id = NEW.id AND sl.cost > 0;

  -- Post the journal entry (triggers account balance updates)
  UPDATE journal_entries
  SET post_time = NEW.post_time
  WHERE ref = (
    SELECT ref FROM journal_entries
    WHERE source_reference = 'Sale #' || NEW.id
      AND source_type = 'System'
      AND post_time IS NULL
    ORDER BY ref DESC
    LIMIT 1
  );

  -- Update Inventory Stock and Cost (after account balance updates)
  UPDATE inventories
  SET
    stock = stock - (
      SELECT SUM(quantity)
      FROM sale_lines
      WHERE sale_id = NEW.id AND inventory_id = inventories.id
    ),
    cost = cost - (
      SELECT SUM(cost)
      FROM sale_lines
      WHERE sale_id = NEW.id AND inventory_id = inventories.id
    ),
    num_of_sales = num_of_sales + (
      SELECT SUM(quantity)
      FROM sale_lines
      WHERE sale_id = NEW.id AND inventory_id = inventories.id
    )
  WHERE id IN (SELECT inventory_id FROM sale_lines WHERE sale_id = NEW.id);

END; -- EOS

CREATE TABLE sale_discounts (
  sale_id INTEGER NOT NULL REFERENCES sales (id),
  line_number INTEGER NOT NULL,
  discount_id INTEGER NOT NULL REFERENCES discounts (id), -- the user cashier will decide which discount is applied
  amount INTEGER NOT NULL, -- calculated amount based on discount specification
  PRIMARY KEY (sale_id, line_number)
) STRICT, WITHOUT ROWID; -- EOS

CREATE TRIGGER sale_discounts_validation_trigger
BEFORE INSERT ON sale_discounts FOR EACH ROW
BEGIN
  -- Validate discount applicability
  SELECT
    CASE
      WHEN (
        SELECT d.inventory_id FROM discounts d WHERE d.id = NEW.discount_id) IS NOT NULL
      AND (
        SELECT d.inventory_id FROM discounts d WHERE d.id = NEW.discount_id
      ) != (
        SELECT sl.inventory_id FROM sale_lines sl WHERE sl.sale_id = NEW.sale_id AND sl.line_number = NEW.line_number
      )
      THEN RAISE(ABORT, 'Discount is not applicable to this inventory')
    END;

  -- Ensure unique inventory discount per sale
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1 
        FROM sale_discounts sd
        JOIN discounts d ON d.id = sd.discount_id
        WHERE sd.sale_id = NEW.sale_id
          AND d.inventory_id IS NOT NULL
          AND d.inventory_id = (SELECT inventory_id FROM discounts WHERE id = NEW.discount_id)
      )
      THEN RAISE(ABORT, 'Cannot apply multiple discounts for the same inventory in one sale')
    END;
END; -- EOS

CREATE TABLE sale_payments (
  sale_id INTEGER NOT NULL REFERENCES sales (id),
  line_number INTEGER NOT NULL,
  payment_method_id INTEGER NOT NULL REFERENCES payment_methods (id),
  amount INTEGER NOT NULL, -- sum of sale_payments.amount must be equal to sales.invoice_amount
  payment_fee INTEGER NOT NULL DEFAULT 0, -- calculated based on payment method fee specification on its sale_payments.amount
  PRIMARY KEY (sale_id, line_number)
) STRICT, WITHOUT ROWID; -- EOS

-- The stock taking action is direct and instant action of audit. No draft state.
CREATE TABLE stock_takings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inventory_id INTEGER NOT NULL REFERENCES inventories (id),
  audit_time INTEGER NOT NULL,
  expected_stock INTEGER NOT NULL, -- the stock recorded in the system at the time of audit
  actual_stock INTEGER NOT NULL, -- the stock physically counted
  expected_cost INTEGER NOT NULL, -- the cost recorded in the system at the time of audit
  actual_cost INTEGER NOT NULL -- the cost calculated based on actual_stock and inventory cost per unit
) STRICT; -- EOS

CREATE TRIGGER stock_takings_insert_trigger
AFTER INSERT ON stock_takings FOR EACH ROW
WHEN NEW.actual_cost != NEW.expected_cost
BEGIN
  -- Create Journal Entry for Adjustment (without post_time initially)
  INSERT INTO journal_entries (entry_time, note, source_type, source_reference, created_by)
  VALUES (
    NEW.audit_time,
    'Stock Taking Adjustment #' || NEW.id,
    'System',
    'Stock Taking #' || NEW.id,
    'System'
  );

  -- If Cost Increased (Gain)
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description)
  SELECT
    last_insert_rowid(),
    p.account_code,
    NEW.actual_cost - NEW.expected_cost,
    0,
    'Inventory Gain'
  FROM inventories p
  WHERE p.id = NEW.inventory_id AND NEW.actual_cost > NEW.expected_cost;

  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description)
  SELECT
    last_insert_rowid(),
    (SELECT account_code FROM account_tags WHERE tag = 'POS - Inventory Gain' LIMIT 1),
    0,
    NEW.actual_cost - NEW.expected_cost,
    'Inventory Gain'
  WHERE NEW.actual_cost > NEW.expected_cost;

  -- If Cost Decreased (Loss)
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description)
  SELECT
    last_insert_rowid(),
    (SELECT account_code FROM account_tags WHERE tag = 'POS - Inventory Shrinkage' LIMIT 1),
    NEW.expected_cost - NEW.actual_cost,
    0,
    'Inventory Shrinkage'
  WHERE NEW.actual_cost < NEW.expected_cost;

  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description)
  SELECT
    last_insert_rowid(),
    p.account_code,
    0,
    NEW.expected_cost - NEW.actual_cost,
    'Inventory Shrinkage'
  FROM inventories p
  WHERE p.id = NEW.inventory_id AND NEW.actual_cost < NEW.expected_cost;

  -- Post the journal entry (triggers account balance updates)
  UPDATE journal_entries
  SET post_time = NEW.audit_time
  WHERE ref = (
    SELECT ref FROM journal_entries
    WHERE source_reference = 'Stock Taking #' || NEW.id
      AND source_type = 'System'
      AND post_time IS NULL
    ORDER BY ref DESC
    LIMIT 1
  );

  -- Update Inventory Stock, Cost, and Latest Stock Taking Time (after journal entry is posted)
  UPDATE inventories
  SET 
    stock = NEW.actual_stock,
    cost = NEW.actual_cost,
    latest_stock_taking_time = NEW.audit_time
  WHERE id = NEW.inventory_id;

END; -- EOS

-- Separate trigger to update inventory when there's no cost change (no journal entry needed)
CREATE TRIGGER stock_takings_insert_no_change_trigger
AFTER INSERT ON stock_takings FOR EACH ROW
WHEN NEW.actual_cost = NEW.expected_cost
BEGIN
  UPDATE inventories
  SET 
    stock = NEW.actual_stock,
    cost = NEW.actual_cost,
    latest_stock_taking_time = NEW.audit_time
  WHERE id = NEW.inventory_id;
END; -- EOS

-- Prevent fiscal year closing if there is negative stock to ensure Matching Principle compliance
-- All POS transactions must be posted before fiscal year closing
CREATE TRIGGER pos_fiscal_year_closing_validation_trigger
BEFORE UPDATE OF post_time ON fiscal_years FOR EACH ROW
WHEN OLD.post_time IS NULL AND NEW.post_time IS NOT NULL
BEGIN
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM inventories WHERE stock < 0) THEN
        RAISE(ABORT, 'Cannot close fiscal year: One or more inventories have negative stock. Please resolve negative inventory to ensure accurate Cost of Goods Sold (Matching Principle).')
    END;
END; -- EOS

-- Prevent manual journal entries to POS Inventory accounts to ensure Inventory Valuation integrity.
-- If an accountant tries to fix a any issue by manually journaling Dr Inventory, the system will allow the Journal Entry (as long as it balances),
-- but it will likely lock the POS, preventing future inventory updates because the constraint SUM(cost) == Balance will fail.
-- Future consideration: The application should implement specific mechanisms for accountants to post to these accounts with specific use cases (like sale and purchase does) to ensure the inventory costs are updated accordingly.
CREATE TRIGGER journal_entry_lines_prevent_manual_pos_inventory_trigger
BEFORE INSERT ON journal_entry_lines FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM journal_entries je
      WHERE je.ref = NEW.journal_entry_ref
        AND je.source_type = 'Manual'
    ) AND EXISTS (
      SELECT 1
      FROM account_tags at
      WHERE at.account_code = NEW.account_code
        AND at.tag = 'POS - Inventory'
    ) AND EXISTS (
      SELECT 1
      FROM inventories p
      WHERE p.account_code = NEW.account_code
    ) THEN
      RAISE(ABORT, 'Manual journal entries are not allowed for accounts tagged as "POS - Inventory" and linked to inventories to maintain inventory valuation integrity.')
  END;
END; -- EOS

UPDATE config SET value = '002-pos' WHERE key = 'Schema Version'; -- EOS
