-- =================================================================
-- Fixed Assets Database Migration Script
-- Version: 1.0
-- Date: 2026-01-03
-- SQLite Version: 3.43.0
-- Dependencies: 001-accounting.sql
-- 
-- This script extends the accounting schema with fixed asset management.
-- Database Features:
-- - Fixed asset acquisition tracking
-- - Straight-line depreciation calculation
-- - Automated acquisition journal entries
-- - Automated depreciation posting on fiscal year close
-- - Full accounting integration
-- 
-- Migration Features:
-- - ACID transaction boundary
-- - Performance-optimized indexes
-- - Each top-level statement is followed by end-of-statement (EOS) marker
-- =================================================================

-- =================================================================
-- FIXED ASSETS MASTER
-- =================================================================

-- Fixed assets register with depreciation tracking
CREATE TABLE fixed_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Asset value information
  acquisition_time INTEGER NOT NULL, -- Milliseconds since Unix epoch
  acquisition_cost INTEGER NOT NULL CHECK (acquisition_cost > 0),
  useful_life_years INTEGER NOT NULL CHECK (useful_life_years > 0),
  salvage_value INTEGER NOT NULL DEFAULT 0 CHECK (salvage_value >= 0),
  
  -- Depreciation tracking
  accumulated_depreciation INTEGER NOT NULL DEFAULT 0 CHECK (accumulated_depreciation >= 0),
  is_fully_depreciated INTEGER GENERATED ALWAYS AS (
    accumulated_depreciation >= (acquisition_cost - salvage_value)
  ) VIRTUAL,
  
  -- Accounting integration
  asset_account_code INTEGER NOT NULL REFERENCES accounts (account_code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  accumulated_depreciation_account_code INTEGER NOT NULL REFERENCES accounts (account_code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  depreciation_expense_account_code INTEGER NOT NULL REFERENCES accounts (account_code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  payment_account_code INTEGER NOT NULL REFERENCES accounts (account_code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  
  create_time INTEGER NOT NULL,
  update_time INTEGER NOT NULL,
  
  CHECK (acquisition_cost > salvage_value),
  CHECK (asset_account_code != accumulated_depreciation_account_code),
  CHECK (asset_account_code != depreciation_expense_account_code),
  CHECK (accumulated_depreciation_account_code != depreciation_expense_account_code)
) STRICT; -- EOS

CREATE INDEX fixed_assets_acquisition_time_index ON fixed_assets (acquisition_time); -- EOS
CREATE INDEX fixed_assets_fully_depreciated_index ON fixed_assets (is_fully_depreciated) WHERE is_fully_depreciated = 0; -- EOS
CREATE INDEX fixed_assets_asset_account_index ON fixed_assets (asset_account_code); -- EOS

-- =================================================================
-- FIXED ASSET VALIDATION TRIGGERS
-- =================================================================

-- Validate acquisition cost > salvage value
CREATE TRIGGER fixed_assets_cost_validation_trigger
BEFORE INSERT ON fixed_assets FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN NEW.acquisition_time <= 0 THEN RAISE(ABORT, 'Acquisition time must be positive')
      WHEN NEW.acquisition_cost <= NEW.salvage_value THEN RAISE(ABORT, 'Acquisition cost must be greater than salvage value')
    END;
END; -- EOS

-- Prevent modification of posted fixed assets
CREATE TRIGGER fixed_assets_update_prevention_trigger
BEFORE UPDATE OF acquisition_cost, useful_life_years, salvage_value ON fixed_assets FOR EACH ROW
WHEN OLD.accumulated_depreciation > 0
BEGIN
  SELECT RAISE(ABORT, 'Cannot modify cost parameters of asset with accumulated depreciation');
END; -- EOS

-- Prevent deletion of fixed assets with accumulated depreciation
CREATE TRIGGER fixed_assets_delete_prevention_trigger
BEFORE DELETE ON fixed_assets FOR EACH ROW
WHEN OLD.accumulated_depreciation > 0
BEGIN
  SELECT RAISE(ABORT, 'Cannot delete fixed asset with accumulated depreciation');
END; -- EOS

-- =================================================================
-- FIXED ASSET ACQUISITION AUTOMATION
-- =================================================================

-- Automatically create and post acquisition journal entry
CREATE TRIGGER fixed_assets_acquisition_trigger
AFTER INSERT ON fixed_assets FOR EACH ROW
BEGIN
  -- Create journal entry header (unposted)
  INSERT INTO journal_entries (
    entry_time,
    note,
    source_type,
    source_reference,
    created_by
  ) VALUES (
    NEW.acquisition_time,
    'Asset Acquisition: ' || NEW.name,
    'System',
    'FixedAsset:' || NEW.id,
    'System'
  );

  -- Debit: Fixed Asset Account (increase asset)
  INSERT INTO journal_entry_lines_auto_number (
    journal_entry_ref,
    account_code,
    debit,
    credit,
    description,
    reference
  ) VALUES (
    last_insert_rowid(),
    NEW.asset_account_code,
    NEW.acquisition_cost,
    0,
    'Acquisition of ' || NEW.name,
    'FixedAsset:' || NEW.id
  );

  -- Credit: Payment Account (decrease cash/bank or increase payable)
  INSERT INTO journal_entry_lines_auto_number (
    journal_entry_ref,
    account_code,
    debit,
    credit,
    description,
    reference
  ) VALUES (
    last_insert_rowid(),
    NEW.payment_account_code,
    0,
    NEW.acquisition_cost,
    'Payment for ' || NEW.name,
    'FixedAsset:' || NEW.id
  );

  -- Post the journal entry (triggers account balance updates)
  UPDATE journal_entries
  SET post_time = NEW.acquisition_time
  WHERE ref = last_insert_rowid();
END; -- EOS

-- =================================================================
-- FISCAL YEAR DEPRECIATION AUTOMATION
-- =================================================================

-- Calculate and post depreciation when fiscal year is closed
CREATE TRIGGER fiscal_years_depreciation_trigger
BEFORE UPDATE OF post_time ON fiscal_years FOR EACH ROW
WHEN OLD.post_time IS NULL AND NEW.post_time IS NOT NULL
BEGIN
  -- Create depreciation journal entry header
  INSERT INTO journal_entries (
    entry_time,
    note,
    fiscal_year_begin_time,
    source_type,
    created_by
  ) VALUES (
    NEW.end_time,
    'FY Depreciation Expense',
    NEW.begin_time,
    'System',
    'System'
  );

  -- Insert depreciation expense lines (one debit and one credit per asset)
  -- Straight-line depreciation: (Cost - Salvage) / Useful Life
  -- Capped at remaining depreciable amount
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
    fa.depreciation_expense_account_code,
    depreciation_amount,
    0,
    'Depreciation: ' || fa.name,
    'FixedAsset:' || fa.id
  FROM fixed_assets fa
  CROSS JOIN (
    SELECT
      fa.id as asset_id,
      MIN(
        (fa.acquisition_cost - fa.salvage_value) / fa.useful_life_years,
        (fa.acquisition_cost - fa.salvage_value) - fa.accumulated_depreciation
      ) as depreciation_amount
    FROM fixed_assets fa
    WHERE fa.is_fully_depreciated = 0
      AND fa.acquisition_time <= NEW.end_time
  ) calc ON calc.asset_id = fa.id
  WHERE calc.depreciation_amount > 0;

  -- Insert accumulated depreciation credit lines (contra asset)
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
    fa.accumulated_depreciation_account_code,
    0,
    depreciation_amount,
    'Accumulated Depreciation: ' || fa.name,
    'FixedAsset:' || fa.id
  FROM fixed_assets fa
  CROSS JOIN (
    SELECT
      fa.id as asset_id,
      MIN(
        (fa.acquisition_cost - fa.salvage_value) / fa.useful_life_years,
        (fa.acquisition_cost - fa.salvage_value) - fa.accumulated_depreciation
      ) as depreciation_amount
    FROM fixed_assets fa
    WHERE fa.is_fully_depreciated = 0
      AND fa.acquisition_time <= NEW.end_time
  ) calc ON calc.asset_id = fa.id
  WHERE calc.depreciation_amount > 0;

  -- Post the depreciation journal entry if it has lines
  UPDATE journal_entries
  SET post_time = NEW.end_time
  WHERE ref = last_insert_rowid()
    AND EXISTS (
      SELECT 1 FROM journal_entry_lines
      WHERE journal_entry_ref = last_insert_rowid()
    );

  -- Delete entry if no depreciation lines were created
  DELETE FROM journal_entries
  WHERE ref = last_insert_rowid()
    AND NOT EXISTS (
      SELECT 1 FROM journal_entry_lines
      WHERE journal_entry_ref = last_insert_rowid()
    );

  -- Update accumulated depreciation on fixed assets
  UPDATE fixed_assets
  SET
    accumulated_depreciation = accumulated_depreciation + (
      SELECT MIN(
        (acquisition_cost - salvage_value) / useful_life_years,
        (acquisition_cost - salvage_value) - accumulated_depreciation
      )
    ),
    update_time = NEW.end_time
  WHERE is_fully_depreciated = 0
    AND acquisition_time <= NEW.end_time;
END; -- EOS

UPDATE config SET value = '005-fixed-assets' WHERE key = 'Schema Version'; -- EOS