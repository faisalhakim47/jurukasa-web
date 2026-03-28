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

CREATE TABLE fixed_asset_internal_flags (
  key TEXT PRIMARY KEY CHECK (key IN ('mutation_guard')),
  value INTEGER NOT NULL CHECK (value >= 0)
) STRICT, WITHOUT ROWID; -- EOS

INSERT INTO fixed_asset_internal_flags (key, value) VALUES ('mutation_guard', 0); -- EOS

-- Fixed assets register with depreciation tracking
CREATE TABLE fixed_assets (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  note TEXT,
  
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
  journal_entry_ref INTEGER NOT NULL REFERENCES journal_entries (ref),
  
  create_time INTEGER NOT NULL,
  update_time INTEGER NOT NULL,
  
  CHECK (acquisition_cost > salvage_value),
  CHECK (asset_account_code != accumulated_depreciation_account_code),
  CHECK (asset_account_code != depreciation_expense_account_code),
  CHECK (accumulated_depreciation_account_code != depreciation_expense_account_code),
  CHECK (payment_account_code != asset_account_code),
  CHECK (payment_account_code != accumulated_depreciation_account_code),
  CHECK (payment_account_code != depreciation_expense_account_code)
) STRICT; -- EOS

CREATE INDEX fixed_assets_acquisition_time_index ON fixed_assets (acquisition_time); -- EOS
CREATE INDEX fixed_assets_fully_depreciated_index ON fixed_assets (is_fully_depreciated) WHERE is_fully_depreciated = 0; -- EOS
CREATE INDEX fixed_assets_asset_account_index ON fixed_assets (asset_account_code); -- EOS

ALTER TABLE journal_entries ADD COLUMN fixed_asset_id INTEGER REFERENCES fixed_assets (id) ON DELETE SET NULL; -- EOS
CREATE UNIQUE INDEX journal_entries_fixed_asset_id_index ON journal_entries (fixed_asset_id) WHERE fixed_asset_id IS NOT NULL; -- EOS
CREATE TRIGGER journal_entries_posted_fixed_asset_link_update_prevention_trigger
BEFORE UPDATE OF fixed_asset_id ON journal_entries FOR EACH ROW
WHEN OLD.post_time IS NOT NULL AND OLD.fixed_asset_id IS NOT NEW.fixed_asset_id
BEGIN
  SELECT RAISE(ABORT, 'Cannot modify posted journal entry');
END; -- EOS

-- Extend POS inventory protection trigger to also allow fixed asset journal entries
-- (The base trigger in 002-pos.sql only checks purchase_id, sale_id, stock_taking_id)
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

ALTER TABLE fiscal_years ADD COLUMN depreciation_journal_entry_ref INTEGER; -- EOS
-- Note: No FK constraint because this column is managed by a BEFORE trigger
-- that cannot reliably NULL the ref when the JE is deleted (outer UPDATE overwrites)
ALTER TABLE fiscal_years ADD COLUMN depreciation_reversal_journal_entry_ref INTEGER REFERENCES journal_entries (ref) ON UPDATE RESTRICT ON DELETE RESTRICT; -- EOS

-- =================================================================
-- FIXED ASSET VALIDATION TRIGGERS
-- =================================================================

-- Validate acquisition cost > salvage value
CREATE TRIGGER fixed_assets_cost_validation_trigger
BEFORE INSERT ON fixed_assets FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN NEW.journal_entry_ref IS NULL THEN RAISE(ABORT, 'journal_entry_ref is required when creating a fixed asset')
      WHEN NEW.acquisition_time <= 0 THEN RAISE(ABORT, 'Acquisition time must be positive')
      WHEN NEW.acquisition_cost <= NEW.salvage_value THEN RAISE(ABORT, 'Acquisition cost must be greater than salvage value')
    END;
END; -- EOS

CREATE TRIGGER fixed_assets_system_managed_fields_update_prevention_trigger
BEFORE UPDATE OF accumulated_depreciation, update_time ON fixed_assets FOR EACH ROW
WHEN (SELECT value FROM fixed_asset_internal_flags WHERE key = 'mutation_guard') = 0
BEGIN
  SELECT RAISE(ABORT, 'Cannot manually update fixed_assets.accumulated_depreciation or update_time; use fiscal year close/reversal workflows');
END; -- EOS

-- Prevent acquiring assets in closed fiscal years
-- Uses (begin_time, end_time] convention (exclusive begin, inclusive end) consistent with
-- fiscal year closing, income statement, and cash flow period boundaries.
CREATE TRIGGER fixed_assets_period_validation_trigger
BEFORE INSERT ON fixed_assets FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1 FROM fiscal_years
        WHERE post_time IS NOT NULL
          AND reversal_time IS NULL
          AND NEW.acquisition_time > begin_time
          AND NEW.acquisition_time <= end_time
      ) THEN RAISE(ABORT, 'Cannot acquire asset in a closed fiscal year')
    END;
END; -- EOS

-- Prevent modification of posted fixed assets
CREATE TRIGGER fixed_assets_update_prevention_trigger
BEFORE UPDATE OF
  name,
  note,
  acquisition_time,
  acquisition_cost,
  useful_life_years,
  salvage_value,
  asset_account_code,
  accumulated_depreciation_account_code,
  depreciation_expense_account_code,
  payment_account_code,
  journal_entry_ref,
  create_time
ON fixed_assets FOR EACH ROW
WHEN OLD.accumulated_depreciation > 0 OR EXISTS (
  SELECT 1 FROM journal_entries
  WHERE fixed_asset_id = OLD.id
    AND post_time IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'Cannot modify fixed asset with posted acquisition history');
END; -- EOS

-- Prevent deletion of fixed assets with accumulated depreciation
CREATE TRIGGER fixed_assets_delete_prevention_trigger
BEFORE DELETE ON fixed_assets FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN OLD.accumulated_depreciation > 0 THEN RAISE(ABORT, 'Cannot delete fixed asset with accumulated depreciation')
      WHEN EXISTS (
        SELECT 1 FROM journal_entries
        WHERE fixed_asset_id = OLD.id
          AND post_time IS NOT NULL
      ) THEN RAISE(ABORT, 'Cannot delete fixed asset with posted acquisition history')
    END;
END; -- EOS

-- =================================================================
-- FIXED ASSET ACQUISITION AUTOMATION
-- =================================================================

-- Automatically create and post acquisition journal entry
CREATE TRIGGER fixed_assets_acquisition_trigger
AFTER INSERT ON fixed_assets FOR EACH ROW
BEGIN
  -- Create journal entry header using app-provided ref
  INSERT INTO journal_entries (
    ref,
    entry_time,
    fixed_asset_id
  ) VALUES (
    NEW.journal_entry_ref,
    NEW.acquisition_time,
    NEW.id
  );

  -- Debit: Fixed Asset Account (increase asset)
  INSERT INTO journal_entry_lines_auto_number (
    journal_entry_ref,
    account_code,
    debit,
    credit,
    note
  ) VALUES (
    NEW.journal_entry_ref,
    NEW.asset_account_code,
    NEW.acquisition_cost,
    0,
    'Acquisition of ' || NEW.name
  );

  -- Credit: Payment Account (decrease cash/bank or increase payable)
  INSERT INTO journal_entry_lines_auto_number (
    journal_entry_ref,
    account_code,
    debit,
    credit,
    note,
    cashflow_activity,
    cashflow_category
  ) VALUES (
    NEW.journal_entry_ref,
    NEW.payment_account_code,
    0,
    NEW.acquisition_cost,
    'Payment for ' || NEW.name,
    CASE WHEN EXISTS(SELECT 1 FROM account_tags WHERE account_code = NEW.payment_account_code AND tag = 'Cash Flow - Cash Equivalents') THEN 2 ELSE NULL END,
    CASE WHEN EXISTS(SELECT 1 FROM account_tags WHERE account_code = NEW.payment_account_code AND tag = 'Cash Flow - Cash Equivalents') THEN 5 ELSE NULL END
  );

  -- Post the journal entry (triggers account balance updates)
  UPDATE journal_entries
  SET post_time = NEW.acquisition_time
  WHERE ref = NEW.journal_entry_ref;
END; -- EOS

-- =================================================================
-- FISCAL YEAR DEPRECIATION AUTOMATION
-- =================================================================

-- Calculate and post depreciation when fiscal year is closed
CREATE TRIGGER fiscal_years_depreciation_trigger
BEFORE UPDATE OF post_time ON fiscal_years FOR EACH ROW
WHEN OLD.post_time IS NULL AND NEW.post_time IS NOT NULL
BEGIN
  SELECT
    CASE
      WHEN NEW.depreciation_journal_entry_ref IS NULL AND EXISTS (
        SELECT 1
        FROM fixed_assets fa
        WHERE fa.is_fully_depreciated = 0
          AND fa.acquisition_time <= NEW.end_time
          AND MAX(
            CAST(
              MIN(
                ROUND(
                  CAST(fa.acquisition_cost - fa.salvage_value AS REAL) *
                  MIN(
                    MAX(CAST(NEW.end_time - fa.acquisition_time AS REAL), 0.0),
                    CAST(fa.useful_life_years * 365 * 24 * 60 * 60 * 1000 AS REAL)
                  ) /
                  CAST(fa.useful_life_years * 365 * 24 * 60 * 60 * 1000 AS REAL)
                ),
                CAST(fa.acquisition_cost - fa.salvage_value AS REAL)
              ) AS INTEGER
            ) - fa.accumulated_depreciation,
            0
          ) > 0
      ) THEN RAISE(ABORT, 'depreciation_journal_entry_ref is required when depreciation will be posted')
    END;

  -- Create depreciation journal entry header using app-provided ref
  INSERT INTO journal_entries (
    ref,
    entry_time
  ) SELECT
    NEW.depreciation_journal_entry_ref,
    NEW.end_time
  WHERE EXISTS (
    SELECT 1
    FROM fixed_assets fa
    WHERE fa.is_fully_depreciated = 0
      AND fa.acquisition_time <= NEW.end_time
      AND MAX(
        CAST(
          MIN(
            ROUND(
              CAST(fa.acquisition_cost - fa.salvage_value AS REAL) *
              MIN(
                MAX(CAST(NEW.end_time - fa.acquisition_time AS REAL), 0.0),
                CAST(fa.useful_life_years * 365 * 24 * 60 * 60 * 1000 AS REAL)
              ) /
              CAST(fa.useful_life_years * 365 * 24 * 60 * 60 * 1000 AS REAL)
            ),
            CAST(fa.acquisition_cost - fa.salvage_value AS REAL)
          ) AS INTEGER
        ) - fa.accumulated_depreciation,
        0
      ) > 0
  );

  -- Insert depreciation expense and accumulated depreciation lines per asset
  -- Straight-line depreciation: (Cost - Salvage) / Useful Life
  -- Capped at remaining depreciable amount
  INSERT INTO journal_entry_lines_auto_number (
    journal_entry_ref,
    account_code,
    debit,
    credit,
    note
  )
  SELECT
    NEW.depreciation_journal_entry_ref,
    account_code,
    debit,
    credit,
    note
  FROM (
    -- Depreciation expense debit lines
    SELECT
      fa.depreciation_expense_account_code AS account_code,
      calc.depreciation_amount AS debit,
      0 AS credit,
      'Depreciation: ' || fa.name AS note,
      fa.id AS sort_key,
      0 AS line_order
    FROM fixed_assets fa
    INNER JOIN (
      SELECT
        fa2.id AS asset_id,
        MAX(
          CAST(
            MIN(
              ROUND(
                CAST(fa2.acquisition_cost - fa2.salvage_value AS REAL) *
                MIN(
                  MAX(CAST(NEW.end_time - fa2.acquisition_time AS REAL), 0.0),
                  CAST(fa2.useful_life_years * 365 * 24 * 60 * 60 * 1000 AS REAL)
                ) /
                CAST(fa2.useful_life_years * 365 * 24 * 60 * 60 * 1000 AS REAL)
              ),
              CAST(fa2.acquisition_cost - fa2.salvage_value AS REAL)
            ) AS INTEGER
          ) - fa2.accumulated_depreciation,
          0
        ) AS depreciation_amount
      FROM fixed_assets fa2
      WHERE fa2.is_fully_depreciated = 0
        AND fa2.acquisition_time <= NEW.end_time
    ) calc ON calc.asset_id = fa.id
    WHERE calc.depreciation_amount > 0
    UNION ALL
    -- Accumulated depreciation credit lines
    SELECT
      fa.accumulated_depreciation_account_code AS account_code,
      0 AS debit,
      calc.depreciation_amount AS credit,
      'Accumulated Depreciation: ' || fa.name AS note,
      fa.id AS sort_key,
      1 AS line_order
    FROM fixed_assets fa
    INNER JOIN (
      SELECT
        fa2.id AS asset_id,
        MAX(
          CAST(
            MIN(
              ROUND(
                CAST(fa2.acquisition_cost - fa2.salvage_value AS REAL) *
                MIN(
                  MAX(CAST(NEW.end_time - fa2.acquisition_time AS REAL), 0.0),
                  CAST(fa2.useful_life_years * 365 * 24 * 60 * 60 * 1000 AS REAL)
                ) /
                CAST(fa2.useful_life_years * 365 * 24 * 60 * 60 * 1000 AS REAL)
              ),
              CAST(fa2.acquisition_cost - fa2.salvage_value AS REAL)
            ) AS INTEGER
          ) - fa2.accumulated_depreciation,
          0
        ) AS depreciation_amount
      FROM fixed_assets fa2
      WHERE fa2.is_fully_depreciated = 0
        AND fa2.acquisition_time <= NEW.end_time
    ) calc ON calc.asset_id = fa.id
    WHERE calc.depreciation_amount > 0
    ORDER BY sort_key, line_order
  );

  -- Post the depreciation journal entry if it has lines
  UPDATE journal_entries
  SET post_time = NEW.end_time
  WHERE ref = NEW.depreciation_journal_entry_ref
    AND EXISTS (
      SELECT 1 FROM journal_entry_lines
      WHERE journal_entry_ref = NEW.depreciation_journal_entry_ref
    );

  -- Delete entry if no depreciation lines were created
  DELETE FROM journal_entries
  WHERE ref = NEW.depreciation_journal_entry_ref
    AND NOT EXISTS (
      SELECT 1 FROM journal_entry_lines
      WHERE journal_entry_ref = NEW.depreciation_journal_entry_ref
    );

  -- Update accumulated depreciation on fixed assets
  UPDATE fixed_asset_internal_flags
  SET value = value + 1
  WHERE key = 'mutation_guard';

  UPDATE fixed_assets
  SET
    accumulated_depreciation = accumulated_depreciation + (
      SELECT MAX(
        CAST(
          MIN(
            ROUND(
              CAST(acquisition_cost - salvage_value AS REAL) *
              MIN(
                MAX(CAST(NEW.end_time - acquisition_time AS REAL), 0.0),
                CAST(useful_life_years * 365 * 24 * 60 * 60 * 1000 AS REAL)
              ) /
              CAST(useful_life_years * 365 * 24 * 60 * 60 * 1000 AS REAL)
            ),
            CAST(acquisition_cost - salvage_value AS REAL)
          ) AS INTEGER
        ) - accumulated_depreciation,
        0
      )
    ),
    update_time = NEW.end_time
  WHERE is_fully_depreciated = 0
    AND acquisition_time <= NEW.end_time
    AND (
      SELECT MAX(
        CAST(
          MIN(
            ROUND(
              CAST(acquisition_cost - salvage_value AS REAL) *
              MIN(
                MAX(CAST(NEW.end_time - acquisition_time AS REAL), 0.0),
                CAST(useful_life_years * 365 * 24 * 60 * 60 * 1000 AS REAL)
              ) /
              CAST(useful_life_years * 365 * 24 * 60 * 60 * 1000 AS REAL)
            ),
            CAST(acquisition_cost - salvage_value AS REAL)
          ) AS INTEGER
        ) - accumulated_depreciation,
        0
      )
    ) > 0;

  UPDATE fixed_asset_internal_flags
  SET value = value - 1
  WHERE key = 'mutation_guard';
END; -- EOS

CREATE TRIGGER fiscal_years_depreciation_cleanup_trigger
AFTER UPDATE OF post_time ON fiscal_years FOR EACH ROW
WHEN OLD.post_time IS NULL AND NEW.post_time IS NOT NULL
BEGIN
  UPDATE fiscal_years
  SET depreciation_journal_entry_ref = NULL
  WHERE id = NEW.id
    AND NEW.depreciation_journal_entry_ref IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM journal_entries
      WHERE ref = NEW.depreciation_journal_entry_ref
    );
END; -- EOS

CREATE TRIGGER fiscal_years_depreciation_reversal_validation_trigger
BEFORE UPDATE OF reversal_time ON fiscal_years FOR EACH ROW
WHEN NEW.reversal_time IS NOT NULL AND OLD.reversal_time IS NULL
BEGIN
  SELECT
    CASE
      WHEN OLD.depreciation_journal_entry_ref IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM journal_entries
          WHERE ref = OLD.depreciation_journal_entry_ref
            AND post_time IS NOT NULL
        )
        AND NEW.depreciation_reversal_journal_entry_ref IS NULL
      THEN RAISE(ABORT, 'depreciation_reversal_journal_entry_ref is required when reversing posted depreciation')
    END;
END; -- EOS

CREATE TRIGGER fiscal_years_depreciation_reversal_trigger
AFTER UPDATE OF reversal_time ON fiscal_years FOR EACH ROW
WHEN NEW.reversal_time IS NOT NULL AND OLD.reversal_time IS NULL
BEGIN
  INSERT INTO journal_entries (
    ref,
    entry_time,
    reversal_of_ref
  )
  SELECT
    NEW.depreciation_reversal_journal_entry_ref,
    NEW.reversal_time,
    OLD.depreciation_journal_entry_ref
  WHERE OLD.depreciation_journal_entry_ref IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM journal_entries
      WHERE ref = OLD.depreciation_journal_entry_ref
        AND post_time IS NOT NULL
    );

  INSERT INTO journal_entry_lines_auto_number (
    journal_entry_ref,
    account_code,
    debit,
    credit,
    note
  )
  SELECT
    NEW.depreciation_reversal_journal_entry_ref,
    jel.account_code,
    jel.credit,
    jel.debit,
    'Reversal: ' || COALESCE(jel.note, '')
  FROM journal_entry_lines jel
  WHERE jel.journal_entry_ref = OLD.depreciation_journal_entry_ref
    AND EXISTS (
      SELECT 1 FROM journal_entries
      WHERE ref = OLD.depreciation_journal_entry_ref
        AND post_time IS NOT NULL
    );

  UPDATE journal_entries
  SET post_time = NEW.reversal_time
  WHERE ref = NEW.depreciation_reversal_journal_entry_ref;

  UPDATE journal_entries
  SET reversed_by_ref = NEW.depreciation_reversal_journal_entry_ref
  WHERE ref = OLD.depreciation_journal_entry_ref
    AND EXISTS (
      SELECT 1 FROM journal_entries
      WHERE ref = NEW.depreciation_reversal_journal_entry_ref
    );

  UPDATE fixed_asset_internal_flags
  SET value = value + 1
  WHERE key = 'mutation_guard'
    AND EXISTS (
      SELECT 1 FROM journal_entries
      WHERE ref = OLD.depreciation_journal_entry_ref
        AND post_time IS NOT NULL
    );

  UPDATE fixed_assets
  SET
    accumulated_depreciation = MAX(
      CAST(
        MIN(
          ROUND(
            CAST(acquisition_cost - salvage_value AS REAL) *
            MIN(
              MAX(CAST(OLD.begin_time - acquisition_time AS REAL), 0.0),
              CAST(useful_life_years * 365 * 24 * 60 * 60 * 1000 AS REAL)
            ) /
            CAST(useful_life_years * 365 * 24 * 60 * 60 * 1000 AS REAL)
          ),
          CAST(acquisition_cost - salvage_value AS REAL)
        ) AS INTEGER
      ),
      0
    ),
    update_time = NEW.reversal_time
  WHERE EXISTS (
    SELECT 1 FROM journal_entries
    WHERE ref = OLD.depreciation_journal_entry_ref
      AND post_time IS NOT NULL
  )
    AND (
      MAX(
        CAST(
          MIN(
            ROUND(
              CAST(acquisition_cost - salvage_value AS REAL) *
              MIN(
                MAX(CAST(OLD.end_time - acquisition_time AS REAL), 0.0),
                CAST(useful_life_years * 365 * 24 * 60 * 60 * 1000 AS REAL)
              ) /
              CAST(useful_life_years * 365 * 24 * 60 * 60 * 1000 AS REAL)
            ),
            CAST(acquisition_cost - salvage_value AS REAL)
          ) AS INTEGER
        ),
        0
      ) - MAX(
        CAST(
          MIN(
            ROUND(
              CAST(acquisition_cost - salvage_value AS REAL) *
              MIN(
                MAX(CAST(OLD.begin_time - acquisition_time AS REAL), 0.0),
                CAST(useful_life_years * 365 * 24 * 60 * 60 * 1000 AS REAL)
              ) /
              CAST(useful_life_years * 365 * 24 * 60 * 60 * 1000 AS REAL)
            ),
            CAST(acquisition_cost - salvage_value AS REAL)
          ) AS INTEGER
        ),
        0
      )
    ) > 0;

  UPDATE fixed_asset_internal_flags
  SET value = value - 1
  WHERE key = 'mutation_guard'
    AND EXISTS (
      SELECT 1 FROM journal_entries
      WHERE ref = OLD.depreciation_journal_entry_ref
        AND post_time IS NOT NULL
    );

  UPDATE fiscal_years
  SET depreciation_reversal_journal_entry_ref = NULL
  WHERE id = NEW.id
    AND NEW.depreciation_reversal_journal_entry_ref IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM journal_entries
      WHERE ref = NEW.depreciation_reversal_journal_entry_ref
    );
END; -- EOS

UPDATE config SET value = '005-fixed-assets' WHERE key = 'Schema Version'; -- EOS