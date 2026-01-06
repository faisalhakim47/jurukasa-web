-- =================================================================
-- Accounting Database Migration Script
-- Version: 1.0
-- SQLite Version: 3.43.0
-- Date: 2025-08-18
-- 
-- This script creates the accounting schema.
-- Database Features:
-- - Complete double-entry accounting system
-- - IFRS/PSAK compliant financial reporting
-- - Automated fiscal year closing via triggers
-- - Multi-period financial statements
-- - Audit trail with immutable transaction history
-- - Chart of accounts with flexible tagging system
-- 
-- Migration Features:
-- - ACID transaction boundary
-- - Performance-optimized indexes
-- - Each top-level statement is followed by end-of-statement (EOS) marker
-- =================================================================

-- =================================================================
-- METADATA AND CONFIGURATION
-- =================================================================

-- Business-specific configuration and metadata
CREATE TABLE config (
  key TEXT PRIMARY KEY CHECK (key IN (
    'Schema Version',
    'Business Name',
    'Business Type',
    'Currency Code',
    'Currency Decimals',
    'Locale',
    'Fiscal Year Start Month'
  )),
  value TEXT NOT NULL CHECK (length(value) >= 0),
  description TEXT,
  create_time INTEGER NOT NULL,
  update_time INTEGER NOT NULL
) STRICT, WITHOUT ROWID; -- EOS

CREATE INDEX config_update_time_index ON config (update_time); -- EOS

-- Insert default configuration
INSERT INTO config (key, value, description, create_time, update_time) VALUES
  ('Business Name', '', 'Business or entity name', 0, 0),
  ('Business Type', 'Small Business', 'Type of business entity', 0, 0),
  ('Currency Code', 'IDR', 'Base currency code (ISO 4217)', 0, 0),
  ('Currency Decimals', '0', 'Number of decimal places for currency (0 for IDR)', 0, 0),
  ('Locale', 'en-ID', 'ISO 639-1 and ISO 3166-1 separated by hyphen (e.g., en-US, en-ID)', 0, 0),
  ('Fiscal Year Start Month', '1', 'Fiscal year start month (1-12)', 0, 0); -- EOS

-- =================================================================
-- CHART OF ACCOUNTS
-- =================================================================

-- Account master - core of the accounting system
CREATE TABLE accounts (
  account_code INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  normal_balance INTEGER NOT NULL CHECK (normal_balance IN (0, 1)), -- 0 = debit, 1 = credit
  balance INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  is_posting_account INTEGER NOT NULL DEFAULT 1 CHECK (is_posting_account IN (0, 1)),
  control_account_code INTEGER REFERENCES accounts (account_code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  create_time INTEGER NOT NULL,
  update_time INTEGER NOT NULL,
  CHECK (control_account_code IS NULL OR control_account_code != account_code)
) STRICT; -- EOS

CREATE INDEX accounts_name_index ON accounts (name); -- EOS
CREATE INDEX accounts_active_index ON accounts (is_active, account_code) WHERE is_active = 1; -- EOS
CREATE INDEX accounts_posting_index ON accounts (is_posting_account, account_code) WHERE is_posting_account = 1; -- EOS
CREATE INDEX accounts_parent_index ON accounts (control_account_code) WHERE control_account_code IS NOT NULL; -- EOS
CREATE INDEX accounts_balance_index ON accounts (balance) WHERE balance != 0; -- EOS
CREATE INDEX accounts_selector_index ON accounts (account_code, name) WHERE is_active = 1 AND is_posting_account = 1; -- EOS

-- Prevent assigning a control_account_code to an account when the target
-- control account has non-zero posted journal entry totals. The control
-- account must be zeroed-out (no net posted debit/credit) before it can be
-- used as a parent/control account.
CREATE TRIGGER accounts_control_set_on_insert_validation_trigger
BEFORE INSERT ON accounts FOR EACH ROW
WHEN NEW.control_account_code IS NOT NULL
BEGIN
  SELECT
    CASE
      WHEN (
        SELECT COALESCE(SUM(jel.debit) - SUM(jel.credit), 0)
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.ref = jel.journal_entry_ref
        WHERE jel.account_code = NEW.control_account_code
          AND je.post_time IS NOT NULL
      ) != 0
      THEN RAISE(ABORT, 'Cannot set control_account_code on insert: target control account has non-zero posted entries')
    END;
END; -- EOS

CREATE TRIGGER accounts_control_set_on_update_validation_trigger
BEFORE UPDATE OF control_account_code ON accounts FOR EACH ROW
WHEN NEW.control_account_code IS NOT NULL AND (OLD.control_account_code IS NULL OR NEW.control_account_code != OLD.control_account_code)
BEGIN
  SELECT
    CASE
      WHEN (
        SELECT COALESCE(SUM(jel.debit) - SUM(jel.credit), 0)
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.ref = jel.journal_entry_ref
        WHERE jel.account_code = NEW.control_account_code
          AND je.post_time IS NOT NULL
      ) != 0
      THEN RAISE(ABORT, 'Cannot set control_account_code on update: target control account has non-zero posted entries')
    END;
END; -- EOS

-- Maintain is_posting_account flag automatically:
-- - When a child is added with a control_account_code, mark the parent as non-posting (0).
-- - When a child's parent link is removed or changed, and the old parent has no remaining children,
--   mark the old parent as posting (1).
-- - When a child is deleted, update the parent's is_posting_account accordingly.

CREATE TRIGGER accounts_child_insert_trigger
AFTER INSERT ON accounts FOR EACH ROW
WHEN NEW.control_account_code IS NOT NULL
BEGIN
  UPDATE accounts
  SET is_posting_account = 0,
      update_time = NEW.update_time
  WHERE account_code = NEW.control_account_code
    AND is_posting_account != 0;
END; -- EOS

CREATE TRIGGER accounts_child_update_trigger
AFTER UPDATE OF control_account_code ON accounts FOR EACH ROW
BEGIN
  -- Update old parent: if it now has no children, mark it as posting (1), otherwise keep non-posting (0)
  UPDATE accounts
  SET is_posting_account = CASE WHEN (
      SELECT COUNT(1) FROM accounts a WHERE a.control_account_code = OLD.control_account_code
    ) > 0 THEN 0 ELSE 1 END,
    update_time = NEW.update_time
  WHERE account_code = OLD.control_account_code
    AND OLD.control_account_code IS NOT NULL;

  -- Update new parent: ensure it's marked as non-posting (0)
  UPDATE accounts
  SET is_posting_account = 0,
      update_time = NEW.update_time
  WHERE account_code = NEW.control_account_code
    AND NEW.control_account_code IS NOT NULL
    AND is_posting_account != 0;
END; -- EOS

CREATE TRIGGER accounts_child_delete_trigger
AFTER DELETE ON accounts FOR EACH ROW
WHEN OLD.control_account_code IS NOT NULL
BEGIN
  UPDATE accounts
  SET is_posting_account = CASE WHEN (
      SELECT COUNT(1) FROM accounts a WHERE a.control_account_code = OLD.control_account_code
    ) > 0 THEN 0 ELSE 1 END,
    update_time = strftime('%s','now')
  WHERE account_code = OLD.control_account_code;
END; -- EOS


-- Account classification and reporting tags
CREATE TABLE account_tags (
  account_code INTEGER NOT NULL REFERENCES accounts (account_code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  tag TEXT NOT NULL CHECK (tag IN (
    -- Account Types
    'Asset',
    'Liability',
    'Equity',
    'Revenue',
    'Expense',
    'Contra Asset',
    'Contra Liability',
    'Contra Equity',
    'Contra Revenue',
    'Contra Expense',

    -- Account Classifications
    'Current Asset',
    'Non-Current Asset',
    'Current Liability',
    'Non-Current Liability',

    -- Fiscal Year Closing Tags
    'Fiscal Year Closing - Retained Earning',
    'Fiscal Year Closing - Revenue',
    'Fiscal Year Closing - Expense',
    'Fiscal Year Closing - Dividend',
    
    -- Balance Sheet Classification
    'Balance Sheet - Current Asset',
    'Balance Sheet - Non-Current Asset',
    'Balance Sheet - Current Liability',
    'Balance Sheet - Non-Current Liability',
    'Balance Sheet - Equity',
    
    -- Income Statement Classification
    'Income Statement - Revenue',
    'Income Statement - Contra Revenue',
    'Income Statement - Other Revenue',
    'Income Statement - COGS',
    'Income Statement - Expense',
    'Income Statement - Other Expense',
    
    -- Cash Flow Statement Tags
    'Cash Flow - Cash Equivalents',
    'Cash Flow - Revenue',
    'Cash Flow - Expense',
    'Cash Flow - Activity - Operating',
    'Cash Flow - Activity - Investing',
    'Cash Flow - Activity - Financing',
    'Cash Flow - Non-Cash - Depreciation',
    'Cash Flow - Non-Cash - Amortization',
    'Cash Flow - Non-Cash - Impairment',
    'Cash Flow - Non-Cash - Gain/Loss',
    'Cash Flow - Non-Cash - Stock Compensation',
    'Cash Flow - Working Capital - Current Asset',
    'Cash Flow - Working Capital - Current Liability',

    -- POS System Tags
    'POS - Accounts Payable',
    'POS - Bank Fees',
    'POS - Sales Revenue',
    'POS - Sales Discount',
    'POS - Cost of Goods Sold',
    'POS - Inventory',
    'POS - Inventory Gain',
    'POS - Inventory Shrinkage',
    'POS - Payment Method'
  )),
  PRIMARY KEY (account_code, tag)
) STRICT, WITHOUT ROWID; -- EOS

CREATE INDEX account_tags_account_index ON account_tags (account_code); -- EOS
CREATE INDEX account_tags_tag_index ON account_tags (tag); -- EOS
CREATE INDEX account_tags_tag_account_index ON account_tags (tag, account_code); -- EOS

-- Enforce only one account can be tagged
CREATE UNIQUE INDEX account_tags_unique_fiscalyearclosing_retainearning_index ON account_tags (tag) WHERE tag = 'Fiscal Year Closing - Retained Earning'; -- EOS
CREATE UNIQUE INDEX account_tags_unique_pos_accountpayables_index ON account_tags (tag) WHERE tag = 'POS - Accounts Payable'; -- EOS
CREATE UNIQUE INDEX account_tags_unique_pos_bankfees_index ON account_tags (tag) WHERE tag = 'POS - Bank Fees'; -- EOS
CREATE UNIQUE INDEX account_tags_unique_pos_salesrevenue_index ON account_tags (tag) WHERE tag = 'POS - Sales Revenue'; -- EOS
CREATE UNIQUE INDEX account_tags_unique_pos_salesdiscount_index ON account_tags (tag) WHERE tag = 'POS - Sales Discount'; -- EOS
CREATE UNIQUE INDEX account_tags_unique_pos_costofgoodssold_index ON account_tags (tag) WHERE tag = 'POS - Cost of Goods Sold'; -- EOS
CREATE UNIQUE INDEX account_tags_unique_pos_inventorygain_index ON account_tags (tag) WHERE tag = 'POS - Inventory Gain'; -- EOS
CREATE UNIQUE INDEX account_tags_unique_pos_inventoryshrinkage_index ON account_tags (tag) WHERE tag = 'POS - Inventory Shrinkage'; -- EOS

-- Prevent updates to account_tags: tags are immutable (delete + insert to change)
CREATE TRIGGER account_tags_update_prevention_trigger
BEFORE UPDATE ON account_tags FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Cannot update account_tags: tags are immutable; delete and re-insert instead');
END; -- EOS

-- =================================================================
-- JOURNAL ENTRIES AND TRANSACTIONS
-- =================================================================

-- Journal entry header
CREATE TABLE journal_entries (
  ref INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_time INTEGER NOT NULL,
  note TEXT,
  post_time INTEGER,
  source_type TEXT DEFAULT 'Manual' CHECK (source_type IN ('Manual', 'LLM', 'System')),
  source_reference TEXT,
  created_by TEXT DEFAULT 'User' CHECK (created_by IN ('User', 'System', 'Migration')),
  reversal_of_ref INTEGER REFERENCES journal_entries (ref) ON UPDATE RESTRICT ON DELETE RESTRICT,
  reversed_by_ref INTEGER REFERENCES journal_entries (ref) ON UPDATE RESTRICT ON DELETE RESTRICT,
  idempotent_key TEXT
) STRICT; -- EOS

CREATE INDEX journal_entries_entry_time_index ON journal_entries (entry_time); -- EOS
CREATE INDEX journal_entries_entry_time_post_time_index ON journal_entries (entry_time, post_time); -- EOS
CREATE INDEX journal_entries_post_time_not_null_index ON journal_entries (post_time) WHERE post_time IS NOT NULL; -- EOS
CREATE INDEX journal_entries_post_time_ref_index ON journal_entries (post_time, ref) WHERE post_time IS NOT NULL; -- EOS
CREATE INDEX journal_entries_ref_post_time_index ON journal_entries(ref, post_time); -- EOS
CREATE INDEX journal_entries_source_type_index ON journal_entries (source_type, entry_time); -- EOS
CREATE INDEX journal_entries_reversal_index ON journal_entries (reversal_of_ref) WHERE reversal_of_ref IS NOT NULL; -- EOS
CREATE UNIQUE INDEX journal_entries_idempotent_key_index ON journal_entries (idempotent_key) WHERE idempotent_key IS NOT NULL; -- EOS

-- Journal entry validation trigger
CREATE TRIGGER journal_entries_insert_validation_trigger
BEFORE INSERT ON journal_entries FOR EACH ROW
BEGIN
  -- Ensure entry time is valid
  SELECT
    CASE
      WHEN new.entry_time <= 0 THEN RAISE(ABORT, 'Entry time must be positive')
    END;
END; -- EOS

-- Prevent deletion of posted journal entries
CREATE TRIGGER journal_entries_delete_prevention_trigger
BEFORE DELETE ON journal_entries FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN old.post_time IS NOT NULL THEN RAISE(ABORT, 'Cannot delete posted journal entry')
    END;
END; -- EOS

-- Prevent unposting or changing the post_time of a posted journal entry.
-- Once posted, post_time becomes immutable to keep account balances consistent.
CREATE TRIGGER journal_entries_post_time_immutability_trigger
BEFORE UPDATE OF post_time ON journal_entries FOR EACH ROW
WHEN old.post_time IS NOT NULL AND (new.post_time IS NULL OR new.post_time != old.post_time)
BEGIN
  SELECT RAISE(ABORT, 'Cannot unpost or change post_time of a posted journal entry');
END; -- EOS

-- Journal entry line items
CREATE TABLE journal_entry_lines (
  journal_entry_ref INTEGER NOT NULL REFERENCES journal_entries (ref) ON UPDATE RESTRICT ON DELETE RESTRICT,
  line_number INTEGER NOT NULL,
  account_code INTEGER NOT NULL REFERENCES accounts (account_code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  debit INTEGER NOT NULL DEFAULT 0,
  credit INTEGER NOT NULL DEFAULT 0,
  description TEXT, -- Line-specific description
  reference TEXT, -- External reference (invoice #, etc.)
  PRIMARY KEY (journal_entry_ref, line_number),
  CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0)),
  CHECK (debit > 0 OR credit > 0) -- At least one must be positive
) STRICT, WITHOUT ROWID; -- EOS

CREATE INDEX journal_entry_lines_account_debit_credit_index ON journal_entry_lines (account_code, debit, credit); -- EOS
CREATE INDEX journal_entry_lines_journal_account_index ON journal_entry_lines(account_code, journal_entry_ref); -- EOS
CREATE INDEX journal_entry_lines_ref_line_index ON journal_entry_lines (journal_entry_ref, line_number); -- EOS

-- Prevent creating or modifying journal entry lines that post directly to
-- a control (parent) account. Posting must be done to posting (leaf)
-- accounts only.
CREATE TRIGGER journal_entry_lines_control_account_insert_prevention_trigger
BEFORE INSERT ON journal_entry_lines FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN EXISTS(
        SELECT 1 FROM accounts a WHERE a.control_account_code = NEW.account_code LIMIT 1
      ) THEN RAISE(ABORT, 'Cannot post journal entry line to a control account on insert')
    END;
END; -- EOS

CREATE TRIGGER journal_entry_lines_control_account_update_prevention_trigger
BEFORE UPDATE ON journal_entry_lines FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN EXISTS(
        SELECT 1 FROM accounts a WHERE a.control_account_code = NEW.account_code LIMIT 1
      ) THEN RAISE(ABORT, 'Cannot post journal entry line to a control account on update')
    END;
END; -- EOS

-- Validation trigger for posting journal entries
CREATE TRIGGER journal_entries_post_validation_trigger
BEFORE UPDATE OF post_time ON journal_entries FOR EACH ROW
WHEN new.post_time IS NOT NULL AND old.post_time IS NULL
BEGIN
  -- Ensure journal entry balances
  SELECT
    CASE
      WHEN new.post_time <= 0 THEN RAISE(ABORT, 'Post time must be positive')
      WHEN (SELECT SUM(debit) - SUM(credit) FROM journal_entry_lines WHERE journal_entry_ref = new.ref) != 0 
      THEN RAISE(ABORT, 'Journal entry does not balance')
      WHEN (SELECT COUNT(*) FROM journal_entry_lines WHERE journal_entry_ref = new.ref) < 2 
      THEN RAISE(ABORT, 'Journal entry must have at least 2 lines')
    END;
END; -- EOS

-- Update account balances when journal entry is posted
CREATE TRIGGER journal_entries_post_account_trigger
AFTER UPDATE OF post_time ON journal_entries FOR EACH ROW
WHEN old.post_time IS NULL AND new.post_time IS NOT NULL
BEGIN
  UPDATE accounts
  SET balance = balance + (
    SELECT COALESCE(SUM(
      CASE accounts.normal_balance
        WHEN 0 THEN jel.debit - jel.credit  -- Debit normal: add debits, subtract credits
        WHEN 1 THEN jel.credit - jel.debit  -- Credit normal: add credits, subtract debits
      END
    ), 0)
    FROM journal_entry_lines jel
    WHERE jel.journal_entry_ref = new.ref AND jel.account_code = accounts.account_code
  ),
  update_time = new.post_time
  WHERE accounts.account_code IN (
    SELECT DISTINCT account_code
    FROM journal_entry_lines
    WHERE journal_entry_ref = new.ref
  );
END; -- EOS

-- Prevent modification of posted journal entry lines
CREATE TRIGGER journal_entry_lines_update_prevention_trigger
BEFORE UPDATE ON journal_entry_lines FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN (SELECT post_time FROM journal_entries WHERE ref = old.journal_entry_ref) IS NOT NULL 
      THEN RAISE(ABORT, 'Cannot modify lines of posted journal entry')
    END;
END; -- EOS

-- Prevent deletion of posted journal entry lines
CREATE TRIGGER journal_entry_lines_delete_prevention_trigger
BEFORE DELETE ON journal_entry_lines FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN (SELECT post_time FROM journal_entries WHERE ref = old.journal_entry_ref) IS NOT NULL 
      THEN RAISE(ABORT, 'Cannot delete lines of posted journal entry')
    END;
END; -- EOS

-- Auto-number journal entry lines for easier insertion
CREATE VIEW journal_entry_lines_auto_number AS
SELECT
  jel.journal_entry_ref,
  jel.line_number,
  jel.account_code,
  jel.debit,
  jel.credit,
  jel.description,
  jel.reference
FROM journal_entry_lines jel; -- EOS

-- Auto-numbering trigger for journal entry lines
CREATE TRIGGER journal_entry_lines_auto_number_trigger
INSTEAD OF INSERT ON journal_entry_lines_auto_number FOR EACH ROW
BEGIN
  INSERT INTO journal_entry_lines (
    journal_entry_ref,
    line_number,
    account_code,
    debit,
    credit,
    description,
    reference
  )
  VALUES (
    new.journal_entry_ref,
    COALESCE(
      (SELECT MAX(line_number) + 1 FROM journal_entry_lines WHERE journal_entry_ref = new.journal_entry_ref),
      1
    ),
    new.account_code,
    COALESCE(new.debit, 0),
    COALESCE(new.credit, 0),
    new.description,
    new.reference
  );
END; -- EOS

-- Summary view for posted journal entries
CREATE VIEW journal_entry_summary AS
SELECT
  je.ref,
  je.entry_time,
  je.note,
  je.source_type,
  je.post_time,
  jel.line_number,
  jel.account_code,
  a.name AS account_name,
  jel.debit,
  jel.credit,
  jel.description,
  jel.reference
FROM journal_entry_lines jel
JOIN journal_entries je ON je.ref = jel.journal_entry_ref
JOIN accounts a ON a.account_code = jel.account_code
WHERE je.post_time IS NOT NULL
ORDER BY je.ref ASC, jel.line_number ASC; -- EOS

-- =================================================================
-- FISCAL YEAR MANAGEMENT
-- =================================================================

-- Fiscal year periods
CREATE TABLE fiscal_years (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  begin_time INTEGER NOT NULL UNIQUE,
  end_time INTEGER NOT NULL,
  post_time INTEGER,
  closing_journal_entry_ref INTEGER REFERENCES journal_entries (ref) ON UPDATE RESTRICT ON DELETE RESTRICT,
  reversal_time INTEGER,
  reversal_journal_entry_ref INTEGER REFERENCES journal_entries (ref) ON UPDATE RESTRICT ON DELETE RESTRICT,
  name TEXT, -- 'FY2024', 'Q1 2024', etc.
  CHECK (begin_time < end_time)
) STRICT; -- EOS

CREATE INDEX fiscal_years_begin_time_index ON fiscal_years (begin_time); -- EOS
CREATE INDEX fiscal_years_end_time_index ON fiscal_years (end_time); -- EOS
CREATE INDEX fiscal_years_begin_end_time_index ON fiscal_years (begin_time, end_time); -- EOS
CREATE INDEX fiscal_years_post_time_index ON fiscal_years (post_time) WHERE post_time IS NOT NULL; -- EOS
CREATE INDEX fiscal_years_reversal_time_begin_time_index ON fiscal_years (reversal_time, begin_time); -- EOS
CREATE INDEX fiscal_years_reversal_time_index ON fiscal_years (reversal_time) WHERE reversal_time IS NOT NULL; -- EOS

-- Fiscal year validation trigger
CREATE TRIGGER fiscal_years_insert_validation_trigger
BEFORE INSERT ON fiscal_years FOR EACH ROW
BEGIN
  -- Prevent overlapping fiscal years (excluding reversed fiscal years)
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1 FROM fiscal_years 
        WHERE reversal_time IS NULL
          AND (new.begin_time < end_time AND new.end_time > begin_time)
      ) THEN RAISE(ABORT, 'Fiscal year periods cannot overlap')
    END;
  
  -- Validate fiscal year duration (must be reasonable)
  SELECT
    CASE
      WHEN (new.end_time - new.begin_time) < (30 * 24 * 60 * 60 * 1000) -- Less than 30 days
      THEN RAISE(ABORT, 'Fiscal year must be at least 30 days')
      WHEN (new.end_time - new.begin_time) > (400 * 24 * 60 * 60 * 1000) -- More than 400 days
      THEN RAISE(ABORT, 'Fiscal year cannot exceed 400 days')
    END;
END; -- EOS

-- Prevent posting if there are unbalanced entries
CREATE TRIGGER fiscal_years_post_validation_trigger
BEFORE UPDATE OF post_time ON fiscal_years FOR EACH ROW
WHEN new.post_time IS NOT NULL AND old.post_time IS NULL
BEGIN
  SELECT
    CASE
      WHEN new.post_time <= 0 THEN RAISE(ABORT, 'Post time must be positive')
      WHEN EXISTS (
        SELECT 1 FROM journal_entries je
        LEFT JOIN journal_entry_lines jel ON jel.journal_entry_ref = je.ref
        WHERE je.entry_time > new.begin_time 
          AND je.entry_time <= new.end_time
          AND je.post_time IS NULL
      ) THEN RAISE(ABORT, 'Cannot close fiscal year with unposted journal entries')
    END;
END; -- EOS

-- Prevent unposting or changing the post_time of a posted fiscal year.
CREATE TRIGGER fiscal_years_post_time_immutability_trigger
BEFORE UPDATE OF post_time ON fiscal_years FOR EACH ROW
WHEN old.post_time IS NOT NULL AND (new.post_time IS NULL OR new.post_time != old.post_time)
BEGIN
  SELECT RAISE(ABORT, 'Cannot unpost or change post_time of a posted fiscal year');
END; -- EOS

-- Prevent deletion of closed or reversed fiscal years
CREATE TRIGGER fiscal_years_delete_prevention_trigger
BEFORE DELETE ON fiscal_years FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN old.closing_journal_entry_ref IS NOT NULL OR old.reversal_journal_entry_ref IS NOT NULL
      THEN RAISE(ABORT, 'Cannot delete closed or reversed fiscal year')
    END;
END; -- EOS

-- Validate reversal preconditions
CREATE TRIGGER fiscal_years_reversal_validation_trigger
BEFORE UPDATE OF reversal_time ON fiscal_years FOR EACH ROW
WHEN new.reversal_time IS NOT NULL AND old.reversal_time IS NULL
BEGIN
  -- Must be closed first
  SELECT
    CASE
      WHEN old.post_time IS NULL
      THEN RAISE(ABORT, 'Cannot reverse fiscal year that has not been closed')
    END;

  -- Cannot reverse if there are newer non-reversed fiscal years
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1 FROM fiscal_years
        WHERE id > old.id AND reversal_time IS NULL
      ) THEN RAISE(ABORT, 'Cannot reverse fiscal year: newer fiscal years exist')
    END;

  -- Validate reversal time
  SELECT
    CASE
      WHEN new.reversal_time <= old.post_time
      THEN RAISE(ABORT, 'Reversal time must be after post time')
    END;
END; -- EOS

-- Prevent changing reversal_time once set
CREATE TRIGGER fiscal_years_reversal_time_immutability_trigger
BEFORE UPDATE OF reversal_time ON fiscal_years FOR EACH ROW
WHEN old.reversal_time IS NOT NULL AND (new.reversal_time IS NULL OR new.reversal_time != old.reversal_time)
BEGIN
  SELECT RAISE(ABORT, 'Cannot change or remove reversal_time once set');
END; -- EOS

-- Create reversal journal entry when fiscal year is reversed
CREATE TRIGGER fiscal_years_reversal_trigger
AFTER UPDATE OF reversal_time ON fiscal_years FOR EACH ROW
WHEN new.reversal_time IS NOT NULL AND old.reversal_time IS NULL AND old.closing_journal_entry_ref IS NOT NULL
BEGIN
  -- Create reversal journal entry header
  INSERT INTO journal_entries (
    entry_time,
    note,
    source_type,
    created_by,
    reversal_of_ref
  ) VALUES (
    new.reversal_time,
    'Reversal of FY' || strftime('%Y', datetime(new.end_time, 'unixepoch')) || ' Closing Entry',
    'System',
    'System',
    old.closing_journal_entry_ref
  );

  -- Copy journal entry lines with swapped debits/credits
  INSERT INTO journal_entry_lines_auto_number (
    journal_entry_ref,
    account_code,
    debit,
    credit,
    description,
    reference
  )
  SELECT
    last_insert_rowid(),
    jel.account_code,
    jel.credit,  -- Swap: old credit becomes new debit
    jel.debit,   -- Swap: old debit becomes new credit
    'Reversal: ' || COALESCE(jel.description, ''),
    jel.reference
  FROM journal_entry_lines jel
  WHERE jel.journal_entry_ref = old.closing_journal_entry_ref;

  -- Auto-post the reversal entry
  UPDATE journal_entries
  SET post_time = new.reversal_time
  WHERE ref = last_insert_rowid();

  -- Store reversal journal entry reference
  UPDATE fiscal_years
  SET reversal_journal_entry_ref = last_insert_rowid()
  WHERE id = new.id;
END; -- EOS

-- Account mutation view for fiscal year analysis
CREATE VIEW fiscal_year_account_mutation AS
SELECT
  fy.id AS fiscal_year_id,
  fy.begin_time,
  fy.end_time,
  a.account_code AS account_code,
  a.name AS account_name,
  a.normal_balance,
  COALESCE(SUM(jes.debit), 0) AS sum_of_debit,
  COALESCE(SUM(jes.credit), 0) AS sum_of_credit,
  COALESCE(SUM(
    CASE a.normal_balance
      WHEN 0 THEN jes.debit - jes.credit  -- Debit normal balance
      WHEN 1 THEN jes.credit - jes.debit  -- Credit normal balance
    END
  ), 0) AS net_change
FROM fiscal_years fy
CROSS JOIN accounts a
LEFT JOIN journal_entry_summary jes
  ON jes.entry_time > fy.begin_time
  AND jes.entry_time <= fy.end_time
  AND jes.account_code = a.account_code
GROUP BY fy.id, a.account_code
HAVING sum_of_debit != 0 OR sum_of_credit != 0; -- EOS

-- Automated fiscal year closing trigger
CREATE TRIGGER fiscal_years_closing_trigger
AFTER UPDATE OF post_time ON fiscal_years FOR EACH ROW
WHEN old.post_time IS NULL AND new.post_time IS NOT NULL
BEGIN
  -- Create comprehensive closing entry
  INSERT INTO journal_entries (entry_time, note, source_type, created_by)
  VALUES (
    new.end_time,
    'FY' || strftime('%Y', datetime(new.end_time, 'unixepoch')) || ' Closing Entry',
    'System',
    'System'
  );

  -- Revenue closing entries: debit revenue accounts to zero their period balance
  -- Calculate the balance change during the fiscal year period (exclusive begin, inclusive end)
  -- net_change > 0 means credit balance (for credit-normal accounts) or debit balance (for debit-normal)
  -- To close: create the opposite entry
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit)
  SELECT
    last_insert_rowid(),
    period_change.account_code,
    -- If net_change > 0, we need to debit to offset the credit balance
    -- If net_change < 0, we need to credit to offset the debit balance
    CASE WHEN period_change.net_change > 0 THEN period_change.net_change ELSE 0 END,
    CASE WHEN period_change.net_change < 0 THEN ABS(period_change.net_change) ELSE 0 END
  FROM (
    SELECT
      jes.account_code,
      COALESCE(SUM(
        CASE a2.normal_balance
          WHEN 0 THEN jes.debit - jes.credit  -- Debit normal balance
          WHEN 1 THEN jes.credit - jes.debit  -- Credit normal balance
        END
      ), 0) AS net_change
    FROM journal_entry_summary jes
    JOIN accounts a2 ON a2.account_code = jes.account_code
    WHERE jes.entry_time > new.begin_time
      AND jes.entry_time <= new.end_time
    GROUP BY jes.account_code
  ) period_change
  JOIN account_tags at ON at.account_code = period_change.account_code
  WHERE at.tag = 'Fiscal Year Closing - Revenue'
    AND period_change.net_change != 0;

  -- Expense closing entries: credit expense accounts to zero their period balance
  -- For debit-normal expense accounts: net_change > 0 means debit balance, need to credit to close
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit)
  SELECT
    last_insert_rowid(),
    period_change.account_code,
    CASE WHEN period_change.net_change < 0 THEN ABS(period_change.net_change) ELSE 0 END,
    CASE WHEN period_change.net_change > 0 THEN period_change.net_change ELSE 0 END
  FROM (
    SELECT
      jes.account_code,
      COALESCE(SUM(
        CASE a2.normal_balance
          WHEN 0 THEN jes.debit - jes.credit  -- Debit normal balance
          WHEN 1 THEN jes.credit - jes.debit  -- Credit normal balance
        END
      ), 0) AS net_change
    FROM journal_entry_summary jes
    JOIN accounts a2 ON a2.account_code = jes.account_code
    WHERE jes.entry_time > new.begin_time
      AND jes.entry_time <= new.end_time
    GROUP BY jes.account_code
  ) period_change
  JOIN account_tags at ON at.account_code = period_change.account_code
  WHERE at.tag = 'Fiscal Year Closing - Expense'
    AND period_change.net_change != 0;

  -- Dividend closing entries: credit dividend accounts to zero their period balance
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit)
  SELECT
    last_insert_rowid(),
    period_change.account_code,
    CASE WHEN period_change.net_change < 0 THEN ABS(period_change.net_change) ELSE 0 END,
    CASE WHEN period_change.net_change > 0 THEN period_change.net_change ELSE 0 END
  FROM (
    SELECT
      jes.account_code,
      COALESCE(SUM(
        CASE a2.normal_balance
          WHEN 0 THEN jes.debit - jes.credit  -- Debit normal balance
          WHEN 1 THEN jes.credit - jes.debit  -- Credit normal balance
        END
      ), 0) AS net_change
    FROM journal_entry_summary jes
    JOIN accounts a2 ON a2.account_code = jes.account_code
    WHERE jes.entry_time > new.begin_time
      AND jes.entry_time <= new.end_time
    GROUP BY jes.account_code
  ) period_change
  JOIN account_tags at ON at.account_code = period_change.account_code
  WHERE at.tag = 'Fiscal Year Closing - Dividend'
    AND period_change.net_change != 0;

  -- Calculate net income for retained earnings balancing
  -- Net income = Revenues - Expenses - Dividends
  INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit)
  SELECT
    last_insert_rowid(),
    re.account_code,
    CASE WHEN calc.net_income > 0 THEN 0 ELSE ABS(calc.net_income) END,
    CASE WHEN calc.net_income > 0 THEN calc.net_income ELSE 0 END
  FROM (
    SELECT
      COALESCE(SUM(
        CASE at.tag
          WHEN 'Fiscal Year Closing - Revenue' THEN COALESCE(period_change.net_change, 0)
          WHEN 'Fiscal Year Closing - Expense' THEN -COALESCE(period_change.net_change, 0)
          WHEN 'Fiscal Year Closing - Dividend' THEN -COALESCE(period_change.net_change, 0)
          ELSE 0
        END
      ), 0) AS net_income
    FROM account_tags at
    LEFT JOIN (
      SELECT
        jes.account_code,
        COALESCE(SUM(
          CASE a2.normal_balance
            WHEN 0 THEN jes.debit - jes.credit  -- Debit normal balance
            WHEN 1 THEN jes.credit - jes.debit  -- Credit normal balance
          END
        ), 0) AS net_change
      FROM journal_entry_summary jes
      JOIN accounts a2 ON a2.account_code = jes.account_code
      WHERE jes.entry_time > new.begin_time
        AND jes.entry_time <= new.end_time
      GROUP BY jes.account_code
    ) period_change ON period_change.account_code = at.account_code
    WHERE at.tag IN ('Fiscal Year Closing - Revenue', 'Fiscal Year Closing - Expense', 'Fiscal Year Closing - Dividend')
  ) calc
  CROSS JOIN (
    SELECT account_code as account_code 
    FROM accounts 
    WHERE account_code IN (SELECT account_code FROM account_tags WHERE tag = 'Fiscal Year Closing - Retained Earning')
    LIMIT 1
  ) re
  WHERE calc.net_income != 0;

  -- Post the closing entry if it has at least 2 lines, otherwise delete it
  UPDATE journal_entries
  SET post_time = new.end_time
  WHERE ref = last_insert_rowid()
    AND (SELECT COUNT(*) FROM journal_entry_lines WHERE journal_entry_ref = last_insert_rowid()) >= 2;

  DELETE FROM journal_entries
  WHERE ref = last_insert_rowid()
    AND (SELECT COUNT(*) FROM journal_entry_lines WHERE journal_entry_ref = last_insert_rowid()) < 2;

  -- Store closing journal entry reference if it exists
  UPDATE fiscal_years
  SET
    closing_journal_entry_ref = (
      SELECT ref FROM journal_entries
      WHERE ref = last_insert_rowid()
        AND EXISTS (SELECT 1 FROM journal_entry_lines WHERE journal_entry_ref = last_insert_rowid())
    )
  WHERE id = new.id
    AND closing_journal_entry_ref IS NULL;
END; -- EOS

-- =================================================================
-- FINANCIAL REPORTING TABLES
-- =================================================================

-- Balance report generation
CREATE TABLE balance_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_time INTEGER NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'Period End' CHECK (report_type IN ('Period End', 'Monthly', 'Quarterly', 'Annual', 'Ad Hoc')),
  fiscal_year_id INTEGER REFERENCES fiscal_years (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  name TEXT, -- Human-readable report name
  create_time INTEGER NOT NULL
) STRICT; -- EOS

CREATE INDEX balance_reports_report_time_index ON balance_reports (report_time); -- EOS
CREATE INDEX balance_reports_fiscal_year_index ON balance_reports (fiscal_year_id) WHERE fiscal_year_id IS NOT NULL; -- EOS
CREATE INDEX balance_reports_id_time_index ON balance_reports (id, report_time); -- EOS
CREATE INDEX balance_reports_type_time_index ON balance_reports (report_type, report_time); -- EOS

-- Trial balance line items
CREATE TABLE trial_balance_lines (
  balance_report_id INTEGER NOT NULL REFERENCES balance_reports (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  account_code INTEGER NOT NULL REFERENCES accounts (account_code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  debit INTEGER NOT NULL,
  credit INTEGER NOT NULL,
  PRIMARY KEY (balance_report_id, account_code),
  CHECK (debit >= 0 AND credit >= 0)
) STRICT, WITHOUT ROWID; -- EOS

CREATE INDEX trial_balance_lines_report_id_index ON trial_balance_lines (balance_report_id); -- EOS
CREATE INDEX trial_balance_lines_account_debit_credit_index ON trial_balance_lines (account_code, debit, credit); -- EOS

-- Trial balance view
CREATE VIEW trial_balance AS
SELECT
  br.id AS balance_report_id,
  br.report_time,
  br.report_type,
  br.name,
  tbl.account_code,
  a.name AS account_name,
  a.normal_balance,
  tbl.debit,
  tbl.credit
FROM balance_reports br
JOIN trial_balance_lines tbl ON tbl.balance_report_id = br.id
JOIN accounts a ON a.account_code = tbl.account_code
ORDER BY br.report_time DESC, tbl.account_code; -- EOS

-- Auto-generate trial balance when balance report is created
CREATE TRIGGER trial_balance_generation_trigger
AFTER INSERT ON balance_reports FOR EACH ROW
BEGIN
  INSERT INTO trial_balance_lines (
    balance_report_id,
    account_code,
    debit,
    credit
  )
  SELECT
    new.id,
    a.account_code,
    CASE 
      WHEN a.balance >= 0 AND a.normal_balance = 0 THEN a.balance  -- Debit normal, positive balance
      WHEN a.balance < 0 AND a.normal_balance = 1 THEN ABS(a.balance)  -- Credit normal, negative balance (shown as debit)
      ELSE 0
    END AS debit,
    CASE
      WHEN a.balance >= 0 AND a.normal_balance = 1 THEN a.balance  -- Credit normal, positive balance
      WHEN a.balance < 0 AND a.normal_balance = 0 THEN ABS(a.balance)  -- Debit normal, negative balance (shown as credit)
      ELSE 0 
    END AS credit
  FROM accounts a
  WHERE a.is_active = 1 OR a.balance != 0;
END; -- EOS

-- =================================================================
-- BALANCE SHEET REPORTING
-- =================================================================

-- Balance sheet line items
CREATE TABLE balance_sheet_lines (
  balance_report_id INTEGER NOT NULL REFERENCES balance_reports (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  account_code INTEGER NOT NULL REFERENCES accounts (account_code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  classification TEXT NOT NULL CHECK (classification IN ('Assets', 'Liabilities', 'Equity')),
  category TEXT NOT NULL CHECK (category IN (
    'Current Assets', 'Non-Current Assets',
    'Current Liabilities', 'Non-Current Liabilities',
    'Equity'
  )),
  amount INTEGER NOT NULL,
  PRIMARY KEY (balance_report_id, account_code)
) STRICT, WITHOUT ROWID; -- EOS

CREATE INDEX balance_sheet_lines_report_id_index ON balance_sheet_lines (balance_report_id); -- EOS
CREATE INDEX balance_sheet_lines_classification_category_index ON balance_sheet_lines (classification, category, account_code); -- EOS
CREATE INDEX balance_sheet_lines_report_classification_index ON balance_sheet_lines (balance_report_id, classification, category); -- EOS

-- Balance sheet view
CREATE VIEW balance_sheet AS
SELECT
  br.id AS balance_report_id,
  br.report_time,
  br.report_type,
  br.name,
  bsl.classification,
  bsl.category,
  bsl.account_code,
  a.name AS account_name,
  bsl.amount
FROM balance_reports br
JOIN balance_sheet_lines bsl ON bsl.balance_report_id = br.id
JOIN accounts a ON a.account_code = bsl.account_code
ORDER BY br.report_time DESC, bsl.classification, bsl.category, bsl.account_code; -- EOS

-- Auto-generate balance sheet when balance report is created
CREATE TRIGGER balance_sheet_generation_trigger
AFTER INSERT ON balance_reports FOR EACH ROW
BEGIN
  INSERT INTO balance_sheet_lines (
    balance_report_id,
    account_code,
    classification,
    category,
    amount
  )
  SELECT
    new.id,
    a.account_code,
    CASE
      WHEN at.tag IN ('Balance Sheet - Current Asset', 'Balance Sheet - Non-Current Asset') THEN 'Assets'
      WHEN at.tag IN ('Balance Sheet - Current Liability', 'Balance Sheet - Non-Current Liability') THEN 'Liabilities'
      WHEN at.tag = 'Balance Sheet - Equity' THEN 'Equity'
    END AS classification,
    CASE
      WHEN at.tag = 'Balance Sheet - Current Asset' THEN 'Current Assets'
      WHEN at.tag = 'Balance Sheet - Non-Current Asset' THEN 'Non-Current Assets'
      WHEN at.tag = 'Balance Sheet - Current Liability' THEN 'Current Liabilities'
      WHEN at.tag = 'Balance Sheet - Non-Current Liability' THEN 'Non-Current Liabilities'
      WHEN at.tag = 'Balance Sheet - Equity' THEN 'Equity'
    END AS category,
    a.balance AS amount
  FROM accounts a
  JOIN account_tags at ON at.account_code = a.account_code
  WHERE (a.is_active = 1 OR a.balance != 0)
    AND at.tag IN (
      'Balance Sheet - Current Asset', 'Balance Sheet - Non-Current Asset',
      'Balance Sheet - Current Liability', 'Balance Sheet - Non-Current Liability',
      'Balance Sheet - Equity'
    )
  ORDER BY a.account_code ASC;
END; -- EOS

-- =================================================================
-- INCOME STATEMENT REPORTING
-- =================================================================

-- Income statement view (based on fiscal year mutations)
CREATE VIEW income_statement AS
SELECT
  CASE
    WHEN at.tag IN ('Income Statement - Revenue', 'Income Statement - Contra Revenue', 'Income Statement - Other Revenue') THEN 'Revenue'
    WHEN at.tag IN ('Income Statement - COGS') THEN 'Cost of Goods Sold'
    WHEN at.tag IN ('Income Statement - Expense', 'Income Statement - Other Expense') THEN 'Expenses'
    ELSE 'Other' -- Catch-all for any other tags
  END AS classification,
  CASE
    WHEN at.tag = 'Income Statement - Revenue' THEN 'Revenue'
    WHEN at.tag = 'Income Statement - Contra Revenue' THEN 'Contra Revenue'
    WHEN at.tag = 'Income Statement - Other Revenue' THEN 'Other Revenue'
    WHEN at.tag = 'Income Statement - COGS' THEN 'Cost of Goods Sold'
    WHEN at.tag = 'Income Statement - Expense' THEN 'Operating Expenses'
    WHEN at.tag = 'Income Statement - Other Expense' THEN 'Other Expenses'
  END AS category,
  fyam.account_code,
  fyam.account_name,
  fyam.net_change AS amount,
  fyam.fiscal_year_id,
  fyam.begin_time,
  fyam.end_time,
  fy.name AS fiscal_year_name
FROM fiscal_year_account_mutation fyam
JOIN account_tags at ON at.account_code = fyam.account_code
JOIN fiscal_years fy ON fy.id = fyam.fiscal_year_id
WHERE fyam.net_change != 0
  AND at.tag IN (
    'Income Statement - Revenue',
    'Income Statement - Contra Revenue',
    'Income Statement - Other Revenue',
    'Income Statement - COGS',
    'Income Statement - Expense',
    'Income Statement - Other Expense'
  )
ORDER BY fyam.fiscal_year_id DESC, classification, category, fyam.account_code; -- EOS

-- =================================================================
-- CASH FLOW STATEMENT REPORTING
-- =================================================================

-- Cash flow reporting tables
CREATE TABLE cashflow_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_time INTEGER NOT NULL,
  begin_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  fiscal_year_id INTEGER REFERENCES fiscal_years (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  name TEXT,
  create_time INTEGER NOT NULL,
  CHECK (begin_time < end_time)
) STRICT; -- EOS

CREATE TABLE cashflow_statement_lines (
  cashflow_report_id INTEGER NOT NULL REFERENCES cashflow_reports (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('Operating', 'Investing', 'Financing')),
  line_description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  PRIMARY KEY (cashflow_report_id, activity_type, line_description)
) STRICT, WITHOUT ROWID; -- EOS

CREATE INDEX cashflow_statement_lines_report_id_index ON cashflow_statement_lines (cashflow_report_id); -- EOS
CREATE INDEX cashflow_statement_lines_activity_index ON cashflow_statement_lines (activity_type, line_description); -- EOS
CREATE INDEX cashflow_reports_time_range_index ON cashflow_reports (report_time, begin_time, end_time); -- EOS

-- Cash flow statement view
CREATE VIEW cashflow_statement AS
SELECT
  cr.id AS cashflow_report_id,
  cr.report_time,
  cr.begin_time,
  cr.end_time,
  cr.name,
  csl.activity_type,
  csl.line_description,
  csl.amount
FROM cashflow_reports cr
JOIN cashflow_statement_lines csl ON csl.cashflow_report_id = cr.id
ORDER BY cr.report_time DESC,
  CASE csl.activity_type
    WHEN 'Operating' THEN 1
    WHEN 'Investing' THEN 2
    WHEN 'Financing' THEN 3
  END,
  csl.line_description; -- EOS

INSERT INTO config (key, value, create_time, update_time) VALUES ('Schema Version', '001-accounting', 0, 0); -- EOS
