-- =================================================================
-- Revenue Tracking Database Migration Script
-- Version: 1.0
-- Date: 2025-12-26
-- SQLite Version: 3.43.0
-- Dependencies: 001-accounting.sql, 002-pos.sql
-- 
-- This script creates the revenue tracking schema for dashboard analytics.
-- Features:
-- - Daily revenue aggregation for sparkline visualization
-- - Period-over-period comparison for revenue change metrics
-- - Automatic updates via triggers when journal entries are posted
-- 
-- Migration Features:
-- - ACID transaction boundary
-- - Performance-optimized indexes
-- - Each top-level statement is followed by end-of-statement (EOS) marker
-- =================================================================

-- =================================================================
-- DAILY REVENUE AGGREGATION
-- =================================================================

-- Stores pre-aggregated daily revenue data for efficient dashboard queries
-- This table is automatically populated by triggers when sales are posted
CREATE TABLE daily_revenue (
  date_key INTEGER PRIMARY KEY, -- Unix timestamp at start of day (midnight UTC)
  gross_revenue INTEGER NOT NULL DEFAULT 0, -- Sum of all revenue credits
  discount_amount INTEGER NOT NULL DEFAULT 0, -- Sum of all discount debits (contra revenue)
  net_revenue INTEGER NOT NULL DEFAULT 0, -- gross_revenue - discount_amount
  transaction_count INTEGER NOT NULL DEFAULT 0, -- Number of sales transactions
  update_time INTEGER NOT NULL
) STRICT; -- EOS

CREATE INDEX daily_revenue_date_net_index ON daily_revenue (date_key, net_revenue); -- EOS
CREATE INDEX daily_revenue_update_time_index ON daily_revenue (update_time); -- EOS

-- =================================================================
-- REVENUE TRACKING VIEW
-- =================================================================

-- View to get daily revenue from journal entries for accounts tagged with revenue
-- This serves as the source for daily_revenue table population
CREATE VIEW daily_revenue_from_journal AS
SELECT
  -- Normalize entry_time to start of day (midnight) in milliseconds
  -- SQLite strftime returns seconds, we convert to milliseconds for JS compatibility
  CAST(strftime('%s', datetime(je.entry_time / 1000, 'unixepoch', 'start of day')) AS INTEGER) * 1000 AS date_key,
  COALESCE(SUM(
    CASE 
      WHEN at.tag = 'POS - Sales Revenue' THEN jel.credit
      ELSE 0
    END
  ), 0) AS gross_revenue,
  COALESCE(SUM(
    CASE
      WHEN at.tag = 'POS - Sales Discount' THEN jel.debit
      ELSE 0
    END
  ), 0) AS discount_amount,
  COALESCE(SUM(
    CASE 
      WHEN at.tag = 'POS - Sales Revenue' THEN jel.credit
      WHEN at.tag = 'POS - Sales Discount' THEN -jel.debit
      ELSE 0
    END
  ), 0) AS net_revenue,
  COUNT(DISTINCT je.ref) AS transaction_count
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_ref = je.ref
JOIN account_tags at ON at.account_code = jel.account_code
WHERE je.post_time IS NOT NULL
  AND je.source_type = 'System'
  AND je.source_reference LIKE 'Sale #%'
  AND at.tag IN ('POS - Sales Revenue', 'POS - Sales Discount')
GROUP BY date_key
HAVING gross_revenue > 0 OR discount_amount > 0; -- EOS

-- =================================================================
-- REVENUE PERIOD COMPARISON VIEW
-- =================================================================

-- View to compare revenue between current period and previous period
-- Useful for calculating revenue change percentage
CREATE VIEW revenue_period_comparison AS
WITH current_period AS (
  SELECT
    COALESCE(SUM(net_revenue), 0) AS total_net_revenue,
    COALESCE(SUM(gross_revenue), 0) AS total_gross_revenue,
    COALESCE(SUM(discount_amount), 0) AS total_discount,
    COALESCE(SUM(transaction_count), 0) AS total_transactions,
    MIN(date_key) AS period_start,
    MAX(date_key) AS period_end
  FROM daily_revenue
  WHERE date_key >= CAST(strftime('%s', datetime('now', 'start of day', '-7 days')) AS INTEGER) * 1000
    AND date_key < CAST(strftime('%s', datetime('now', 'start of day')) AS INTEGER) * 1000
),
previous_period AS (
  SELECT
    COALESCE(SUM(net_revenue), 0) AS total_net_revenue,
    COALESCE(SUM(gross_revenue), 0) AS total_gross_revenue,
    COALESCE(SUM(discount_amount), 0) AS total_discount,
    COALESCE(SUM(transaction_count), 0) AS total_transactions,
    MIN(date_key) AS period_start,
    MAX(date_key) AS period_end
  FROM daily_revenue
  WHERE date_key >= CAST(strftime('%s', datetime('now', 'start of day', '-14 days')) AS INTEGER) * 1000
    AND date_key < CAST(strftime('%s', datetime('now', 'start of day', '-7 days')) AS INTEGER) * 1000
)
SELECT
  cp.total_net_revenue AS current_net_revenue,
  cp.total_gross_revenue AS current_gross_revenue,
  cp.total_discount AS current_discount,
  cp.total_transactions AS current_transactions,
  pp.total_net_revenue AS previous_net_revenue,
  pp.total_gross_revenue AS previous_gross_revenue,
  pp.total_discount AS previous_discount,
  pp.total_transactions AS previous_transactions,
  CASE
    WHEN pp.total_net_revenue = 0 AND cp.total_net_revenue > 0 THEN 100.0
    WHEN pp.total_net_revenue = 0 AND cp.total_net_revenue = 0 THEN 0.0
    ELSE ROUND(
      (CAST(cp.total_net_revenue - pp.total_net_revenue AS REAL) / pp.total_net_revenue) * 100,
      2
    )
  END AS revenue_change_percent
FROM current_period cp, previous_period pp; -- EOS

-- =================================================================
-- SPARKLINE DATA VIEW
-- =================================================================

-- View to get last N days of revenue for sparkline visualization
CREATE VIEW revenue_sparkline AS
WITH RECURSIVE date_series(date_key) AS (
  -- Start from 6 days ago (to get 7 days total including today)
  SELECT CAST(strftime('%s', datetime('now', 'start of day', '-6 days')) AS INTEGER) * 1000
  UNION ALL
  -- Add one day at a time
  SELECT date_key + (24 * 60 * 60 * 1000) -- Add 1 day in milliseconds
  FROM date_series
  WHERE date_key < CAST(strftime('%s', datetime('now', 'start of day')) AS INTEGER) * 1000
)
SELECT
  ds.date_key,
  COALESCE(dr.net_revenue, 0) AS net_revenue,
  COALESCE(dr.gross_revenue, 0) AS gross_revenue,
  COALESCE(dr.discount_amount, 0) AS discount_amount,
  COALESCE(dr.transaction_count, 0) AS transaction_count
FROM date_series ds
LEFT JOIN daily_revenue dr ON dr.date_key = ds.date_key
ORDER BY ds.date_key ASC; -- EOS

-- =================================================================
-- FISCAL YEAR REVENUE SUMMARY VIEW
-- =================================================================

-- View to get revenue summary for current fiscal year
CREATE VIEW fiscal_year_revenue_summary AS
SELECT
  fy.id AS fiscal_year_id,
  fy.begin_time,
  fy.end_time,
  fy.name AS fiscal_year_name,
  COALESCE(SUM(dr.net_revenue), 0) AS total_net_revenue,
  COALESCE(SUM(dr.gross_revenue), 0) AS total_gross_revenue,
  COALESCE(SUM(dr.discount_amount), 0) AS total_discount,
  COALESCE(SUM(dr.transaction_count), 0) AS total_transactions
FROM fiscal_years fy
LEFT JOIN daily_revenue dr ON dr.date_key >= fy.begin_time AND dr.date_key < fy.end_time
WHERE fy.post_time IS NULL
GROUP BY fy.id, fy.begin_time, fy.end_time, fy.name; -- EOS

-- =================================================================
-- TRIGGER: UPDATE DAILY REVENUE ON SALE POST
-- =================================================================

-- This trigger updates daily_revenue when a sale is posted
-- It captures the revenue and discount amounts from the sale
CREATE TRIGGER daily_revenue_on_sale_post_trigger
AFTER UPDATE OF post_time ON sales FOR EACH ROW
WHEN OLD.post_time IS NULL AND NEW.post_time IS NOT NULL
BEGIN
  -- Insert or update daily_revenue for the sale date
  INSERT INTO daily_revenue (date_key, gross_revenue, discount_amount, net_revenue, transaction_count, update_time)
  VALUES (
    -- Normalize sale_time to start of day in milliseconds
    CAST(strftime('%s', datetime(NEW.sale_time / 1000, 'unixepoch', 'start of day')) AS INTEGER) * 1000,
    -- Gross revenue from sale_lines
    (SELECT COALESCE(SUM(price), 0) FROM sale_lines WHERE sale_id = NEW.id),
    -- Discount amount from sale_discounts
    (SELECT COALESCE(SUM(amount), 0) FROM sale_discounts WHERE sale_id = NEW.id),
    -- Net revenue
    (SELECT COALESCE(SUM(price), 0) FROM sale_lines WHERE sale_id = NEW.id) - 
    (SELECT COALESCE(SUM(amount), 0) FROM sale_discounts WHERE sale_id = NEW.id),
    -- Transaction count
    1,
    -- Update time
    NEW.post_time
  )
  ON CONFLICT(date_key) DO UPDATE SET
    gross_revenue = daily_revenue.gross_revenue + excluded.gross_revenue,
    discount_amount = daily_revenue.discount_amount + excluded.discount_amount,
    net_revenue = daily_revenue.net_revenue + excluded.net_revenue,
    transaction_count = daily_revenue.transaction_count + 1,
    update_time = excluded.update_time;
END; -- EOS

-- =================================================================
-- UTILITY: REBUILD DAILY REVENUE FROM JOURNAL
-- =================================================================

-- View to help rebuild daily_revenue table from existing journal entries
-- Usage: DELETE FROM daily_revenue; INSERT INTO daily_revenue SELECT * FROM rebuild_daily_revenue;
CREATE VIEW rebuild_daily_revenue AS
SELECT
  date_key,
  gross_revenue,
  discount_amount,
  net_revenue,
  transaction_count,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000 AS update_time
FROM daily_revenue_from_journal; -- EOS

UPDATE config SET value = '004-revenue-tracking' WHERE key = 'Schema Version'; -- EOS
