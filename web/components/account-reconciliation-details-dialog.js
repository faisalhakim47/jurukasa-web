import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { useExposed } from '#web/hooks/use-exposed.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { sleep } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';

/**
 * @typedef {object} ReconciliationDetails
 * @property {number} id
 * @property {number} account_code
 * @property {string} account_name
 * @property {number} reconciliation_time
 * @property {number} statement_begin_time
 * @property {number} statement_end_time
 * @property {string | null} statement_reference
 * @property {number} statement_opening_balance
 * @property {number} statement_closing_balance
 * @property {number} internal_opening_balance
 * @property {number} internal_closing_balance
 * @property {number | null} complete_time
 * @property {number | null} adjustment_journal_entry_ref
 * @property {string | null} note
 * @property {number} total_statement_items
 * @property {number} matched_items
 * @property {number} unmatched_items
 * @property {number} total_discrepancies
 * @property {number} pending_discrepancies
 */

/**
 * @typedef {object} StatementItem
 * @property {number} id
 * @property {number} item_time
 * @property {string | null} description
 * @property {string | null} reference
 * @property {number} debit
 * @property {number} credit
 * @property {number} is_matched
 * @property {number | null} matched_journal_entry_ref
 */

/**
 * @typedef {object} Discrepancy
 * @property {number} id
 * @property {string} discrepancy_type
 * @property {number | null} statement_item_id
 * @property {number | null} journal_entry_ref
 * @property {number} expected_amount
 * @property {number} actual_amount
 * @property {number} difference_amount
 * @property {string} resolution
 * @property {number | null} resolution_journal_entry_ref
 * @property {string | null} note
 */

export class AccountReconciliationDetailsDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);

    const dialog = useDialog(host);
    const render = useRender(host);
    const confirmationDialog = useElement(host, HTMLDialogElement);
    useAdoptedStyleSheets(host, webStyleSheets);

    this.open = useExposed(host, function readPopoverState() {
      return dialog.open;
    });

    const state = reactive({
      details: /** @type {ReconciliationDetails | null} */ (null),
      statementItems: /** @type {StatementItem[]} */ ([]),
      discrepancies: /** @type {Discrepancy[]} */ ([]),
      isLoading: false,
      error: /** @type {Error | null} */ (null),
      actionState: /** @type {'idle' | 'confirming-complete' | 'confirming-delete' | 'processing' | 'error'} */ ('idle'),
      actionError: /** @type {Error | null} */ (null),
      currencyDecimals: 0,
    });

    useEffect(host, async function loadConfig() {
      try {
        const result = await database.sql`SELECT value FROM config WHERE key = 'Currency Decimals'`;
        const decimals = Number(result.rows[0]?.value ?? 0);
        state.currencyDecimals = Number.isInteger(decimals) && decimals >= 0 ? decimals : 0;
      }
      catch (error) {
        console.trace('Failed to load currency config:', error);
        state.currencyDecimals = 0;
      }
    });

    async function loadReconciliationDetails() {
      const reconciliationId = parseInt(dialog.context?.dataset.reconciliationId, 10);

      if (isNaN(reconciliationId)) {
        state.details = null;
        state.statementItems = [];
        state.discrepancies = [];
        state.error = null;
      }
      else try {
        state.isLoading = true;
        state.error = null;

        const detailsResult = await database.sql`
          SELECT
            rs.id,
            rs.account_code,
            a.name as account_name,
            rs.reconciliation_time,
            rs.statement_begin_time,
            rs.statement_end_time,
            rs.statement_reference,
            rs.statement_opening_balance,
            rs.statement_closing_balance,
            rs.internal_opening_balance,
            rs.internal_closing_balance,
            rs.complete_time,
            rs.adjustment_journal_entry_ref,
            rs.note,
            (SELECT COUNT(*) FROM reconciliation_statement_items WHERE reconciliation_session_id = rs.id) AS total_statement_items,
            (SELECT COUNT(*) FROM reconciliation_statement_items WHERE reconciliation_session_id = rs.id AND is_matched = 1) AS matched_items,
            (SELECT COUNT(*) FROM reconciliation_statement_items WHERE reconciliation_session_id = rs.id AND is_matched = 0) AS unmatched_items,
            (SELECT COUNT(*) FROM reconciliation_discrepancies WHERE reconciliation_session_id = rs.id) AS total_discrepancies,
            (SELECT COUNT(*) FROM reconciliation_discrepancies WHERE reconciliation_session_id = rs.id AND resolution = 'pending') AS pending_discrepancies
          FROM reconciliation_sessions rs
          JOIN accounts a ON a.account_code = rs.account_code
          WHERE rs.id = ${reconciliationId}
        `;

        if (detailsResult.rows.length === 0) {
          throw new Error(t('reconciliation', 'reconciliationNotFoundError'));
        }

        const detailsRow = detailsResult.rows[0];
        state.details = {
          id: Number(detailsRow.id),
          account_code: Number(detailsRow.account_code),
          account_name: String(detailsRow.account_name),
          reconciliation_time: Number(detailsRow.reconciliation_time),
          statement_begin_time: Number(detailsRow.statement_begin_time),
          statement_end_time: Number(detailsRow.statement_end_time),
          statement_reference: detailsRow.statement_reference !== null ? String(detailsRow.statement_reference) : null,
          statement_opening_balance: Number(detailsRow.statement_opening_balance),
          statement_closing_balance: Number(detailsRow.statement_closing_balance),
          internal_opening_balance: Number(detailsRow.internal_opening_balance),
          internal_closing_balance: Number(detailsRow.internal_closing_balance),
          complete_time: detailsRow.complete_time !== null ? Number(detailsRow.complete_time) : null,
          adjustment_journal_entry_ref: detailsRow.adjustment_journal_entry_ref !== null ? Number(detailsRow.adjustment_journal_entry_ref) : null,
          note: detailsRow.note !== null ? String(detailsRow.note) : null,
          total_statement_items: Number(detailsRow.total_statement_items),
          matched_items: Number(detailsRow.matched_items),
          unmatched_items: Number(detailsRow.unmatched_items),
          total_discrepancies: Number(detailsRow.total_discrepancies),
          pending_discrepancies: Number(detailsRow.pending_discrepancies),
        };

        const itemsResult = await database.sql`
          SELECT
            id,
            item_time,
            description,
            reference,
            debit,
            credit,
            is_matched,
            matched_journal_entry_ref
          FROM reconciliation_statement_items
          WHERE reconciliation_session_id = ${reconciliationId}
          ORDER BY item_time ASC
        `;

        state.statementItems = itemsResult.rows.map(function mapRowToItem(row) {
          return /** @type {StatementItem} */ ({
            id: Number(row.id),
            item_time: Number(row.item_time),
            description: row.description !== null ? String(row.description) : null,
            reference: row.reference !== null ? String(row.reference) : null,
            debit: Number(row.debit),
            credit: Number(row.credit),
            is_matched: Number(row.is_matched),
            matched_journal_entry_ref: row.matched_journal_entry_ref !== null ? Number(row.matched_journal_entry_ref) : null,
          });
        });

        const discrepanciesResult = await database.sql`
          SELECT
            id,
            discrepancy_type,
            statement_item_id,
            journal_entry_ref,
            expected_amount,
            actual_amount,
            difference_amount,
            resolution,
            resolution_journal_entry_ref,
            note
          FROM reconciliation_discrepancies
          WHERE reconciliation_session_id = ${reconciliationId}
          ORDER BY id ASC
        `;

        state.discrepancies = discrepanciesResult.rows.map(function mapRowToDiscrepancy(row) {
          return /** @type {Discrepancy} */ ({
            id: Number(row.id),
            discrepancy_type: String(row.discrepancy_type),
            statement_item_id: row.statement_item_id !== null ? Number(row.statement_item_id) : null,
            journal_entry_ref: row.journal_entry_ref !== null ? Number(row.journal_entry_ref) : null,
            expected_amount: Number(row.expected_amount),
            actual_amount: Number(row.actual_amount),
            difference_amount: Number(row.difference_amount),
            resolution: String(row.resolution),
            resolution_journal_entry_ref: row.resolution_journal_entry_ref !== null ? Number(row.resolution_journal_entry_ref) : null,
            note: row.note !== null ? String(row.note) : null,
          });
        });
      }
      catch (error) {
        // console.error('Failed to load reconciliation details:', error);
        state.error = error instanceof Error ? error : new Error(String(error));
      }
      finally {
        state.isLoading = false;
      }
    }

    useEffect(host, loadReconciliationDetails);

    function handleCompleteClick() {
      state.actionState = 'confirming-complete';
      state.actionError = null;
    }

    function handleDeleteClick() {
      state.actionState = 'confirming-delete';
      state.actionError = null;
    }

    function handleCancelAction() {
      state.actionState = 'idle';
      state.actionError = null;
    }

    async function handleConfirmComplete() {
      if (!state.details) return;

      const tx = await database.transaction('write');
      try {
        state.actionState = 'processing';
        state.actionError = null;

        await tx.sql`
          UPDATE reconciliation_sessions
          SET complete_time = ${Date.now()}
          WHERE id = ${state.details.id} AND complete_time IS NULL
        `;

        await tx.commit();
        state.actionState = 'idle';

        host.dispatchEvent(new CustomEvent('account-reconciliation-completed', {
          detail: { reconciliationId: state.details.id },
          bubbles: true,
          composed: true,
        }));

        dialog.open = false;
        await loadReconciliationDetails();
      }
      catch (error) {
        await tx.rollback();
        state.actionState = 'error';
        state.actionError = error instanceof Error ? error : new Error(String(error));
      }
    }

    async function handleConfirmDelete() {
      if (!state.details) return;

      const tx = await database.transaction('write');
      try {
        state.actionState = 'processing';
        state.actionError = null;

        await tx.sql`
          DELETE FROM reconciliation_sessions WHERE id = ${state.details.id}
        `;

        await tx.commit();
        state.actionState = 'idle';

        host.dispatchEvent(new CustomEvent('account-reconciliation-deleted', {
          detail: { reconciliationId: state.details.id },
          bubbles: true,
          composed: true,
        }));

        dialog.open = false;
      }
      catch (error) {
        await tx.rollback();
        state.actionState = 'error';
        state.actionError = error instanceof Error ? error : new Error(String(error));
      }
    }

    function handleViewAdjustmentEntry() {
      if (state.details?.adjustment_journal_entry_ref) {
        host.dispatchEvent(new CustomEvent('view-journal-entry', {
          detail: { journalEntryRef: state.details.adjustment_journal_entry_ref },
          bubbles: true,
          composed: true,
        }));
      }
    }

    useEffect(host, function syncConfirmationDialogState() {
      if (confirmationDialog.value instanceof HTMLDialogElement) {
        const shouldBeOpen = ['confirming-complete', 'confirming-delete', 'processing', 'error'].includes(state.actionState);
        if (shouldBeOpen && !confirmationDialog.value.open) {
          confirmationDialog.value.showModal();
        }
        else if (!shouldBeOpen && confirmationDialog.value.open) {
          confirmationDialog.value.close();
        }
      }
    });

    /**
     * @param {number} amount
     */
    function formatCurrency(amount) {
      return i18n.displayCurrency(amount / Math.pow(10, state.currencyDecimals));
    }

    function renderLoadingIndicator() {
      return html`
        <div role="status" aria-label="${t('reconciliation', 'loadingDetailsLabel')}">
          <div role="progressbar" class="linear indeterminate">
            <div class="track">
              <div class="indicator"></div>
            </div>
          </div>
          <p>${t('reconciliation', 'loadingDetailsLabel')}</p>
        </div>
      `;
    }

    function renderErrorNotice() {
      return html`
        <div role="alert" style="display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 24px; text-align: center;">
          <material-symbols name="error" size="48" style="color: var(--md-sys-color-error);"></material-symbols>
          <h3>${t('reconciliation', 'loadErrorTitle')}</h3>
          <p style="color: var(--md-sys-color-on-surface-variant);">${state.error?.message}</p>
        </div>
      `;
    }

    /**
     * @param {string} discrepancyType
      */
    function getDiscrepancyTypeLabel(discrepancyType) {
      const key = `discrepancy${discrepancyType.charAt(0).toUpperCase() + discrepancyType.slice(1).replace(/_([a-z])/g, function (_, letter) {
        return letter.toUpperCase();
      })}`;
      return /** @type {string} */ (t('reconciliation', /** @type {any} */(key))) || discrepancyType;
    }

    /**
     * @param {string} resolution
     */
    function getResolutionLabel(resolution) {
      const key = `resolution${resolution.charAt(0).toUpperCase() + resolution.slice(1)}`;
      return /** @type {string} */ (t('reconciliation', /** @type {any} */(key))) || resolution;
    }

    /**
     * @param {StatementItem} item
     */
    function renderStatementItem(item) {
      const isMatched = item.is_matched === 1;
      const amount = item.debit > 0 ? item.debit : item.credit;

      return html`
        <tr>
          <td>${i18n.date.format(new Date(item.item_time))}</td>
          <td>
            <div style="display: flex; flex-direction: column;">
              <span>${item.description || '—'}</span>
              ${item.reference ? html`<span class="body-small" style="color: var(--md-sys-color-on-surface-variant);">${item.reference}</span>` : nothing}
            </div>
          </td>
          <td class="numeric">${item.debit > 0 ? formatCurrency(item.debit) : '—'}</td>
          <td class="numeric">${item.credit > 0 ? formatCurrency(item.credit) : '—'}</td>
          <td>
            <span
              class="label-small"
              style="
                display: inline-flex;
                padding: 4px 8px;
                border-radius: var(--md-sys-shape-corner-full);
                background-color: ${isMatched ? 'var(--md-sys-color-tertiary-container)' : 'var(--md-sys-color-error-container)'};
                color: ${isMatched ? 'var(--md-sys-color-on-tertiary-container)' : 'var(--md-sys-color-on-error-container)'};
              "
            >${t('reconciliation', isMatched ? 'itemStatusMatched' : 'itemStatusUnmatched')}</span>
          </td>
        </tr>
      `;
    }

    /**
     * @param {Discrepancy} discrepancy
     */
    function renderDiscrepancy(discrepancy) {
      return html`
        <tr>
          <td>${getDiscrepancyTypeLabel(discrepancy.discrepancy_type)}</td>
          <td class="numeric">${formatCurrency(discrepancy.difference_amount)}</td>
          <td>
            <span
              class="label-small"
              style="
                display: inline-flex;
                padding: 4px 8px;
                border-radius: var(--md-sys-shape-corner-full);
              "
            >${getResolutionLabel(discrepancy.resolution)}</span>
          </td>
        </tr>
      `;
    }

    function renderDetailsContent() {
      if (!state.details) return nothing;

      const isDraft = state.details.complete_time === null;
      const balanceDifference = state.details.statement_closing_balance - state.details.internal_closing_balance;

      return html`
        <div class="content" style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0;">
          <section>
            <dl style="display: grid; grid-template-columns: max-content 1fr; gap: 8px 24px; margin: 0;">
              <dt style="color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'accountLabel')}</dt>
              <dd style="margin: 0; color: var(--md-sys-color-on-surface);">
                <div style="display: flex; flex-direction: column;">
                  <span>${state.details.account_name}</span>
                  <span class="body-small" style="color: var(--md-sys-color-on-surface-variant);">${state.details.account_code}</span>
                </div>
              </dd>

              <dt style="color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'statementPeriodLabel')}</dt>
              <dd style="margin: 0; color: var(--md-sys-color-on-surface);">
                ${i18n.date.format(new Date(state.details.statement_begin_time))} ${t('reconciliation', 'toLabel')} ${i18n.date.format(new Date(state.details.statement_end_time))}
              </dd>

              <dt style="color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'reconciliationDateLabel')}</dt>
              <dd style="margin: 0; color: var(--md-sys-color-on-surface);">${i18n.date.format(new Date(state.details.reconciliation_time))}</dd>

              <dt style="color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'referenceLabel')}</dt>
              <dd style="margin: 0; color: var(--md-sys-color-on-surface);">${state.details.statement_reference || '—'}</dd>

              <dt style="color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'statusLabel')}</dt>
              <dd style="margin: 0;">
                <span
                  class="label-medium"
                  style="
                    display: inline-flex;
                    padding: 4px 12px;
                    border-radius: var(--md-sys-shape-corner-full);
                    background-color: ${isDraft ? 'var(--md-sys-color-secondary-container)' : 'var(--md-sys-color-tertiary-container)'};
                    color: ${isDraft ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-tertiary-container)'};
                  "
                >${t('reconciliation', isDraft ? 'statusDraft' : 'statusCompleted')}</span>
              </dd>
            </dl>
          </section>

          <section>
            <h3 class="title-medium" style="margin-bottom: 16px;">${t('reconciliation', 'balancesTitle')}</h3>
            <div style="
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              padding: 16px;
              background-color: var(--md-sys-color-surface-container);
              border-radius: 12px;
            ">
              <div>
                <h4 class="title-small" style="color: var(--md-sys-color-primary); margin-bottom: 12px;">${t('reconciliation', 'internalBalancesSubtitle')}</h4>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'openingBalanceLabel')}</span>
                    <span>${formatCurrency(state.details.internal_opening_balance)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'closingBalanceLabel')}</span>
                    <span>${formatCurrency(state.details.internal_closing_balance)}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 class="title-small" style="color: var(--md-sys-color-tertiary); margin-bottom: 12px;">${t('reconciliation', 'statementBalancesSubtitle')}</h4>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'openingBalanceLabel')}</span>
                    <span>${formatCurrency(state.details.statement_opening_balance)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'closingBalanceLabel')}</span>
                    <span>${formatCurrency(state.details.statement_closing_balance)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div style="
              display: flex;
              justify-content: flex-end;
              margin-top: 12px;
              padding: 12px 16px;
              background-color: ${balanceDifference === 0 ? 'var(--md-sys-color-tertiary-container)' : 'var(--md-sys-color-error-container)'};
              border-radius: 8px;
            ">
              <span style="color: ${balanceDifference === 0 ? 'var(--md-sys-color-on-tertiary-container)' : 'var(--md-sys-color-on-error-container)'};">
                ${t('reconciliation', 'balanceDifferenceLabel')}: ${formatCurrency(balanceDifference)}
              </span>
            </div>
          </section>

          <section>
            <h3 class="title-medium" style="margin-bottom: 16px;">${t('reconciliation', 'statementItemsTitle')}</h3>
            <div style="display: flex; gap: 16px; margin-bottom: 16px;">
              <span class="label-medium">${t('reconciliation', 'totalItemsLabel')}: ${state.details.total_statement_items}</span>
              <span class="label-medium" style="color: var(--md-sys-color-tertiary);">${t('reconciliation', 'matchedItemsLabel')}: ${state.details.matched_items}</span>
              <span class="label-medium" style="color: var(--md-sys-color-error);">${t('reconciliation', 'unmatchedItemsLabel')}: ${state.details.unmatched_items}</span>
            </div>
            <div class="container" style="max-height: 300px; overflow-y: auto;">
              <table role="table" aria-label="${t('reconciliation', 'statementItemsTitle')}" style="--md-sys-density: -3;">
                <thead>
                  <tr>
                    <th scope="col">${t('reconciliation', 'itemDateLabel')}</th>
                    <th scope="col">${t('reconciliation', 'itemDescriptionLabel')}</th>
                    <th scope="col" class="numeric">${t('reconciliation', 'itemDebitLabel')}</th>
                    <th scope="col" class="numeric">${t('reconciliation', 'itemCreditLabel')}</th>
                    <th scope="col">${t('reconciliation', 'itemStatusLabel')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${repeat(state.statementItems, (item) => item.id, renderStatementItem)}
                </tbody>
              </table>
            </div>
          </section>

          ${state.discrepancies.length > 0 ? html`
            <section>
              <h3 class="title-medium" style="margin-bottom: 16px;">${t('reconciliation', 'discrepanciesTitle')}</h3>
              <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                <span class="label-medium">${t('reconciliation', 'totalDiscrepanciesLabel')}: ${state.details.total_discrepancies}</span>
              </div>
              <div class="container" style="max-height: 200px; overflow-y: auto;">
                <table role="table" aria-label="${t('reconciliation', 'discrepanciesTitle')}" style="--md-sys-density: -3;">
                  <thead>
                    <tr>
                      <th scope="col">${t('reconciliation', 'discrepancyTypeLabel')}</th>
                      <th scope="col" class="numeric">${t('reconciliation', 'discrepancyAmountLabel')}</th>
                      <th scope="col">${t('reconciliation', 'discrepancyResolutionLabel')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${repeat(state.discrepancies, (d) => d.id, renderDiscrepancy)}
                  </tbody>
                </table>
              </div>
            </section>
          ` : nothing}

          ${state.details.adjustment_journal_entry_ref ? html`
            <section>
              <h3 class="title-medium" style="margin-bottom: 16px;">${t('reconciliation', 'adjustmentEntryTitle')}</h3>
              <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background-color: var(--md-sys-color-surface-container); border-radius: 12px;">
                <material-symbols name="receipt_long" style="color: var(--md-sys-color-primary);"></material-symbols>
                <div style="display: flex; flex-direction: column; flex: 1;">
                  <span class="label-medium">${t('reconciliation', 'adjustmentEntryRefLabel')}</span>
                  <span>${state.details.adjustment_journal_entry_ref}</span>
                </div>
                <button role="button" class="text" @click=${handleViewAdjustmentEntry}>
                  <material-symbols name="visibility"></material-symbols>
                  ${t('reconciliation', 'viewAdjustmentEntryLabel')}
                </button>
              </div>
            </section>
          ` : nothing}

          ${state.details.note ? html`
            <section>
              <h3 class="title-medium" style="margin-bottom: 16px;">${t('reconciliation', 'notesTitle')}</h3>
              <div style="padding: 16px; background-color: var(--md-sys-color-surface-container); border-radius: 12px;">
                <p style="margin: 0; white-space: pre-wrap;">${state.details.note}</p>
              </div>
            </section>
          ` : nothing}
        </div>
      `;
    }

    function renderConfirmationDialogContent() {
      if (state.actionState === 'confirming-complete') {
        return html`
          <material-symbols name="check_circle" style="color: var(--md-sys-color-primary);"></material-symbols>
          <header>
            <h3>${t('reconciliation', 'completeConfirmationTitle')}</h3>
          </header>
          <div class="content">
            <p>${t('reconciliation', 'completeConfirmationMessage')}</p>
            <p style="color: var(--md-sys-color-on-surface-variant); font-size: 0.9em;">
              ${t('reconciliation', 'completeConfirmationWarning')}
            </p>
          </div>
          <menu>
            <button role="button" type="button" class="text" @click=${handleCancelAction}>${t('reconciliation', 'cancelActionLabel')}</button>
            <button role="button" type="button" class="tonal" @click=${handleConfirmComplete}>${t('reconciliation', 'confirmActionLabel')}</button>
          </menu>
        `;
      }

      if (state.actionState === 'confirming-delete') {
        return html`
          <material-symbols name="delete" style="color: var(--md-sys-color-error);"></material-symbols>
          <header>
            <h3>${t('reconciliation', 'deleteConfirmationTitle')}</h3>
          </header>
          <div class="content">
            <p>${t('reconciliation', 'deleteConfirmationMessage')}</p>
            <p style="color: var(--md-sys-color-error); font-size: 0.9em;">
              ${t('reconciliation', 'deleteWarning')}
            </p>
          </div>
          <menu>
            <button role="button" type="button" class="text" @click=${handleCancelAction}>${t('reconciliation', 'cancelActionLabel')}</button>
            <button role="button" type="button" class="tonal" style="background-color: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container);" @click=${handleConfirmDelete}>${t('reconciliation', 'confirmActionLabel')}</button>
          </menu>
        `;
      }

      if (state.actionState === 'processing') {
        return html`
          <div role="status" aria-label="${t('reconciliation', 'processingLabel')}">
            <div role="progressbar" class="linear indeterminate">
              <div class="track">
                <div class="indicator"></div>
              </div>
            </div>
          </div>
          <header>
            <h3>${t('reconciliation', 'processingLabel')}</h3>
          </header>
        `;
      }

      if (state.actionState === 'error') {
        return html`
          <material-symbols name="error" style="color: var(--md-sys-color-error);"></material-symbols>
          <header>
            <h3>${state.actionError?.message || t('reconciliation', 'unknownErrorMessage')}</h3>
          </header>
          <menu>
            <button role="button" type="button" class="text" @click=${handleCancelAction}>${t('reconciliation', 'dismissButtonLabel')}</button>
          </menu>
        `;
      }

      return nothing;
    }

    const renderDialogTemplate = () => html`
      <dialog
        ${dialog.element}
        id="account-reconciliation-details-dialog"
        aria-labelledby="reconciliation-details-dialog-title"
        style="width: min(max(96%, 700px), 90vw);"
      >
        <div class="container">
          <material-symbols name="rule"></material-symbols>
          <header>
            <h2 id="reconciliation-details-dialog-title">
              ${state.details ? t('reconciliation', 'detailsDialogTitleWithId', state.details.id) : t('reconciliation', 'detailsDialogTitle')}
            </h2>
          </header>
          <div class="content">
            ${state.isLoading ? renderLoadingIndicator() : nothing}
            ${state.error instanceof Error ? renderErrorNotice() : nothing}
            ${!state.isLoading && state.details ? renderDetailsContent() : nothing}
          </div>
          <menu>
            ${state.details && state.details.complete_time === null ? html`
              <button
                role="button"
                type="button"
                class="text"
                style="color: var(--md-sys-color-error);"
                @click=${handleDeleteClick}
              >
                <material-symbols name="delete"></material-symbols>
                ${t('reconciliation', 'deleteReconciliationButtonLabel')}
              </button>
              <button
                role="button"
                type="button"
                class="tonal"
                @click=${handleCompleteClick}
              >
                <material-symbols name="check_circle"></material-symbols>
                ${t('reconciliation', 'completeReconciliationButtonLabel')}
              </button>
            ` : nothing}
            <button
              role="button"
              type="button"
              class="text"
              commandfor="account-reconciliation-details-dialog"
              command="close"
            >${t('reconciliation', 'closeDetailsButtonLabel')}</button>
          </menu>
        </div>
      </dialog>

      <dialog ${confirmationDialog} role="alertdialog" aria-labelledby="confirmation-dialog-title">
        <div class="container">
          ${renderConfirmationDialogContent()}
        </div>
      </dialog>
    `;

    useEffect(host, function renderDialog() {
      render(renderDialogTemplate());
    });
  }
}

defineWebComponent('account-reconciliation-details-dialog', AccountReconciliationDetailsDialogElement);
