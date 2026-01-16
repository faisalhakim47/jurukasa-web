-- =================================================================
-- Cash Count Migration Script
-- Version: 1.0
-- Date: 2026-01-12
-- SQLite Version: 3.43.0
-- Dependencies: 001-accounting.sql, 006-account-reconciliation.sql
-- 
-- This script creates the cash count schema.
-- 
-- Purpose:
-- - Simplified cash reconciliation for non-accounting users
-- - Physical cash counting workflow with automatic discrepancy handling
-- - Integration with reconciliation system for audit trail
-- 
-- Key Concepts:
-- - Cash Count: Physical count of cash in a cash/bank account
-- - System Balance: What the accounting books show
-- - Counted Amount: What was physically counted
-- - Discrepancy: Difference between counted and system (positive = overage, negative = shortage)
-- 
-- Integration with Reconciliation:
-- - Each cash count automatically creates a reconciliation session
-- - Discrepancies recorded as adjustments to Cash Over/Short account
-- - Maintains complete audit trail through reconciliation system
-- 
-- Migration Features:
-- - ACID transaction boundary
-- - Performance-optimized indexes
-- - Each top-level statement is followed by end-of-statement (EOS) marker
-- =================================================================

-- =================================================================
-- CASH COUNT FEATURE
-- =================================================================
-- Cash Count provides a simplified reconciliation workflow for cash accounts.
-- Instead of requiring users to understand accounting journals, they simply:
-- 1. Count the physical cash
-- 2. Record the counted amount
-- 3. System automatically handles any discrepancy by creating proper entries
--
-- Integration with Reconciliation:
-- - Each cash count creates a reconciliation session automatically
-- - Discrepancies are recorded as adjustment entries to Cash Over/Short account
-- - Completed reconciliation maintains audit trail
-- =================================================================

-- Cash count records - simplified cash reconciliation for non-accounting users
-- User only provides: account_code, counted_amount, count_time
-- system_balance and discrepancy are automatically calculated by triggers
CREATE TABLE cash_counts (
  count_time INTEGER PRIMARY KEY, -- when the cash was counted (also serves as unique identifier)
  account_code INTEGER NOT NULL REFERENCES accounts (account_code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  counted_amount INTEGER NOT NULL CHECK (counted_amount >= 0), -- physical cash counted
  reconciliation_session_id INTEGER REFERENCES reconciliation_sessions (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  note TEXT,
  create_time INTEGER NOT NULL
) STRICT; -- EOS

CREATE INDEX cash_counts_account_code_index ON cash_counts (account_code); -- EOS
CREATE INDEX cash_counts_reconciliation_index ON cash_counts (reconciliation_session_id) WHERE reconciliation_session_id IS NOT NULL; -- EOS

-- Validate cash count and auto-calculate fields
CREATE TRIGGER cash_counts_insert_validation_trigger
BEFORE INSERT ON cash_counts FOR EACH ROW
BEGIN
  -- Ensure account is a posting account and is a cash/bank type (has Cash Flow - Cash Equivalents tag)
  SELECT
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM accounts 
        WHERE account_code = NEW.account_code 
          AND is_posting_account = 1
      ) THEN RAISE(ABORT, 'Cash count can only be performed on posting accounts')
      WHEN NOT EXISTS (
        SELECT 1 FROM account_tags
        WHERE account_code = NEW.account_code
          AND tag = 'Cash Flow - Cash Equivalents'
      ) THEN RAISE(ABORT, 'Cash count can only be performed on cash/bank accounts (must have Cash Flow - Cash Equivalents tag)')
    END;

  -- Ensure no draft reconciliation session exists for this account
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1 FROM reconciliation_sessions
        WHERE account_code = NEW.account_code
          AND complete_time IS NULL
      ) THEN RAISE(ABORT, 'Cannot perform cash count: a draft reconciliation session exists for this account')
    END;
END; -- EOS

-- Auto-create reconciliation session and complete cash count process
CREATE TRIGGER cash_counts_insert_trigger
AFTER INSERT ON cash_counts FOR EACH ROW
BEGIN
  -- Calculate system balance (current account balance)
  -- Calculate discrepancy (counted_amount - system_balance)
  -- Create reconciliation session for this cash count
  -- For cash count, we compare physical count (statement) vs internal records
  -- Statement balance = physical count (what we physically have)
  -- Internal balance = system balance (what the books say)
  -- The statement items represent the adjustment needed to make system match reality
  INSERT INTO reconciliation_sessions (
    account_code,
    reconciliation_time,
    statement_begin_time,
    statement_end_time,
    statement_reference,
    statement_opening_balance,
    statement_closing_balance,
    internal_opening_balance,
    internal_closing_balance,
    note,
    create_time
  )
  SELECT
    NEW.account_code,
    NEW.count_time,
    NEW.count_time - 1, -- begin time (exclusive)
    NEW.count_time, -- end time (inclusive)
    'Cash Count @' || NEW.count_time, -- Use count_time as identifier
    a.balance, -- opening balance (both start from system balance)
    NEW.counted_amount, -- closing = physical count (what we have)
    a.balance, -- internal opening = system balance
    a.balance, -- internal closing = system balance (before adjustment)
    COALESCE(NEW.note, 'Physical cash count'),
    NEW.create_time
  FROM accounts a
  WHERE a.account_code = NEW.account_code;

  -- Store reconciliation session id back to cash_counts
  UPDATE cash_counts
  SET reconciliation_session_id = (
    SELECT id FROM reconciliation_sessions 
    WHERE statement_reference = 'Cash Count @' || NEW.count_time
    ORDER BY id DESC LIMIT 1
  )
  WHERE count_time = NEW.count_time;

  -- If there's a discrepancy, add a statement item to record it
  -- Discrepancy > 0 means we have MORE cash than recorded (overage/cash over) = credit to account
  -- Discrepancy < 0 means we have LESS cash than recorded (shortage/cash short) = debit from account
  INSERT INTO reconciliation_statement_items (
    reconciliation_session_id,
    item_time,
    description,
    reference,
    debit,
    credit
  )
  SELECT
    (SELECT id FROM reconciliation_sessions WHERE statement_reference = 'Cash Count @' || NEW.count_time ORDER BY id DESC LIMIT 1),
    NEW.count_time,
    CASE 
      WHEN (NEW.counted_amount - a.balance) > 0 THEN 'Cash Overage'
      ELSE 'Cash Shortage'
    END,
    'Cash Count @' || NEW.count_time,
    -- From the perspective of the external statement (physical count):
    -- If discrepancy < 0 (shortage): we have less than system, statement needs debit (reduction)
    -- If discrepancy > 0 (overage): we have more than system, statement needs credit (increase)
    CASE WHEN (NEW.counted_amount - a.balance) < 0 THEN ABS(NEW.counted_amount - a.balance) ELSE 0 END,
    CASE WHEN (NEW.counted_amount - a.balance) > 0 THEN (NEW.counted_amount - a.balance) ELSE 0 END
  FROM accounts a
  WHERE a.account_code = NEW.account_code
    AND (NEW.counted_amount - a.balance) != 0;

  -- Complete the reconciliation session
  -- The trigger will auto-create journal entry if there are unmatched items
  UPDATE reconciliation_sessions
  SET complete_time = NEW.count_time
  WHERE id = (
    SELECT id FROM reconciliation_sessions 
    WHERE statement_reference = 'Cash Count @' || NEW.count_time
    ORDER BY id DESC LIMIT 1
  );
END; -- EOS

-- View for cash count history with reconciliation details
-- system_balance and discrepancy are calculated from reconciliation session data
CREATE VIEW cash_count_history AS
SELECT
  cc.count_time,
  cc.account_code,
  a.name AS account_name,
  cc.counted_amount,
  rs.internal_opening_balance AS system_balance,
  (cc.counted_amount - rs.internal_opening_balance) AS discrepancy,
  CASE 
    WHEN (cc.counted_amount - rs.internal_opening_balance) > 0 THEN 'overage'
    WHEN (cc.counted_amount - rs.internal_opening_balance) < 0 THEN 'shortage'
    ELSE 'balanced'
  END AS discrepancy_type,
  cc.reconciliation_session_id,
  rs.complete_time AS reconciliation_complete_time,
  rs.adjustment_journal_entry_ref,
  cc.note,
  cc.create_time
FROM cash_counts cc
JOIN accounts a ON a.account_code = cc.account_code
LEFT JOIN reconciliation_sessions rs ON rs.id = cc.reconciliation_session_id
ORDER BY cc.count_time DESC; -- EOS

-- View for account cash count summary
CREATE VIEW account_cash_count_summary AS
SELECT
  a.account_code,
  a.name AS account_name,
  a.balance AS current_balance,
  (SELECT COUNT(*) FROM cash_counts WHERE account_code = a.account_code) AS total_counts,
  (SELECT MAX(count_time) FROM cash_counts WHERE account_code = a.account_code) AS last_count_time,
  (SELECT counted_amount FROM cash_counts WHERE account_code = a.account_code ORDER BY count_time DESC LIMIT 1) AS last_counted_amount,
  (
    SELECT (cc.counted_amount - rs.internal_opening_balance)
    FROM cash_counts cc
    LEFT JOIN reconciliation_sessions rs ON rs.id = cc.reconciliation_session_id
    WHERE cc.account_code = a.account_code
    ORDER BY cc.count_time DESC
    LIMIT 1
  ) AS last_discrepancy,
  (
    SELECT SUM(CASE WHEN (cc.counted_amount - rs.internal_opening_balance) > 0 THEN (cc.counted_amount - rs.internal_opening_balance) ELSE 0 END)
    FROM cash_counts cc
    LEFT JOIN reconciliation_sessions rs ON rs.id = cc.reconciliation_session_id
    WHERE cc.account_code = a.account_code
  ) AS total_overage,
  (
    SELECT SUM(CASE WHEN (cc.counted_amount - rs.internal_opening_balance) < 0 THEN ABS(cc.counted_amount - rs.internal_opening_balance) ELSE 0 END)
    FROM cash_counts cc
    LEFT JOIN reconciliation_sessions rs ON rs.id = cc.reconciliation_session_id
    WHERE cc.account_code = a.account_code
  ) AS total_shortage
FROM accounts a
JOIN account_tags at ON at.account_code = a.account_code
WHERE at.tag = 'Cash Flow - Cash Equivalents'
  AND a.is_posting_account = 1
ORDER BY a.account_code; -- EOS

UPDATE config SET value = '007-cash-count' WHERE key = 'Schema Version'; -- EOS
