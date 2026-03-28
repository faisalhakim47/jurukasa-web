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
-- - inventories.unit_price is the current Standard/Base Selling Price per unit, used for display and as the default price suggestion in POS.
-- - When a table includes both quantity and price columns (e.g., purchase_lines, sale_lines), the price always represents total contractual transaction price for the quantity, not unit price.
-- - On the Database Normalization Theory, to store unit price in transaction lines is bullshit (the golden example is when the buyer and seller are CONTRACTUALLY AGREED to sell 3 eggs for 10k IDR. It is impossible to use unit price, we REQUIRE to store total price as truth factual information that happen). Always use total price as source of truth for transactions.
-- - The business requires allowing negative stock to handle backorder situations. We have decided to implement Zero-Cost Sales + Catch-up Purchases solution for negative stock handling.
-- 
-- Migration Features:
-- - ACID transaction boundary
-- - Performance-optimized indexes
-- - Each top-level statement is followed by end-of-statement (EOS) marker
-- =================================================================

CREATE TABLE internal_control_flags (
  key TEXT PRIMARY KEY CHECK (key IN ('inventory_mutation_guard')),
  value INTEGER NOT NULL CHECK (value >= 0)
) STRICT, WITHOUT ROWID; -- EOS

INSERT INTO internal_control_flags (key, value) VALUES ('inventory_mutation_guard', 0); -- EOS

CREATE TABLE inventories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  unit_price INTEGER NOT NULL, -- current standard/base selling price per unit (for display and POS default price suggestion)
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

CREATE TRIGGER inventories_system_managed_fields_update_prevention_trigger
BEFORE UPDATE OF account_code, cost, stock, latest_stock_taking_time ON inventories FOR EACH ROW
WHEN (SELECT value FROM internal_control_flags WHERE key = 'inventory_mutation_guard') = 0
BEGIN
  SELECT RAISE(ABORT, 'Cannot manually update inventories.account_code, cost, stock, or latest_stock_taking_time; use purchase, sale, or stock taking workflows');
END; -- EOS

CREATE TABLE inventory_barcodes (
  code TEXT PRIMARY KEY,
  inventory_id INTEGER NOT NULL REFERENCES inventories (id)
) STRICT, WITHOUT ROWID; -- EOS

CREATE TABLE documents (
  collect_time INTEGER PRIMARY KEY
) STRICT; -- EOS

CREATE TABLE captures (
  capture_time INTEGER NOT NULL PRIMARY KEY,
  collect_time INTEGER NOT NULL REFERENCES documents (collect_time),
  image BLOB NOT NULL
) STRICT; -- EOS

CREATE TABLE capture_dimensions (
  capture_time INTEGER NOT NULL PRIMARY KEY REFERENCES captures (capture_time),
  tl_x INTEGER NOT NULL CHECK (tl_x >= 0),
  tl_y INTEGER NOT NULL CHECK (tl_y >= 0),
  tr_x INTEGER NOT NULL CHECK (tr_x >= 0),
  tr_y INTEGER NOT NULL CHECK (tr_y >= 0),
  br_x INTEGER NOT NULL CHECK (br_x >= 0),
  br_y INTEGER NOT NULL CHECK (br_y >= 0),
  bl_x INTEGER NOT NULL CHECK (bl_x >= 0),
  bl_y INTEGER NOT NULL CHECK (bl_y >= 0),
  orientation INTEGER NOT NULL CHECK (orientation IN (0, 90, 180, 270))
) STRICT; -- EOS

CREATE TABLE capture_enhancements (
  capture_time INTEGER NOT NULL PRIMARY KEY REFERENCES captures (capture_time),
  enhanced_image BLOB NOT NULL
) STRICT; -- EOS

CREATE TABLE capture_recognitions (
  capture_time INTEGER NOT NULL PRIMARY KEY REFERENCES captures (capture_time),
  content TEXT NOT NULL
) STRICT; -- EOS

CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  phone_number TEXT
) STRICT; -- EOS

-- This is alias inventories for specific suppliers
CREATE TABLE supplier_inventories (
  record_time INTEGER PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers (id),
  inventory_id INTEGER NOT NULL REFERENCES inventories (id),
  name TEXT
) STRICT, WITHOUT ROWID; -- EOS

CREATE TABLE purchases (
  id INTEGER PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers (id),
  purchase_time INTEGER NOT NULL,
  collection_collect_time INTEGER REFERENCES documents (collect_time),
  journal_entry_ref INTEGER REFERENCES journal_entries (ref),
  post_time INTEGER
) STRICT; -- EOS

ALTER TABLE journal_entries ADD COLUMN purchase_id INTEGER REFERENCES purchases (id); -- EOS
CREATE UNIQUE INDEX journal_entries_purchase_id_index ON journal_entries (purchase_id) WHERE purchase_id IS NOT NULL; -- EOS

CREATE TRIGGER purchases_post_validation_trigger
BEFORE UPDATE OF post_time ON purchases FOR EACH ROW
WHEN OLD.post_time IS NULL AND NEW.post_time IS NOT NULL
BEGIN
  SELECT
    CASE
      WHEN NEW.journal_entry_ref IS NULL THEN RAISE(ABORT, 'Cannot post purchase without journal_entry_ref')
      WHEN EXISTS (
        SELECT 1
        FROM purchase_lines pl
        JOIN inventories p ON p.id = pl.inventory_id
        WHERE pl.purchase_id = NEW.id
          AND p.stock < 0
        GROUP BY p.id, p.stock
        HAVING SUM(pl.quantity) > 0
      ) AND NOT EXISTS (
        SELECT 1 FROM account_tags WHERE tag = 'POS - Cost of Goods Sold'
      ) THEN RAISE(ABORT, 'Account with tag "POS - Cost of Goods Sold" not found for purchase posting')
    END;
END; -- EOS

CREATE TRIGGER purchases_post_trigger
AFTER UPDATE OF post_time ON purchases FOR EACH ROW
WHEN OLD.post_time IS NULL AND NEW.post_time IS NOT NULL
BEGIN
  -- Draft Journal Entry using app-provided ref
  INSERT INTO journal_entries (ref, entry_time, purchase_id)
  VALUES (
    NEW.journal_entry_ref,
    NEW.purchase_time,
    NEW.id
  );

  -- Debit Inventory (Inventory Accounts)
  -- Amount = Purchase Price - Catchup COGS
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, note)
  SELECT
    NEW.journal_entry_ref,
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
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, note)
  SELECT
    NEW.journal_entry_ref,
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
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, note)
  SELECT
    NEW.journal_entry_ref,
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
  WHERE ref = NEW.journal_entry_ref;

  -- Update inventory stock and cost (after account balance updates)
  UPDATE internal_control_flags
  SET value = value + 1
  WHERE key = 'inventory_mutation_guard';

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

  UPDATE internal_control_flags
  SET value = value - 1
  WHERE key = 'inventory_mutation_guard';

END; -- EOS

CREATE TRIGGER purchases_post_time_immutability_trigger
BEFORE UPDATE OF post_time ON purchases FOR EACH ROW
WHEN OLD.post_time IS NOT NULL AND (NEW.post_time IS NULL OR NEW.post_time != OLD.post_time)
BEGIN
  SELECT RAISE(ABORT, 'Cannot unpost or change post_time of a posted purchase');
END; -- EOS

CREATE TRIGGER purchases_posted_accounting_fields_immutability_trigger
BEFORE UPDATE OF purchase_time, journal_entry_ref ON purchases FOR EACH ROW
WHEN OLD.post_time IS NOT NULL AND (
  NEW.purchase_time != OLD.purchase_time OR
  COALESCE(NEW.journal_entry_ref, -1) != COALESCE(OLD.journal_entry_ref, -1)
)
BEGIN
  SELECT RAISE(ABORT, 'Cannot modify purchase_time or journal_entry_ref of a posted purchase');
END; -- EOS

-- We differentciate between supplier_quantity and quantity to handle cases where
-- the supplier uses different unit of measurement or packaging than our internal SKU system
CREATE TABLE purchase_lines (
  purchase_id INTEGER NOT NULL REFERENCES purchases (id),
  line_number INTEGER NOT NULL,
  inventory_id INTEGER NOT NULL REFERENCES inventories (id),
  supplier_inventory_name TEXT NOT NULL, -- the name of the inventory as mentioned in supplier purchase order receipt
  supplier_quantity INTEGER NOT NULL, -- quantity as mentioned in supplier purchase order receipt
  supplier_unit_of_measurement TEXT NOT NULL,
  quantity INTEGER NOT NULL, -- quantity for our SKU system
  price INTEGER NOT NULL,
  CHECK (supplier_quantity > 0),
  CHECK (quantity > 0),
  CHECK (price >= 0),
  PRIMARY KEY (purchase_id, line_number)
) STRICT, WITHOUT ROWID; -- EOS

CREATE TRIGGER purchase_lines_posted_purchase_insert_prevention_trigger
BEFORE INSERT ON purchase_lines FOR EACH ROW
WHEN (SELECT post_time FROM purchases WHERE id = NEW.purchase_id) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Cannot add lines to posted purchase');
END; -- EOS

CREATE TRIGGER purchase_lines_posted_purchase_update_prevention_trigger
BEFORE UPDATE ON purchase_lines FOR EACH ROW
WHEN (SELECT post_time FROM purchases WHERE id = OLD.purchase_id) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Cannot modify lines of posted purchase');
END; -- EOS

CREATE TRIGGER purchase_lines_posted_purchase_delete_prevention_trigger
BEFORE DELETE ON purchase_lines FOR EACH ROW
WHEN (SELECT post_time FROM purchases WHERE id = OLD.purchase_id) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Cannot delete lines of posted purchase');
END; -- EOS

-- Our discount system use case is very simple.
-- Each quantity of multiple_of_quantity entitles the buyer to a multiple of amount discount.
-- For example, "Each purchase of 3 pieces get 500 IDR off" would be represented as multiple_of_quantity = 3 and amount = 500. When a buyer purchases 7 pieces, they would get (7 // 3) * 500 = 1000 IDR off.
CREATE TABLE discounts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  inventory_id INTEGER REFERENCES inventories (id),
  multiple_of_quantity INTEGER NOT NULL CHECK (multiple_of_quantity > 0),
  amount INTEGER NOT NULL CHECK (amount >= 0)
) STRICT; -- EOS

CREATE TABLE payment_methods (
  id INTEGER PRIMARY KEY,
  account_code INTEGER NOT NULL REFERENCES accounts (account_code),
  name TEXT NOT NULL,
  min_fee INTEGER NOT NULL DEFAULT 0,
  max_fee INTEGER NOT NULL DEFAULT 0,
  rel_fee INTEGER NOT NULL DEFAULT 0 CHECK (rel_fee >= 0 AND rel_fee <= 1000000) -- percentage fee (0 - 1000000); The lowest possible is 0.0001% the highest possible is 100%
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
  id INTEGER PRIMARY KEY,
  customer_name TEXT,
  sale_time INTEGER NOT NULL,
  journal_entry_ref INTEGER REFERENCES journal_entries (ref),
  post_time INTEGER,
  gross_amount INTEGER, -- calculated upon posting
  discount_amount INTEGER, -- calculated upon posting
  fee_amount INTEGER, -- calculated upon posting
  invoice_amount INTEGER -- calculated upon posting, the invoice_amount must be equal to gross_amount - discount_amount
) STRICT; -- EOS

ALTER TABLE journal_entries ADD COLUMN sale_id INTEGER REFERENCES sales (id); -- EOS
CREATE UNIQUE INDEX journal_entries_sale_id_index ON journal_entries (sale_id) WHERE sale_id IS NOT NULL; -- EOS

CREATE TRIGGER sales_post_time_immutability_trigger
BEFORE UPDATE OF post_time ON sales FOR EACH ROW
WHEN OLD.post_time IS NOT NULL AND (NEW.post_time IS NULL OR NEW.post_time != OLD.post_time)
BEGIN
  SELECT RAISE(ABORT, 'Cannot unpost or change post_time of a posted sale');
END; -- EOS

CREATE TRIGGER sales_posted_accounting_fields_immutability_trigger
BEFORE UPDATE OF sale_time, journal_entry_ref ON sales FOR EACH ROW
WHEN OLD.post_time IS NOT NULL AND (
  NEW.sale_time != OLD.sale_time OR
  COALESCE(NEW.journal_entry_ref, -1) != COALESCE(OLD.journal_entry_ref, -1)
)
BEGIN
  SELECT RAISE(ABORT, 'Cannot modify sale_time or journal_entry_ref of a posted sale');
END; -- EOS

CREATE TRIGGER sales_post_validation_trigger
BEFORE UPDATE OF post_time ON sales FOR EACH ROW
WHEN OLD.post_time IS NULL AND NEW.post_time IS NOT NULL
BEGIN
  SELECT
    CASE
      WHEN NEW.journal_entry_ref IS NULL THEN RAISE(ABORT, 'Cannot post sale without journal_entry_ref')
      WHEN NOT EXISTS (
        SELECT 1 FROM account_tags WHERE tag = 'POS - Sales Revenue'
      ) THEN RAISE(ABORT, 'Account with tag "POS - Sales Revenue" not found for sale posting')
      WHEN EXISTS (
        SELECT 1 FROM sale_discounts WHERE sale_id = NEW.id AND amount > 0
      ) AND NOT EXISTS (
        SELECT 1 FROM account_tags WHERE tag = 'POS - Sales Discount'
      ) THEN RAISE(ABORT, 'Account with tag "POS - Sales Discount" not found for sale posting')
      WHEN EXISTS (
        SELECT 1 FROM sale_lines WHERE sale_id = NEW.id AND cost > 0
      ) AND NOT EXISTS (
        SELECT 1 FROM account_tags WHERE tag = 'POS - Cost of Goods Sold'
      ) THEN RAISE(ABORT, 'Account with tag "POS - Cost of Goods Sold" not found for sale posting')
      WHEN EXISTS (
        SELECT 1 FROM sale_payments WHERE sale_id = NEW.id AND payment_fee > 0
      ) AND NOT EXISTS (
        SELECT 1 FROM account_tags WHERE tag = 'POS - Bank Fees'
      ) THEN RAISE(ABORT, 'Account with tag "POS - Bank Fees" not found for sale posting')
      WHEN (
        SELECT COALESCE(SUM(price), 0) FROM sale_lines WHERE sale_id = NEW.id
      ) - (
        SELECT COALESCE(SUM(amount), 0) FROM sale_discounts WHERE sale_id = NEW.id
      ) < 0 THEN RAISE(ABORT, 'Cannot post sale: discount amount exceeds gross amount')
      WHEN (
        SELECT COALESCE(SUM(amount), 0) FROM sale_payments WHERE sale_id = NEW.id
      ) != (
        SELECT COALESCE(SUM(price), 0) FROM sale_lines WHERE sale_id = NEW.id
      ) - (
        SELECT COALESCE(SUM(amount), 0) FROM sale_discounts WHERE sale_id = NEW.id
      ) THEN RAISE(ABORT, 'Cannot post sale: payment total must equal invoice amount')
    END;
END; -- EOS

CREATE TABLE sale_lines (
  sale_id INTEGER NOT NULL REFERENCES sales (id),
  line_number INTEGER NOT NULL,
  inventory_id INTEGER NOT NULL REFERENCES inventories (id),
  quantity INTEGER NOT NULL,
  price INTEGER NOT NULL,
  cost INTEGER NOT NULL, -- the cost of goods sold for its line quantity (We are using simple average cost method, the small lost of precision is acceptable for POS system). The cost data will be calculated automatically upon insertion.
  CHECK (quantity > 0),
  CHECK (price >= 0),
  PRIMARY KEY (sale_id, line_number),
  UNIQUE (sale_id, inventory_id) -- prevent duplicate inventory lines; COGS is computed per-line at insert-time using the current stock snapshot, so two lines for the same inventory would double-count cost
) STRICT, WITHOUT ROWID; -- EOS

CREATE TRIGGER sale_lines_posted_sale_insert_prevention_trigger
BEFORE INSERT ON sale_lines FOR EACH ROW
WHEN (SELECT post_time FROM sales WHERE id = NEW.sale_id) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Cannot add sale line for posted sale');
END; -- EOS

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

-- Prevent any manual updates to sale lines.
-- The only allowed mutation is the automatic cost calculation by sale_lines_insert_cost_trigger
-- (AFTER INSERT), which changes only the cost column on an unposted sale.
-- Allow only the insert-time cost initialization shape; reject all other updates.
CREATE TRIGGER sale_lines_prevent_update_trigger
BEFORE UPDATE ON sale_lines FOR EACH ROW WHEN
  NOT (
    OLD.sale_id = NEW.sale_id AND
    OLD.line_number = NEW.line_number AND
    OLD.inventory_id = NEW.inventory_id AND
    OLD.quantity = NEW.quantity AND
    OLD.price = NEW.price AND
    (SELECT post_time FROM sales WHERE id = OLD.sale_id) IS NULL AND
    OLD.cost = 0 AND
    NEW.cost = (
      SELECT
        CASE
          WHEN p.stock <= 0 THEN 0
          WHEN OLD.quantity >= p.stock THEN p.cost
          ELSE CAST(ROUND(CAST(p.cost AS REAL) * OLD.quantity / p.stock) AS INTEGER)
        END
      FROM inventories p
      WHERE p.id = OLD.inventory_id
    )
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

  -- Draft Journal Entry using app-provided ref
  INSERT INTO journal_entries (ref, entry_time, sale_id)
  VALUES (
    NEW.journal_entry_ref,
    NEW.sale_time,
    NEW.id
  );

  -- 1. Debit Cash/Bank (Payment Methods)
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
  SELECT
    NEW.journal_entry_ref,
    pm.account_code,
    sp.amount - sp.payment_fee,
    0,
    'Sale Payment',
    CASE WHEN EXISTS(SELECT 1 FROM account_tags WHERE account_code = pm.account_code AND tag = 'Cash Flow - Cash Equivalents') THEN 1 ELSE NULL END,
    CASE WHEN EXISTS(SELECT 1 FROM account_tags WHERE account_code = pm.account_code AND tag = 'Cash Flow - Cash Equivalents') THEN 1 ELSE NULL END
  FROM sale_payments sp
  JOIN payment_methods pm ON pm.id = sp.payment_method_id
  WHERE sp.sale_id = NEW.id AND (sp.amount - sp.payment_fee) > 0;

  -- 2. Debit Payment Fees (Expense)
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, note)
  SELECT
    NEW.journal_entry_ref,
    (SELECT account_code FROM account_tags WHERE tag = 'POS - Bank Fees' LIMIT 1),
    sp.payment_fee,
    0,
    'Payment Fee'
  FROM sale_payments sp
  WHERE sp.sale_id = NEW.id AND sp.payment_fee > 0;

  -- 3. Credit Sales Revenue
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, note)
  SELECT
    NEW.journal_entry_ref,
    (SELECT account_code FROM account_tags WHERE tag = 'POS - Sales Revenue' LIMIT 1),
    0,
    SUM(sl.price),
    'Sale Revenue'
  FROM sale_lines sl
  WHERE sl.sale_id = NEW.id
  GROUP BY sl.sale_id
  HAVING SUM(sl.price) > 0;

  -- 4. Debit Sales Discount (Contra Revenue)
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, note)
  SELECT
    NEW.journal_entry_ref,
    (SELECT account_code FROM account_tags WHERE tag = 'POS - Sales Discount' LIMIT 1),
    sd.amount,
    0,
    'Sale Discount'
  FROM sale_discounts sd
  WHERE sd.sale_id = NEW.id AND sd.amount > 0;

  -- 5. Debit COGS (Expense)
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, note)
  SELECT
    NEW.journal_entry_ref,
    (SELECT account_code FROM account_tags WHERE tag = 'POS - Cost of Goods Sold' LIMIT 1),
    sl.cost,
    0,
    'COGS'
  FROM sale_lines sl
  WHERE sl.sale_id = NEW.id AND sl.cost > 0;

  -- 6. Credit Inventory (Asset)
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, note)
  SELECT
    NEW.journal_entry_ref,
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
  WHERE ref = NEW.journal_entry_ref;

  -- Update Inventory Stock and Cost (after account balance updates)
  UPDATE internal_control_flags
  SET value = value + 1
  WHERE key = 'inventory_mutation_guard';

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

  UPDATE internal_control_flags
  SET value = value - 1
  WHERE key = 'inventory_mutation_guard';

END; -- EOS

CREATE TABLE sale_discounts (
  sale_id INTEGER NOT NULL REFERENCES sales (id),
  line_number INTEGER NOT NULL,
  discount_id INTEGER NOT NULL REFERENCES discounts (id), -- the user cashier will decide which discount is applied
  amount INTEGER NOT NULL CHECK (amount >= 0), -- calculated amount based on discount specification
  PRIMARY KEY (sale_id, line_number)
) STRICT, WITHOUT ROWID; -- EOS

CREATE TRIGGER sale_discounts_validation_trigger
BEFORE INSERT ON sale_discounts FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN (SELECT post_time FROM sales WHERE id = NEW.sale_id) IS NOT NULL
      THEN RAISE(ABORT, 'Cannot add discount to posted sale')
    END;

  -- Validate discount applicability: inventory-specific discounts require a matching sale line
  SELECT
    CASE
      WHEN (
        SELECT d.inventory_id FROM discounts d WHERE d.id = NEW.discount_id
      ) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM sale_lines sl
        WHERE sl.sale_id = NEW.sale_id
          AND sl.inventory_id = (SELECT d.inventory_id FROM discounts d WHERE d.id = NEW.discount_id)
      )
      THEN RAISE(ABORT, 'Discount is not applicable to this sale: no matching inventory found')
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

CREATE TRIGGER sale_discounts_posted_sale_update_prevention_trigger
BEFORE UPDATE ON sale_discounts FOR EACH ROW
WHEN (SELECT post_time FROM sales WHERE id = OLD.sale_id) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Cannot modify discount of posted sale');
END; -- EOS

CREATE TRIGGER sale_discounts_posted_sale_delete_prevention_trigger
BEFORE DELETE ON sale_discounts FOR EACH ROW
WHEN (SELECT post_time FROM sales WHERE id = OLD.sale_id) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Cannot delete discount of posted sale');
END; -- EOS

CREATE TABLE sale_payments (
  sale_id INTEGER NOT NULL REFERENCES sales (id),
  line_number INTEGER NOT NULL,
  payment_method_id INTEGER NOT NULL REFERENCES payment_methods (id),
  amount INTEGER NOT NULL CHECK (amount >= 0), -- sum of sale_payments.amount must be equal to sales.invoice_amount
  payment_fee INTEGER NOT NULL DEFAULT 0 CHECK (payment_fee >= 0 AND payment_fee <= amount), -- calculated based on payment method fee specification on its sale_payments.amount
  PRIMARY KEY (sale_id, line_number)
) STRICT, WITHOUT ROWID; -- EOS

CREATE TRIGGER sale_payments_posted_sale_insert_prevention_trigger
BEFORE INSERT ON sale_payments FOR EACH ROW
WHEN (SELECT post_time FROM sales WHERE id = NEW.sale_id) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Cannot add payment to posted sale');
END; -- EOS

CREATE TRIGGER sale_payments_posted_sale_update_prevention_trigger
BEFORE UPDATE ON sale_payments FOR EACH ROW
WHEN (SELECT post_time FROM sales WHERE id = OLD.sale_id) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Cannot modify payment of posted sale');
END; -- EOS

CREATE TRIGGER sale_payments_posted_sale_delete_prevention_trigger
BEFORE DELETE ON sale_payments FOR EACH ROW
WHEN (SELECT post_time FROM sales WHERE id = OLD.sale_id) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Cannot delete payment of posted sale');
END; -- EOS

-- The stock taking action is direct and instant action of audit. No draft state.
CREATE TABLE stock_takings (
  id INTEGER PRIMARY KEY,
  inventory_id INTEGER NOT NULL REFERENCES inventories (id),
  audit_time INTEGER NOT NULL,
  expected_stock INTEGER NOT NULL, -- the stock recorded in the system at the time of audit
  actual_stock INTEGER NOT NULL, -- the stock physically counted
  expected_cost INTEGER NOT NULL, -- the cost recorded in the system at the time of audit
  actual_cost INTEGER NOT NULL, -- the cost calculated based on actual_stock and inventory cost per unit
  journal_entry_ref INTEGER REFERENCES journal_entries (ref)
) STRICT; -- EOS

ALTER TABLE journal_entries ADD COLUMN stock_taking_id INTEGER REFERENCES stock_takings (id); -- EOS
CREATE UNIQUE INDEX journal_entries_stock_taking_id_index ON journal_entries (stock_taking_id) WHERE stock_taking_id IS NOT NULL; -- EOS

CREATE TRIGGER stock_takings_insert_validation_trigger
BEFORE INSERT ON stock_takings FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN NEW.audit_time <= 0 THEN RAISE(ABORT, 'Stock taking audit_time must be positive')
      WHEN EXISTS (
        SELECT 1 FROM fiscal_years
        WHERE post_time IS NOT NULL
          AND reversal_time IS NULL
          AND NEW.audit_time > begin_time
          AND NEW.audit_time <= end_time
      ) THEN RAISE(ABORT, 'Cannot record stock taking in a closed fiscal year')
      WHEN NEW.expected_stock != (
        SELECT stock FROM inventories WHERE id = NEW.inventory_id
      ) THEN RAISE(ABORT, 'Stock taking expected_stock must match current inventory stock')
      WHEN NEW.expected_cost != (
        SELECT cost FROM inventories WHERE id = NEW.inventory_id
      ) THEN RAISE(ABORT, 'Stock taking expected_cost must match current inventory cost')
      WHEN NEW.actual_cost != NEW.expected_cost
        AND NEW.journal_entry_ref IS NULL THEN RAISE(ABORT, 'Stock taking journal_entry_ref is required when cost adjustment exists')
      WHEN NEW.actual_cost > NEW.expected_cost
        AND NOT EXISTS (
          SELECT 1 FROM account_tags WHERE tag = 'POS - Inventory Gain'
        ) THEN RAISE(ABORT, 'Account with tag "POS - Inventory Gain" not found for stock taking adjustment')
      WHEN NEW.actual_cost < NEW.expected_cost
        AND NOT EXISTS (
          SELECT 1 FROM account_tags WHERE tag = 'POS - Inventory Shrinkage'
        ) THEN RAISE(ABORT, 'Account with tag "POS - Inventory Shrinkage" not found for stock taking adjustment')
    END;
END; -- EOS

CREATE TRIGGER stock_takings_insert_trigger
AFTER INSERT ON stock_takings FOR EACH ROW
WHEN NEW.actual_cost != NEW.expected_cost
BEGIN
  -- Create Journal Entry for Adjustment using app-provided ref
  INSERT INTO journal_entries (ref, entry_time, stock_taking_id)
  VALUES (
    NEW.journal_entry_ref,
    NEW.audit_time,
    NEW.id
  );

  -- If Cost Increased (Gain)
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, note)
  SELECT
    NEW.journal_entry_ref,
    p.account_code,
    NEW.actual_cost - NEW.expected_cost,
    0,
    'Inventory Gain'
  FROM inventories p
  WHERE p.id = NEW.inventory_id AND NEW.actual_cost > NEW.expected_cost;

  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, note)
  SELECT
    NEW.journal_entry_ref,
    (SELECT account_code FROM account_tags WHERE tag = 'POS - Inventory Gain' LIMIT 1),
    0,
    NEW.actual_cost - NEW.expected_cost,
    'Inventory Gain'
  WHERE NEW.actual_cost > NEW.expected_cost;

  -- If Cost Decreased (Loss)
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, note)
  SELECT
    NEW.journal_entry_ref,
    (SELECT account_code FROM account_tags WHERE tag = 'POS - Inventory Shrinkage' LIMIT 1),
    NEW.expected_cost - NEW.actual_cost,
    0,
    'Inventory Shrinkage'
  WHERE NEW.actual_cost < NEW.expected_cost;

  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, note)
  SELECT
    NEW.journal_entry_ref,
    p.account_code,
    0,
    NEW.expected_cost - NEW.actual_cost,
    'Inventory Shrinkage'
  FROM inventories p
  WHERE p.id = NEW.inventory_id AND NEW.actual_cost < NEW.expected_cost;

  -- Post the journal entry (triggers account balance updates)
  UPDATE journal_entries
  SET post_time = NEW.audit_time
  WHERE ref = NEW.journal_entry_ref;

  -- Update Inventory Stock, Cost, and Latest Stock Taking Time (after journal entry is posted)
  UPDATE internal_control_flags
  SET value = value + 1
  WHERE key = 'inventory_mutation_guard';

  UPDATE inventories
  SET
    stock = NEW.actual_stock,
    cost = NEW.actual_cost,
    latest_stock_taking_time = NEW.audit_time
  WHERE id = NEW.inventory_id;

  UPDATE internal_control_flags
  SET value = value - 1
  WHERE key = 'inventory_mutation_guard';

END; -- EOS

-- Separate trigger to update inventory when there's no cost change (no journal entry needed)
CREATE TRIGGER stock_takings_insert_no_change_trigger
AFTER INSERT ON stock_takings FOR EACH ROW
WHEN NEW.actual_cost = NEW.expected_cost
BEGIN
  -- NULL out journal_entry_ref since no journal entry was needed
  UPDATE stock_takings
  SET journal_entry_ref = NULL
  WHERE id = NEW.id AND journal_entry_ref IS NOT NULL;

  UPDATE internal_control_flags
  SET value = value + 1
  WHERE key = 'inventory_mutation_guard';

  UPDATE inventories
  SET
    stock = NEW.actual_stock,
    cost = NEW.actual_cost,
    latest_stock_taking_time = NEW.audit_time
  WHERE id = NEW.inventory_id;

  UPDATE internal_control_flags
  SET value = value - 1
  WHERE key = 'inventory_mutation_guard';
END; -- EOS

CREATE TRIGGER stock_takings_update_prevention_trigger
BEFORE UPDATE ON stock_takings FOR EACH ROW
WHEN NOT (
  OLD.inventory_id = NEW.inventory_id
  AND OLD.audit_time = NEW.audit_time
  AND OLD.expected_stock = NEW.expected_stock
  AND OLD.actual_stock = NEW.actual_stock
  AND OLD.expected_cost = NEW.expected_cost
  AND OLD.actual_cost = NEW.actual_cost
  AND OLD.journal_entry_ref IS NOT NULL
  AND NEW.journal_entry_ref IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'Stock takings are immutable once recorded');
END; -- EOS

CREATE TRIGGER stock_takings_delete_prevention_trigger
BEFORE DELETE ON stock_takings FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Stock takings cannot be deleted once recorded');
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
        AND je.purchase_id IS NULL
        AND je.sale_id IS NULL
        AND je.stock_taking_id IS NULL
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

CREATE TRIGGER journal_entry_lines_prevent_manual_pos_inventory_update_trigger
BEFORE UPDATE ON journal_entry_lines FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM journal_entries je
      WHERE je.ref = NEW.journal_entry_ref
        AND je.purchase_id IS NULL
        AND je.sale_id IS NULL
        AND je.stock_taking_id IS NULL
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

CREATE TRIGGER journal_entries_posted_pos_links_update_prevention_trigger
BEFORE UPDATE OF purchase_id, sale_id, stock_taking_id ON journal_entries FOR EACH ROW
WHEN OLD.post_time IS NOT NULL AND (
  OLD.purchase_id IS NOT NEW.purchase_id OR
  OLD.sale_id IS NOT NEW.sale_id OR
  OLD.stock_taking_id IS NOT NEW.stock_taking_id
)
BEGIN
  SELECT RAISE(ABORT, 'Cannot modify posted journal entry');
END; -- EOS

UPDATE config SET value = '002-pos' WHERE key = 'Schema Version'; -- EOS
