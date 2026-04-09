import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getJournalEntryOwnerLabel,
  normalizeError,
  normalizeJournalEntryError,
  normalizeLiteralError,
  normalizeReconciliationError,
} from '#web/tools/accounting.js';

/**
 * @param {Record<string, string>} map
 * @returns {function(string, ...unknown[]): string}
 */
function createLiteral(map) {
  return function literal(textKey) {
    return textKey in map ? map[textKey] : `[literal.${textKey}]`;
  };
}

test('normalizeError wraps non-Error values', function () {
  const normalized = normalizeError('plain failure');

  assert.equal(normalized.message, 'plain failure');
});

test('getJournalEntryOwnerLabel uses literal translation', function () {
  const literal = createLiteral({
    Purchase: 'Pembelian',
  });

  assert.equal(getJournalEntryOwnerLabel('Purchase', literal), 'Pembelian');
  assert.equal(getJournalEntryOwnerLabel('Manual', literal), 'Manual');
});

test('normalizeLiteralError returns translated message when literal entry exists', function () {
  const literal = createLiteral({
    'Cannot delete posted journal entry': 'Jurnal yang sudah diposting tidak dapat dihapus.',
  });

  const normalized = normalizeLiteralError(new Error('Cannot delete posted journal entry'), literal);

  assert.equal(normalized.message, 'Jurnal yang sudah diposting tidak dapat dihapus.');
});

test('normalizeLiteralError preserves original message when literal entry is missing', function () {
  const literal = createLiteral({});

  const normalized = normalizeLiteralError(new Error('Form validation failed'), literal);

  assert.equal(normalized.message, 'Form validation failed');
});

test('feature normalizers delegate to literal translation', function () {
  const literal = createLiteral({
    'Checkpoint time must be positive': 'Waktu checkpoint harus berupa tanggal dan waktu yang valid.',
    'Cash equivalent account requires cashflow_activity and cashflow_category': 'Akun setara kas wajib memiliki aktivitas dan kategori arus kas.',
  });

  const reconciliationError = normalizeReconciliationError(new Error('Checkpoint time must be positive'), literal);
  const journalEntryError = normalizeJournalEntryError(new Error('Cash equivalent account requires cashflow_activity and cashflow_category'), literal);

  assert.equal(reconciliationError.message, 'Waktu checkpoint harus berupa tanggal dan waktu yang valid.');
  assert.equal(journalEntryError.message, 'Akun setara kas wajib memiliki aktivitas dan kategori arus kas.');
});