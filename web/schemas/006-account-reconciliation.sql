-- =================================================================
-- Account Reconciliation Migration Script
-- Version: 1.0
-- Date: 2026-01-11
-- SQLite Version: 3.43.0
-- Dependencies: 001-accounting.sql
-- 
-- This script creates the account reconciliation schema.
-- 
-- Purpose:
-- - Audit and verify internal financial data against external/actual data
-- - Automatically record proper journal entries when discrepancies exist
-- - Maintain audit trail for all reconciliation activities
-- 
-- Key Concepts:
-- - Reconciliation Session: A reconciliation event for a specific account
-- - External Statement Items: Individual items from external sources (bank statements, etc.)
-- - Matching: Link internal journal entries with external items
-- - Discrepancy: Difference between internal records and external statements
-- 
-- Migration Features:
-- - ACID transaction boundary
-- - Performance-optimized indexes
-- - Each top-level statement is followed by end-of-statement (EOS) marker
-- =================================================================

-- =================================================================
-- RECONCILIATION ACCOUNT TAGS
-- =================================================================

-- Add reconciliation-related tags to account_tags
-- Note: This uses INSERT OR IGNORE pattern since we can't modify the CHECK constraint
-- in an early development stage we'll update 001-accounting.sql directly

-- =================================================================
-- RECONCILIATION SESSIONS
-- =================================================================

-- Reconciliation session represents a single reconciliation event for an account
-- It captures the state at the time of reconciliation and tracks the outcome
CREATE TABLE reconciliation_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_code INTEGER NOT NULL REFERENCES accounts (account_code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  reconciliation_time INTEGER NOT NULL, -- when the reconciliation was performed
  statement_begin_time INTEGER NOT NULL, -- statement period start (exclusive)
  statement_end_time INTEGER NOT NULL, -- statement period end (inclusive)
  statement_reference TEXT, -- external reference (bank statement #, date, etc.)
  statement_opening_balance INTEGER NOT NULL, -- opening balance per external statement
  statement_closing_balance INTEGER NOT NULL, -- closing balance per external statement
  internal_opening_balance INTEGER NOT NULL, -- opening balance per internal records
  internal_closing_balance INTEGER NOT NULL, -- closing balance per internal records
  complete_time INTEGER, -- NULL = draft, non-NULL = completed (timestamp when reconciliation was finalized)
  adjustment_journal_entry_ref INTEGER REFERENCES journal_entries (ref) ON UPDATE RESTRICT ON DELETE RESTRICT, -- non-NULL indicates completed with adjustments
  note TEXT,
  create_time INTEGER NOT NULL,
  CHECK (statement_begin_time < statement_end_time)
) STRICT; -- EOS

CREATE INDEX reconciliation_sessions_account_code_index ON reconciliation_sessions (account_code); -- EOS
CREATE INDEX reconciliation_sessions_account_time_index ON reconciliation_sessions (account_code, reconciliation_time); -- EOS
CREATE INDEX reconciliation_sessions_complete_time_index ON reconciliation_sessions (complete_time); -- EOS
CREATE INDEX reconciliation_sessions_complete_time_null_index ON reconciliation_sessions (complete_time) WHERE complete_time IS NULL; -- EOS
CREATE INDEX reconciliation_sessions_time_index ON reconciliation_sessions (reconciliation_time); -- EOS
CREATE INDEX reconciliation_sessions_period_index ON reconciliation_sessions (statement_begin_time, statement_end_time); -- EOS

-- Validation trigger for reconciliation session insert
CREATE TRIGGER reconciliation_sessions_insert_validation_trigger
BEFORE INSERT ON reconciliation_sessions FOR EACH ROW
BEGIN
  -- Ensure account is a posting account
  SELECT
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM accounts 
        WHERE account_code = NEW.account_code 
          AND is_posting_account = 1
      ) THEN RAISE(ABORT, 'Reconciliation can only be performed on posting accounts')
    END;

  -- Ensure no overlapping draft sessions for same account
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1 FROM reconciliation_sessions
        WHERE account_code = NEW.account_code
          AND complete_time IS NULL
      ) THEN RAISE(ABORT, 'Cannot create new reconciliation session: draft session exists for this account')
    END;
END; -- EOS

-- =================================================================
-- EXTERNAL STATEMENT ITEMS
-- =================================================================

-- Individual line items from external statement (e.g., bank transactions)
CREATE TABLE reconciliation_statement_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reconciliation_session_id INTEGER NOT NULL REFERENCES reconciliation_sessions (id) ON UPDATE RESTRICT ON DELETE CASCADE,
  item_time INTEGER NOT NULL, -- transaction date from external statement
  description TEXT, -- description from external statement
  reference TEXT, -- external reference number (check #, transfer ID, etc.)
  debit INTEGER NOT NULL DEFAULT 0 CHECK (debit >= 0), -- amount debited per statement
  credit INTEGER NOT NULL DEFAULT 0 CHECK (credit >= 0), -- amount credited per statement
  is_matched INTEGER NOT NULL DEFAULT 0 CHECK (is_matched IN (0, 1)),
  matched_journal_entry_ref INTEGER REFERENCES journal_entries (ref) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK (debit = 0 OR credit = 0), -- only one can be non-zero
  CHECK (debit > 0 OR credit > 0) -- at least one must be positive
) STRICT; -- EOS

CREATE INDEX reconciliation_statement_items_session_index ON reconciliation_statement_items (reconciliation_session_id); -- EOS
CREATE INDEX reconciliation_statement_items_time_index ON reconciliation_statement_items (item_time); -- EOS
CREATE INDEX reconciliation_statement_items_matched_index ON reconciliation_statement_items (is_matched); -- EOS
CREATE INDEX reconciliation_statement_items_unmatched_index ON reconciliation_statement_items (reconciliation_session_id, is_matched) WHERE is_matched = 0; -- EOS

-- =================================================================
-- INTERNAL TRANSACTION MATCHING
-- =================================================================

-- Track which internal journal entries have been matched to statement items
CREATE TABLE reconciliation_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reconciliation_session_id INTEGER NOT NULL REFERENCES reconciliation_sessions (id) ON UPDATE RESTRICT ON DELETE CASCADE,
  statement_item_id INTEGER REFERENCES reconciliation_statement_items (id) ON UPDATE RESTRICT ON DELETE CASCADE,
  journal_entry_ref INTEGER NOT NULL REFERENCES journal_entries (ref) ON UPDATE RESTRICT ON DELETE RESTRICT,
  journal_entry_line_number INTEGER NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN (
    'exact', -- amounts match exactly
    'partial', -- partial match (statement item covers multiple journal entries or vice versa)
    'manual', -- manually matched by user despite differences
    'outstanding' -- internal transaction not yet cleared in external statement
  )),
  note TEXT,
  FOREIGN KEY (journal_entry_ref, journal_entry_line_number) REFERENCES journal_entry_lines (journal_entry_ref, line_number) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT; -- EOS

CREATE INDEX reconciliation_matches_session_index ON reconciliation_matches (reconciliation_session_id); -- EOS
CREATE INDEX reconciliation_matches_statement_item_index ON reconciliation_matches (statement_item_id) WHERE statement_item_id IS NOT NULL; -- EOS
CREATE INDEX reconciliation_matches_journal_index ON reconciliation_matches (journal_entry_ref, journal_entry_line_number); -- EOS
CREATE INDEX reconciliation_matches_type_index ON reconciliation_matches (match_type); -- EOS

-- Update statement item is_matched flag when match is created
CREATE TRIGGER reconciliation_matches_insert_trigger
AFTER INSERT ON reconciliation_matches FOR EACH ROW
WHEN NEW.statement_item_id IS NOT NULL
BEGIN
  UPDATE reconciliation_statement_items
  SET is_matched = 1,
      matched_journal_entry_ref = NEW.journal_entry_ref
  WHERE id = NEW.statement_item_id;
END; -- EOS

-- Update statement item is_matched flag when match is deleted
CREATE TRIGGER reconciliation_matches_delete_trigger
AFTER DELETE ON reconciliation_matches FOR EACH ROW
WHEN OLD.statement_item_id IS NOT NULL
BEGIN
  UPDATE reconciliation_statement_items
  SET is_matched = CASE 
    WHEN EXISTS (SELECT 1 FROM reconciliation_matches WHERE statement_item_id = OLD.statement_item_id) 
    THEN 1 ELSE 0 END,
    matched_journal_entry_ref = (
      SELECT journal_entry_ref 
      FROM reconciliation_matches 
      WHERE statement_item_id = OLD.statement_item_id 
      LIMIT 1
    )
  WHERE id = OLD.statement_item_id;
END; -- EOS

-- =================================================================
-- RECONCILIATION DISCREPANCIES
-- =================================================================

-- Track identified discrepancies during reconciliation
CREATE TABLE reconciliation_discrepancies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reconciliation_session_id INTEGER NOT NULL REFERENCES reconciliation_sessions (id) ON UPDATE RESTRICT ON DELETE CASCADE,
  discrepancy_type TEXT NOT NULL CHECK (discrepancy_type IN (
    'unrecorded_debit', -- debit in statement not in books (e.g., bank fee not recorded)
    'unrecorded_credit', -- credit in statement not in books (e.g., interest earned)
    'timing_difference', -- transaction recorded in different period
    'amount_difference', -- same transaction, different amount
    'missing_in_statement', -- recorded in books, not in statement
    'duplicate', -- potential duplicate entry
    'other' -- other discrepancy
  )),
  statement_item_id INTEGER REFERENCES reconciliation_statement_items (id) ON UPDATE RESTRICT ON DELETE CASCADE,
  journal_entry_ref INTEGER REFERENCES journal_entries (ref) ON UPDATE RESTRICT ON DELETE RESTRICT,
  expected_amount INTEGER, -- what amount was expected
  actual_amount INTEGER, -- what amount was found
  difference_amount INTEGER NOT NULL, -- the discrepancy amount (actual - expected)
  resolution TEXT CHECK (resolution IN (
    'pending', -- not yet resolved
    'adjusted', -- journal entry created to correct
    'accepted', -- accepted as timing difference (will clear next period)
    'written_off', -- written off as immaterial
    'investigated' -- under investigation
  )) DEFAULT 'pending',
  resolution_journal_entry_ref INTEGER REFERENCES journal_entries (ref) ON UPDATE RESTRICT ON DELETE RESTRICT,
  note TEXT
) STRICT; -- EOS

CREATE INDEX reconciliation_discrepancies_session_index ON reconciliation_discrepancies (reconciliation_session_id); -- EOS
CREATE INDEX reconciliation_discrepancies_type_index ON reconciliation_discrepancies (discrepancy_type); -- EOS
CREATE INDEX reconciliation_discrepancies_resolution_index ON reconciliation_discrepancies (resolution); -- EOS
CREATE INDEX reconciliation_discrepancies_pending_index ON reconciliation_discrepancies (resolution) WHERE resolution = 'pending'; -- EOS

-- =================================================================
-- RECONCILIATION COMPLETION
-- =================================================================

-- Validation and processing when reconciliation is completed
CREATE TRIGGER reconciliation_sessions_complete_validation_trigger
BEFORE UPDATE OF complete_time ON reconciliation_sessions FOR EACH ROW
WHEN OLD.complete_time IS NULL AND NEW.complete_time IS NOT NULL
BEGIN
  -- Verify reconciliation is balanced
  SELECT
    CASE
      -- Calculate: statement closing - statement opening = sum of statement items
      WHEN (
        NEW.statement_closing_balance - NEW.statement_opening_balance
      ) != (
        SELECT COALESCE(SUM(credit) - SUM(debit), 0)
        FROM reconciliation_statement_items
        WHERE reconciliation_session_id = NEW.id
      ) THEN RAISE(ABORT, 'Statement items do not reconcile to statement balance change')
    END;
END; -- EOS

-- Generate adjustment journal entry when reconciliation is completed with unmatched items
CREATE TRIGGER reconciliation_sessions_complete_trigger
AFTER UPDATE OF complete_time ON reconciliation_sessions FOR EACH ROW
WHEN OLD.complete_time IS NULL AND NEW.complete_time IS NOT NULL
  AND EXISTS (SELECT 1 FROM reconciliation_statement_items WHERE reconciliation_session_id = NEW.id AND is_matched = 0)
BEGIN
  -- Create adjustment journal entry for unmatched statement items
  INSERT INTO journal_entries (entry_time, note, source_type, source_reference, created_by)
  SELECT
    NEW.reconciliation_time,
    'Reconciliation Adjustment - ' || a.name || ' (' || COALESCE(NEW.statement_reference, 'Session #' || NEW.id) || ')',
    'System',
    'Reconciliation #' || NEW.id,
    'System'
  FROM accounts a
  WHERE a.account_code = NEW.account_code;

  -- Debit entries for unmatched statement debits (reduces our asset/increases expense)
  -- Use Cash Over/Short account for cash counts, Reconciliation Adjustment for others
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description, reference)
  SELECT
    (SELECT ref FROM journal_entries WHERE source_reference = 'Reconciliation #' || NEW.id ORDER BY ref DESC LIMIT 1),
    COALESCE(
      -- For cash counts, use Cash Over/Short account
      (SELECT at.account_code FROM account_tags at 
       WHERE at.tag = 'Reconciliation - Cash Over/Short' 
         AND NEW.statement_reference LIKE 'Cash Count @%'
       LIMIT 1),
      -- For other reconciliations, use Reconciliation Adjustment account  
      (SELECT at.account_code FROM account_tags at 
       WHERE at.tag = 'Reconciliation - Adjustment'
       LIMIT 1)
    ),
    rsi.debit,
    0,
    'Unrecorded: ' || COALESCE(rsi.description, 'Statement debit'),
    rsi.reference
  FROM reconciliation_statement_items rsi
  WHERE rsi.reconciliation_session_id = NEW.id
    AND rsi.is_matched = 0
    AND rsi.debit > 0
    AND (
      EXISTS (SELECT 1 FROM account_tags WHERE tag = 'Reconciliation - Adjustment')
      OR EXISTS (SELECT 1 FROM account_tags WHERE tag = 'Reconciliation - Cash Over/Short')
    );

  -- Credit to the reconciled account for statement debits
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description)
  SELECT
    (SELECT ref FROM journal_entries WHERE source_reference = 'Reconciliation #' || NEW.id ORDER BY ref DESC LIMIT 1),
    NEW.account_code,
    0,
    (SELECT SUM(rsi.debit) FROM reconciliation_statement_items rsi WHERE rsi.reconciliation_session_id = NEW.id AND rsi.is_matched = 0 AND rsi.debit > 0),
    'Reconciliation - Statement debits adjustment'
  FROM (SELECT 1) AS dummy
  WHERE (SELECT SUM(rsi.debit) FROM reconciliation_statement_items rsi WHERE rsi.reconciliation_session_id = NEW.id AND rsi.is_matched = 0 AND rsi.debit > 0) > 0;

  -- Credit entries for unmatched statement credits (increases our asset/revenue)
  -- Use Cash Over/Short account for cash counts, Reconciliation Adjustment for others
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description, reference)
  SELECT
    (SELECT ref FROM journal_entries WHERE source_reference = 'Reconciliation #' || NEW.id ORDER BY ref DESC LIMIT 1),
    COALESCE(
      -- For cash counts, use Cash Over/Short account
      (SELECT at.account_code FROM account_tags at 
       WHERE at.tag = 'Reconciliation - Cash Over/Short' 
         AND NEW.statement_reference LIKE 'Cash Count @%'
       LIMIT 1),
      -- For other reconciliations, use Reconciliation Adjustment account  
      (SELECT at.account_code FROM account_tags at 
       WHERE at.tag = 'Reconciliation - Adjustment'
       LIMIT 1)
    ),
    0,
    rsi.credit,
    'Unrecorded: ' || COALESCE(rsi.description, 'Statement credit'),
    rsi.reference
  FROM reconciliation_statement_items rsi
  WHERE rsi.reconciliation_session_id = NEW.id
    AND rsi.is_matched = 0
    AND rsi.credit > 0
    AND (
      EXISTS (SELECT 1 FROM account_tags WHERE tag = 'Reconciliation - Adjustment')
      OR EXISTS (SELECT 1 FROM account_tags WHERE tag = 'Reconciliation - Cash Over/Short')
    );

  -- Debit to the reconciled account for statement credits
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description)
  SELECT
    (SELECT ref FROM journal_entries WHERE source_reference = 'Reconciliation #' || NEW.id ORDER BY ref DESC LIMIT 1),
    NEW.account_code,
    (SELECT SUM(rsi.credit) FROM reconciliation_statement_items rsi WHERE rsi.reconciliation_session_id = NEW.id AND rsi.is_matched = 0 AND rsi.credit > 0),
    0,
    'Reconciliation - Statement credits adjustment'
  FROM (SELECT 1) AS dummy
  WHERE (SELECT SUM(rsi.credit) FROM reconciliation_statement_items rsi WHERE rsi.reconciliation_session_id = NEW.id AND rsi.is_matched = 0 AND rsi.credit > 0) > 0;

  -- Post the adjustment journal entry if it has lines
  UPDATE journal_entries
  SET post_time = NEW.reconciliation_time
  WHERE ref = (
    SELECT ref FROM journal_entries 
    WHERE source_reference = 'Reconciliation #' || NEW.id 
    ORDER BY ref DESC LIMIT 1
  )
  AND (SELECT COUNT(*) FROM journal_entry_lines WHERE journal_entry_ref = (
    SELECT ref FROM journal_entries WHERE source_reference = 'Reconciliation #' || NEW.id ORDER BY ref DESC LIMIT 1
  )) >= 2;

  -- Store adjustment journal entry reference
  UPDATE reconciliation_sessions
  SET adjustment_journal_entry_ref = (
    SELECT ref FROM journal_entries 
    WHERE source_reference = 'Reconciliation #' || NEW.id 
      AND post_time IS NOT NULL
    ORDER BY ref DESC LIMIT 1
  )
  WHERE id = NEW.id;

  -- Create discrepancy records for unmatched items
  INSERT INTO reconciliation_discrepancies (
    reconciliation_session_id,
    discrepancy_type,
    statement_item_id,
    difference_amount,
    resolution,
    resolution_journal_entry_ref,
    note
  )
  SELECT
    NEW.id,
    CASE 
      WHEN rsi.debit > 0 THEN 'unrecorded_debit'
      ELSE 'unrecorded_credit'
    END,
    rsi.id,
    CASE 
      WHEN rsi.debit > 0 THEN -rsi.debit
      ELSE rsi.credit
    END,
    'adjusted',
    (SELECT ref FROM journal_entries WHERE source_reference = 'Reconciliation #' || NEW.id AND post_time IS NOT NULL ORDER BY ref DESC LIMIT 1),
    'Auto-adjusted during reconciliation completion'
  FROM reconciliation_statement_items rsi
  WHERE rsi.reconciliation_session_id = NEW.id
    AND rsi.is_matched = 0;
END; -- EOS

-- Prevent complete_time change once completed
CREATE TRIGGER reconciliation_sessions_complete_time_immutability_trigger
BEFORE UPDATE OF complete_time ON reconciliation_sessions FOR EACH ROW
WHEN OLD.complete_time IS NOT NULL AND (NEW.complete_time IS NULL OR NEW.complete_time != OLD.complete_time)
BEGIN
  SELECT RAISE(ABORT, 'Cannot change or remove complete_time of completed reconciliation session');
END; -- EOS

-- =================================================================
-- RECONCILIATION VIEWS
-- =================================================================

-- Summary view of reconciliation sessions
CREATE VIEW reconciliation_session_summary AS
SELECT
  rs.id,
  rs.account_code,
  a.name AS account_name,
  rs.reconciliation_time,
  rs.statement_begin_time,
  rs.statement_end_time,
  rs.statement_reference,
  rs.statement_opening_balance,
  rs.statement_closing_balance,
  rs.internal_opening_balance,
  rs.internal_closing_balance,
  (rs.statement_closing_balance - rs.internal_closing_balance) AS balance_difference,
  rs.complete_time,
  rs.adjustment_journal_entry_ref,
  (SELECT COUNT(*) FROM reconciliation_statement_items WHERE reconciliation_session_id = rs.id) AS total_statement_items,
  (SELECT COUNT(*) FROM reconciliation_statement_items WHERE reconciliation_session_id = rs.id AND is_matched = 1) AS matched_items,
  (SELECT COUNT(*) FROM reconciliation_statement_items WHERE reconciliation_session_id = rs.id AND is_matched = 0) AS unmatched_items,
  (SELECT COUNT(*) FROM reconciliation_discrepancies WHERE reconciliation_session_id = rs.id) AS total_discrepancies,
  (SELECT COUNT(*) FROM reconciliation_discrepancies WHERE reconciliation_session_id = rs.id AND resolution = 'pending') AS pending_discrepancies,
  rs.note,
  rs.create_time
FROM reconciliation_sessions rs
JOIN accounts a ON a.account_code = rs.account_code
ORDER BY rs.reconciliation_time DESC; -- EOS

-- View for unmatched internal transactions (outstanding items)
CREATE VIEW reconciliation_outstanding_transactions AS
SELECT
  rs.id AS reconciliation_session_id,
  rs.account_code,
  a.name AS account_name,
  je.ref AS journal_entry_ref,
  jel.line_number,
  je.entry_time,
  je.note AS journal_note,
  jel.debit,
  jel.credit,
  jel.description,
  jel.reference
FROM reconciliation_sessions rs
JOIN accounts a ON a.account_code = rs.account_code
JOIN journal_entry_lines jel ON jel.account_code = rs.account_code
JOIN journal_entries je ON je.ref = jel.journal_entry_ref
WHERE rs.complete_time IS NULL
  AND je.post_time IS NOT NULL
  AND je.entry_time > rs.statement_begin_time
  AND je.entry_time <= rs.statement_end_time
  AND NOT EXISTS (
    SELECT 1 FROM reconciliation_matches rm
    WHERE rm.reconciliation_session_id = rs.id
      AND rm.journal_entry_ref = je.ref
      AND rm.journal_entry_line_number = jel.line_number
  )
ORDER BY je.entry_time; -- EOS

-- View for reconciliation history by account
CREATE VIEW account_reconciliation_history AS
SELECT
  a.account_code,
  a.name AS account_name,
  rs.id AS reconciliation_session_id,
  rs.reconciliation_time,
  rs.statement_begin_time,
  rs.statement_end_time,
  rs.statement_reference,
  rs.complete_time,
  rs.adjustment_journal_entry_ref,
  (rs.statement_closing_balance - rs.internal_closing_balance) AS balance_difference,
  (SELECT COUNT(*) FROM reconciliation_discrepancies WHERE reconciliation_session_id = rs.id) AS discrepancy_count
FROM accounts a
LEFT JOIN reconciliation_sessions rs ON rs.account_code = a.account_code
WHERE rs.complete_time IS NOT NULL
ORDER BY a.account_code, rs.reconciliation_time DESC; -- EOS

-- =================================================================
-- RECONCILIATION HELPER FUNCTIONS VIA VIEWS
-- =================================================================

-- View to help calculate internal balance for a period
CREATE VIEW account_period_balance AS
SELECT
  a.account_code,
  a.name AS account_name,
  a.normal_balance,
  fy.begin_time AS period_begin,
  fy.end_time AS period_end,
  -- Opening balance: sum of all posted entries before period
  COALESCE((
    SELECT SUM(
      CASE a.normal_balance
        WHEN 0 THEN jel.debit - jel.credit
        WHEN 1 THEN jel.credit - jel.debit
      END
    )
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.ref = jel.journal_entry_ref
    WHERE jel.account_code = a.account_code
      AND je.post_time IS NOT NULL
      AND je.entry_time <= fy.begin_time
  ), 0) AS opening_balance,
  -- Period activity
  COALESCE((
    SELECT SUM(
      CASE a.normal_balance
        WHEN 0 THEN jel.debit - jel.credit
        WHEN 1 THEN jel.credit - jel.debit
      END
    )
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.ref = jel.journal_entry_ref
    WHERE jel.account_code = a.account_code
      AND je.post_time IS NOT NULL
      AND je.entry_time > fy.begin_time
      AND je.entry_time <= fy.end_time
  ), 0) AS period_change,
  -- Closing balance: opening + activity
  COALESCE((
    SELECT SUM(
      CASE a.normal_balance
        WHEN 0 THEN jel.debit - jel.credit
        WHEN 1 THEN jel.credit - jel.debit
      END
    )
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.ref = jel.journal_entry_ref
    WHERE jel.account_code = a.account_code
      AND je.post_time IS NOT NULL
      AND je.entry_time <= fy.end_time
  ), 0) AS closing_balance
FROM accounts a
CROSS JOIN fiscal_years fy
WHERE a.is_posting_account = 1; -- EOS

UPDATE config SET value = '006-account-reconciliation' WHERE key = 'Schema Version'; -- EOS
