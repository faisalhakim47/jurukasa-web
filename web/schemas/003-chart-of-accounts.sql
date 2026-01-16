-- =================================================================
-- Chart of Accounts Migration Script
-- Version: 1.0
-- Date: 2025-12-25
-- Dependencies: 001-accounting.sql, 002-pos.sql
-- 
-- This script populates the default Chart of Accounts for a Retail Business in Indonesia.
-- It includes all required accounts for the POS system to function.
-- =================================================================

CREATE VIEW chart_of_accounts_templates (name) AS
  SELECT column1
  FROM (VALUES
    ('Retail Business - Indonesia')
  ); -- EOS

CREATE TRIGGER chart_of_accounts_creation_trigger
INSTEAD OF INSERT ON chart_of_accounts_templates
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM chart_of_accounts_templates WHERE name = NEW.name) THEN
      RAISE (ABORT, 'Chart of Accounts template not found')
  END;

  -- Retail Business - Indonesia
  INSERT INTO accounts (account_code, name, normal_balance, is_posting_account, control_account_code, create_time, update_time)
  SELECT column1, column2, column3, column4, column5, 0, 0
  FROM (VALUES
    -- Assets (Aset)
    (10000, 'Aset', 0, 0, NULL),
    (11000, 'Aset Lancar', 0, 0, 10000),
    (11100, 'Kas & Bank', 0, 0, 11000),
    (11110, 'Kas', 0, 1, 11100),
    (11120, 'Bank BCA', 0, 1, 11100),
    (11130, 'Bank Mandiri', 0, 1, 11100),
    (11140, 'QRIS / E-Wallet', 0, 1, 11100),
    (11200, 'Piutang Usaha', 0, 1, 11000),
    (11300, 'Persediaan', 0, 0, 11000),
    (11310, 'Persediaan Barang Dagang', 0, 1, 11300),
    -- Non-Current Assets (Aset Tidak Lancar)
    (12000, 'Aset Tidak Lancar', 0, 0, 10000),
    (12100, 'Aset Tetap', 0, 0, 12000),
    (12110, 'Peralatan Toko', 0, 1, 12100),
    (12120, 'Peralatan Kantor', 0, 1, 12100),
    (12130, 'Kendaraan', 0, 1, 12100),
    (12190, 'Akumulasi Penyusutan', 1, 1, 12100),
    -- Liabilities (Liabilitas)
    (20000, 'Liabilitas', 1, 0, NULL),
    (21000, 'Liabilitas Jangka Pendek', 1, 0, 20000),
    (21100, 'Utang Usaha', 1, 1, 21000),
    (21200, 'Utang Pajak', 1, 0, 21000),
    (21210, 'Utang PPN', 1, 1, 21200),
    (21220, 'Utang PPh 21', 1, 1, 21200),
    (21300, 'Utang Beban', 1, 1, 21000),
    -- Equity (Ekuitas)
    (30000, 'Ekuitas', 1, 0, NULL),
    (31000, 'Modal Pemilik', 1, 1, 30000),
    (32000, 'Saldo Laba', 1, 1, 30000),
    (33000, 'Dividen', 0, 1, 30000),
    -- Revenue (Pendapatan)
    (40000, 'Pendapatan', 1, 0, NULL),
    (41000, 'Penjualan', 1, 1, 40000),
    (42000, 'Diskon & Retur Penjualan', 0, 1, 40000),
    -- Cost of Goods Sold (Beban Pokok Penjualan)
    (50000, 'Beban Pokok Penjualan', 0, 0, NULL),
    (51000, 'Beban Pokok Penjualan - Barang Dagang', 0, 1, 50000),
    -- Expenses (Beban)
    (60000, 'Beban', 0, 0, NULL),
    (61000, 'Beban Operasional', 0, 0, 60000),
    (61100, 'Beban Sewa', 0, 1, 61000),
    (61200, 'Beban Utilitas (Listrik, Air, Internet)', 0, 1, 61000),
    (61300, 'Beban Gaji', 0, 1, 61000),
    (61400, 'Beban Perlengkapan', 0, 1, 61000),
    (61500, 'Beban Pemeliharaan', 0, 1, 61000),
    (61600, 'Beban Pemasaran', 0, 1, 61000),
    (61700, 'Beban Administrasi Bank', 0, 1, 61000),
    (61800, 'Beban Selisih Persediaan', 0, 1, 61000),
    (61900, 'Beban Penyusutan', 0, 1, 61000),
    (62000, 'Beban Pajak', 0, 1, 60000),
    -- Other Income & Expenses (Pendapatan & Beban Lainnya)
    (80000, 'Pendapatan & Beban Lainnya', 1, 0, NULL),
    (81000, 'Pendapatan Lainnya', 1, 0, 80000),
    (81100, 'Keuntungan Selisih Persediaan', 1, 1, 81000),
    (81200, 'Pendapatan Bunga', 1, 1, 81000),
    (82000, 'Beban Lainnya', 0, 0, 80000),
    (82100, 'Beban Bunga', 0, 1, 82000),
    (82200, 'Penyesuaian Rekonsiliasi', 0, 1, 82000),
    (82300, 'Selisih Kas', 0, 1, 82000)
  ) WHERE NEW.name = 'Retail Business - Indonesia';

  INSERT INTO account_tags (account_code, tag)
  SELECT column1, column2
  FROM (VALUES
    -- POS System Required Tags
    (32000, 'Fiscal Year Closing - Retained Earning'),
    (21100, 'POS - Accounts Payable'),
    (61700, 'POS - Bank Fees'),
    (41000, 'POS - Sales Revenue'),
    (42000, 'POS - Sales Discount'),
    (51000, 'POS - Cost of Goods Sold'),
    (81100, 'POS - Inventory Gain'),
    (61800, 'POS - Inventory Shrinkage'),
    -- POS System Operational Tags
    (11110, 'POS - Payment Method'),
    (11120, 'POS - Payment Method'),
    (11130, 'POS - Payment Method'),
    (11140, 'POS - Payment Method'),
    (11310, 'POS - Inventory'),
    -- Financial Reporting Tags
    (11110, 'Balance Sheet - Current Asset'),
    (11120, 'Balance Sheet - Current Asset'),
    (11130, 'Balance Sheet - Current Asset'),
    (11140, 'Balance Sheet - Current Asset'),
    (11200, 'Balance Sheet - Current Asset'),
    (11310, 'Balance Sheet - Current Asset'),
    (12110, 'Balance Sheet - Non-Current Asset'),
    (12120, 'Balance Sheet - Non-Current Asset'),
    (12130, 'Balance Sheet - Non-Current Asset'),
    (12190, 'Balance Sheet - Non-Current Asset'),
    (21100, 'Balance Sheet - Current Liability'),
    (21210, 'Balance Sheet - Current Liability'),
    (21220, 'Balance Sheet - Current Liability'),
    (21300, 'Balance Sheet - Current Liability'),
    (31000, 'Balance Sheet - Equity'),
    (32000, 'Balance Sheet - Equity'),
    (33000, 'Balance Sheet - Equity'),
    (41000, 'Income Statement - Revenue'),
    (42000, 'Income Statement - Contra Revenue'),
    (51000, 'Income Statement - COGS'),
    (61100, 'Income Statement - Expense'),
    (61200, 'Income Statement - Expense'),
    (61300, 'Income Statement - Expense'),
    (61400, 'Income Statement - Expense'),
    (61500, 'Income Statement - Expense'),
    (61600, 'Income Statement - Expense'),
    (61700, 'Income Statement - Expense'),
    (61800, 'Income Statement - Expense'),
    (61900, 'Income Statement - Expense'),
    (62000, 'Income Statement - Expense'),
    (81100, 'Income Statement - Other Revenue'),
    (81200, 'Income Statement - Other Revenue'),
    (82100, 'Income Statement - Other Expense'),
    (82200, 'Income Statement - Other Expense'),
    (82300, 'Income Statement - Other Expense'),
    (41000, 'Fiscal Year Closing - Revenue'),
    (42000, 'Fiscal Year Closing - Revenue'),
    (51000, 'Fiscal Year Closing - Expense'),
    (61100, 'Fiscal Year Closing - Expense'),
    (61200, 'Fiscal Year Closing - Expense'),
    (61300, 'Fiscal Year Closing - Expense'),
    (61400, 'Fiscal Year Closing - Expense'),
    (61500, 'Fiscal Year Closing - Expense'),
    (61600, 'Fiscal Year Closing - Expense'),
    (61700, 'Fiscal Year Closing - Expense'),
    (61800, 'Fiscal Year Closing - Expense'),
    (61900, 'Fiscal Year Closing - Expense'),
    (62000, 'Fiscal Year Closing - Expense'),
    (81100, 'Fiscal Year Closing - Revenue'),
    (81200, 'Fiscal Year Closing - Revenue'),
    (82100, 'Fiscal Year Closing - Expense'),
    (82200, 'Fiscal Year Closing - Expense'),
    (82300, 'Fiscal Year Closing - Expense'),
    (33000, 'Fiscal Year Closing - Dividend'),
    (11110, 'Cash Flow - Cash Equivalents'),
    (11120, 'Cash Flow - Cash Equivalents'),
    (11130, 'Cash Flow - Cash Equivalents'),
    (11140, 'Cash Flow - Cash Equivalents'),
    -- Reconciliation Tags
    (82200, 'Reconciliation - Adjustment'),
    (82300, 'Reconciliation - Cash Over/Short')
  ) WHERE NEW.name = 'Retail Business - Indonesia';

END; -- EOS

UPDATE config SET value = '003-chart-of-accounts' WHERE key = 'Schema Version'; -- EOS
