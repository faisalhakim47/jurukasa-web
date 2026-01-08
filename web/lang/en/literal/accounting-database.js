const accountingDatabase = {
  'Cannot set control_account_code on insert: target control account has non-zero posted entries': true,
  'Cannot set control_account_code on update: target control account has non-zero posted entries': true,
  'Cannot update account_tags: tags are immutable; delete and re-insert instead': true,
  'Entry time must be positive': true,
  'Cannot delete posted journal entry': true,
  'Cannot unpost or change post_time of a posted journal entry': true,
  'Cannot post journal entry line to a control account on insert': true,
  'Cannot post journal entry line to a control account on update': true,
  'Post time must be positive': true,
  'Journal entry does not balance': true,
  'Journal entry must have at least 2 lines': true,
  'Cannot modify lines of posted journal entry': true,
  'Cannot delete lines of posted journal entry': true,
  'Fiscal year periods cannot overlap': true,
  'Fiscal year must be at least 30 days': true,
  'Fiscal year cannot exceed 400 days': true,
  'Cannot close fiscal year with unposted journal entries': true,
  'Cannot unpost or change post_time of a posted fiscal year': true,
  'Cannot delete closed or reversed fiscal year': true,
  'Cannot reverse fiscal year that has not been closed': true,
  'Cannot reverse fiscal year: newer fiscal years exist': true,
  'Reversal time must be after post time': true,
  'Cannot change or remove reversal_time once set': true,
};

/** @typedef {typeof accountingDatabase} AccountingDatabaseLiteralTranslation */

export default accountingDatabase;
