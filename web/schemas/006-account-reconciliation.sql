-- =================================================================
-- Account Reconciliation Migration Script
-- Version: 2.0
-- Date: 2026-03-12
-- SQLite Version: 3.43.0
-- Dependencies: 001-accounting.sql
--
-- Unified Reconciliation Feature:
-- - Replaces the previous complex session/items/matches/discrepancies model
-- - Unifies Bank Statement Reconciliation and Physical Cash Count into one feature
-- - User provides the external balance (statement closing balance or counted amount)
-- - System automatically records the book balance as of checkpoint_time and creates a single
--   adjustment journal entry to align the books when a discrepancy exists
--
-- Workflow:
-- 1. User creates a checkpoint with account_code, type, checkpoint_time, external_balance
-- 2. System captures the book balance as of checkpoint_time automatically
-- 3. If external_balance != book_balance, system auto-creates and posts one adjustment entry
-- 4. adjustment_journal_entry_ref is NULL when books are already balanced
--
-- Types:
-- - STATEMENT: closing balance from a bank or external statement
-- - PHYSICAL:  total amount physically counted (cash drawer, safe, etc.)
--
-- Migration Features:
-- - ACID transaction boundary
-- - Performance-optimized indexes
-- - Each top-level statement is followed by end-of-statement (EOS) marker
-- =================================================================

-- =================================================================
-- RECONCILIATION CHECKPOINTS
-- =================================================================

CREATE TABLE reconciliation_checkpoints (
  id INTEGER PRIMARY KEY,
  account_code INTEGER NOT NULL REFERENCES accounts (account_code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('STATEMENT', 'PHYSICAL')),
  checkpoint_time INTEGER NOT NULL,
  external_balance INTEGER NOT NULL,
  book_balance INTEGER NOT NULL DEFAULT 0, -- auto-set by trigger from posted journal entries as of checkpoint_time
  adjustment_journal_entry_ref INTEGER REFERENCES journal_entries (ref) ON UPDATE RESTRICT ON DELETE RESTRICT,
  -- NULL when external_balance == book_balance (no adjustment needed)
  note TEXT,
  create_time INTEGER NOT NULL
) STRICT; -- EOS

CREATE INDEX reconciliation_checkpoints_account_code_index ON reconciliation_checkpoints (account_code); -- EOS
CREATE INDEX reconciliation_checkpoints_account_time_index ON reconciliation_checkpoints (account_code, checkpoint_time); -- EOS
CREATE INDEX reconciliation_checkpoints_time_index ON reconciliation_checkpoints (checkpoint_time); -- EOS
CREATE INDEX reconciliation_checkpoints_type_index ON reconciliation_checkpoints (type); -- EOS

ALTER TABLE journal_entries ADD COLUMN reconciliation_id INTEGER REFERENCES reconciliation_checkpoints (id); -- EOS
CREATE UNIQUE INDEX journal_entries_reconciliation_id_index ON journal_entries (reconciliation_id) WHERE reconciliation_id IS NOT NULL; -- EOS
CREATE TRIGGER journal_entries_posted_reconciliation_link_update_prevention_trigger
BEFORE UPDATE OF reconciliation_id ON journal_entries FOR EACH ROW
WHEN OLD.post_time IS NOT NULL AND OLD.reconciliation_id IS NOT NEW.reconciliation_id
BEGIN
  SELECT RAISE(ABORT, 'Cannot modify posted journal entry');
END; -- EOS

-- Extend POS inventory protection trigger to also allow reconciliation journal entries.
-- (Previous trigger versions checked purchase_id, sale_id, stock_taking_id, fixed_asset_id)
-- NOTE: This trigger is redefined across multiple migrations (002-pos, 005-fixed-assets, here).
-- Any future migration that adds a new journal_entries FK column (like purchase_id, sale_id, etc.)
-- MUST DROP and recreate this trigger with ALL prior NULL checks plus the new column.
DROP TRIGGER IF EXISTS journal_entry_lines_prevent_manual_pos_inventory_trigger; -- EOS
DROP TRIGGER IF EXISTS journal_entry_lines_prevent_manual_pos_inventory_update_trigger; -- EOS

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
        AND je.fixed_asset_id IS NULL
        AND je.reconciliation_id IS NULL
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
        AND je.fixed_asset_id IS NULL
        AND je.reconciliation_id IS NULL
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

-- Validate reconciliation checkpoint before insert
CREATE TRIGGER reconciliation_checkpoints_insert_validation_trigger
BEFORE INSERT ON reconciliation_checkpoints FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN NEW.checkpoint_time <= 0 THEN RAISE(ABORT, 'Checkpoint time must be positive')

      WHEN NOT EXISTS (
        SELECT 1 FROM accounts
        WHERE account_code = NEW.account_code
          AND is_posting_account = 1
      ) THEN RAISE(ABORT, 'Reconciliation can only be performed on posting accounts')

      WHEN NEW.type = 'PHYSICAL' AND NOT EXISTS (
        SELECT 1 FROM account_tags
        WHERE account_code = NEW.account_code
          AND tag = 'Cash Flow - Cash Equivalents'
      ) THEN RAISE(ABORT, 'Physical cash count can only be performed on cash/bank accounts')

      WHEN NEW.type = 'PHYSICAL' AND NOT EXISTS (
        SELECT 1 FROM account_tags WHERE tag = 'Reconciliation - Cash Over/Short'
      ) THEN RAISE(ABORT, 'No account tagged Reconciliation - Cash Over/Short found')

      WHEN NEW.type = 'STATEMENT' AND NOT EXISTS (
        SELECT 1 FROM account_tags WHERE tag = 'Reconciliation - Adjustment'
      ) THEN RAISE(ABORT, 'No account tagged Reconciliation - Adjustment found')

      WHEN NEW.adjustment_journal_entry_ref IS NULL AND NEW.external_balance != COALESCE((
        SELECT SUM(
          CASE a.normal_balance
            WHEN 0 THEN jel.debit - jel.credit
            WHEN 1 THEN jel.credit - jel.debit
          END
        )
        FROM accounts a
        JOIN journal_entry_lines jel ON jel.account_code = a.account_code
        JOIN journal_entries je ON je.ref = jel.journal_entry_ref
        WHERE a.account_code = NEW.account_code
          AND je.post_time IS NOT NULL
          AND je.entry_time <= NEW.checkpoint_time
          AND je.post_time <= NEW.checkpoint_time
      ), 0) THEN RAISE(ABORT, 'adjustment_journal_entry_ref is required when reconciliation discrepancy exists')
    END;
END; -- EOS

-- Auto-set book_balance and create a single adjustment journal entry when needed
CREATE TRIGGER reconciliation_checkpoints_insert_trigger
AFTER INSERT ON reconciliation_checkpoints FOR EACH ROW
BEGIN
  -- Capture the factual book balance as of checkpoint_time.
  -- A transaction only affects the checkpoint if it had both happened and been posted by then.
  UPDATE reconciliation_checkpoints
  SET book_balance = COALESCE((
    SELECT SUM(
      CASE a.normal_balance
        WHEN 0 THEN jel.debit - jel.credit
        WHEN 1 THEN jel.credit - jel.debit
      END
    )
    FROM accounts a
    JOIN journal_entry_lines jel ON jel.account_code = a.account_code
    JOIN journal_entries je ON je.ref = jel.journal_entry_ref
    WHERE a.account_code = NEW.account_code
      AND je.post_time IS NOT NULL
      AND je.entry_time <= NEW.checkpoint_time
      AND je.post_time <= NEW.checkpoint_time
  ), 0)
  WHERE id = NEW.id;

  -- Create adjustment journal entry only when external balance differs from book balance
  -- Uses app-provided adjustment_journal_entry_ref
  INSERT INTO journal_entries (ref, entry_time, reconciliation_id)
  SELECT
    NEW.adjustment_journal_entry_ref,
    NEW.checkpoint_time,
    NEW.id
  FROM reconciliation_checkpoints rc
  WHERE rc.id = NEW.id
    AND NEW.external_balance != rc.book_balance;

  -- Line 1: Reconciled account
  -- Debit-normal account (normal_balance=0): overage → DR account; shortage → CR account
  -- Credit-normal account (normal_balance=1): overage → CR account; shortage → DR account
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
  SELECT
    NEW.adjustment_journal_entry_ref,
    NEW.account_code,
    CASE
      WHEN (a.normal_balance = 0 AND (NEW.external_balance - rc.book_balance) > 0)
        OR (a.normal_balance = 1 AND (NEW.external_balance - rc.book_balance) < 0)
      THEN ABS(NEW.external_balance - rc.book_balance)
      ELSE 0
    END,
    CASE
      WHEN (a.normal_balance = 0 AND (NEW.external_balance - rc.book_balance) < 0)
        OR (a.normal_balance = 1 AND (NEW.external_balance - rc.book_balance) > 0)
      THEN ABS(NEW.external_balance - rc.book_balance)
      ELSE 0
    END,
    'Reconciliation adjustment',
    CASE WHEN EXISTS(SELECT 1 FROM account_tags WHERE account_code = NEW.account_code AND tag = 'Cash Flow - Cash Equivalents') THEN 1 ELSE NULL END,
    CASE WHEN EXISTS(SELECT 1 FROM account_tags WHERE account_code = NEW.account_code AND tag = 'Cash Flow - Cash Equivalents') THEN 4 ELSE NULL END
  FROM reconciliation_checkpoints rc
  JOIN accounts a ON a.account_code = rc.account_code
  WHERE rc.id = NEW.id
    AND NEW.external_balance != rc.book_balance;

  -- Line 2: Adjustment account (mirror of line 1)
  -- PHYSICAL uses Cash Over/Short; STATEMENT uses Reconciliation Adjustment
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, note)
  SELECT
    NEW.adjustment_journal_entry_ref,
    CASE NEW.type
      WHEN 'PHYSICAL'
      THEN (SELECT account_code FROM account_tags WHERE tag = 'Reconciliation - Cash Over/Short' LIMIT 1)
      ELSE (SELECT account_code FROM account_tags WHERE tag = 'Reconciliation - Adjustment' LIMIT 1)
    END,
    CASE
      WHEN (a.normal_balance = 0 AND (NEW.external_balance - rc.book_balance) < 0)
        OR (a.normal_balance = 1 AND (NEW.external_balance - rc.book_balance) > 0)
      THEN ABS(NEW.external_balance - rc.book_balance)
      ELSE 0
    END,
    CASE
      WHEN (a.normal_balance = 0 AND (NEW.external_balance - rc.book_balance) > 0)
        OR (a.normal_balance = 1 AND (NEW.external_balance - rc.book_balance) < 0)
      THEN ABS(NEW.external_balance - rc.book_balance)
      ELSE 0
    END,
    CASE
      WHEN NEW.type = 'PHYSICAL' THEN
        CASE WHEN (NEW.external_balance - rc.book_balance) > 0 THEN 'Cash overage' ELSE 'Cash shortage' END
      ELSE
        CASE WHEN (NEW.external_balance - rc.book_balance) > 0 THEN 'Unrecorded credit' ELSE 'Unrecorded debit' END
    END
  FROM reconciliation_checkpoints rc
  JOIN accounts a ON a.account_code = rc.account_code
  WHERE rc.id = NEW.id
    AND NEW.external_balance != rc.book_balance;

  -- Post the adjustment journal entry immediately
  UPDATE journal_entries
  SET post_time = NEW.checkpoint_time
  WHERE ref = NEW.adjustment_journal_entry_ref;

  -- NULL out adjustment_journal_entry_ref if no journal entry was created (no discrepancy)
  UPDATE reconciliation_checkpoints
  SET adjustment_journal_entry_ref = NULL
  WHERE id = NEW.id
    AND NEW.adjustment_journal_entry_ref IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM journal_entries WHERE ref = NEW.adjustment_journal_entry_ref);
END; -- EOS

CREATE TRIGGER reconciliation_checkpoints_update_prevention_trigger
BEFORE UPDATE ON reconciliation_checkpoints FOR EACH ROW
WHEN NOT (
  OLD.account_code = NEW.account_code
  AND OLD.type = NEW.type
  AND OLD.checkpoint_time = NEW.checkpoint_time
  AND OLD.external_balance = NEW.external_balance
  AND OLD.book_balance = 0
  AND OLD.adjustment_journal_entry_ref IS NEW.adjustment_journal_entry_ref
  AND OLD.note IS NEW.note
  AND OLD.create_time = NEW.create_time
)
AND NOT (
  OLD.account_code = NEW.account_code
  AND OLD.type = NEW.type
  AND OLD.checkpoint_time = NEW.checkpoint_time
  AND OLD.external_balance = NEW.external_balance
  AND OLD.book_balance = NEW.book_balance
  AND OLD.adjustment_journal_entry_ref IS NOT NULL
  AND NEW.adjustment_journal_entry_ref IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries
    WHERE ref = OLD.adjustment_journal_entry_ref
  )
  AND OLD.note IS NEW.note
  AND OLD.create_time = NEW.create_time
)
BEGIN
  SELECT RAISE(ABORT, 'Reconciliation checkpoints are immutable once recorded');
END; -- EOS

CREATE TRIGGER reconciliation_checkpoints_delete_prevention_trigger
BEFORE DELETE ON reconciliation_checkpoints FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Reconciliation checkpoints cannot be deleted once recorded');
END; -- EOS

-- =================================================================
-- RECONCILIATION HISTORY VIEW
-- =================================================================

CREATE VIEW reconciliation_history AS
SELECT
  rc.id,
  rc.account_code,
  a.name AS account_name,
  rc.type,
  rc.checkpoint_time,
  rc.external_balance,
  rc.book_balance,
  (rc.external_balance - rc.book_balance) AS discrepancy,
  CASE
    -- For debit-normal accounts (normal_balance=0): external > book means overage
    -- For credit-normal accounts (normal_balance=1): external > book means shortage (more liability)
    WHEN (rc.external_balance - rc.book_balance) = 0 THEN 'balanced'
    WHEN (a.normal_balance = 0 AND (rc.external_balance - rc.book_balance) > 0)
      OR (a.normal_balance = 1 AND (rc.external_balance - rc.book_balance) < 0)
    THEN 'overage'
    ELSE 'shortage'
  END AS discrepancy_type,
  rc.adjustment_journal_entry_ref,
  rc.note,
  rc.create_time
FROM reconciliation_checkpoints rc
JOIN accounts a ON a.account_code = rc.account_code
ORDER BY rc.checkpoint_time DESC; -- EOS

UPDATE config SET value = '006-account-reconciliation' WHERE key = 'Schema Version'; -- EOS
