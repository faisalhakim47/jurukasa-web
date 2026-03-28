import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useExposed } from '#web/hooks/use-exposed.js';
import { useRender } from '#web/hooks/use-render.js';
import { useLiteral, useTranslator } from '#web/hooks/use-translator.js';
import { useWatch } from '#web/hooks/use-watch.js';
import { webStyleSheets } from '#web/desktop/styles.js';
import { normalizeReconciliationError } from '#web/tools/accounting.js';

import '#web/desktop/components/material-symbols.js';

/**
 * @typedef {object} ReconciliationDetails
 * @property {number} id
 * @property {number} accountCode
 * @property {string} accountName
 * @property {'STATEMENT' | 'PHYSICAL'} type
 * @property {number} checkpointTime
 * @property {number} externalBalance
 * @property {number} bookBalance
 * @property {number} discrepancy
 * @property {'balanced' | 'overage' | 'shortage'} discrepancyType
 * @property {number | null} adjustmentJournalEntryRef
 * @property {string | null} note
 * @property {number} createTime
 */

export class AccountReconciliationDetailsDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);

    const l = useLiteral(host);
    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    this.open = useExposed(host, function readDialogOpen() {
      return dialog.open;
    });

    const state = reactive({
      isLoading: false,
      error: /** @type {Error | null} */ (null),
      details: /** @type {ReconciliationDetails | null} */ (null),
    });

    function getReconciliationId() {
      return Number.parseInt(String(dialog.context?.dataset.reconciliationId ?? ''), 10);
    }

    async function loadDetails() {
      const reconciliationId = getReconciliationId();

      if (Number.isNaN(reconciliationId)) {
        state.details = null;
        state.error = null;
        state.isLoading = false;
        return;
      }

      try {
        state.isLoading = true;
        state.error = null;

        const result = await database.sql`
          SELECT
            id,
            account_code,
            account_name,
            type,
            checkpoint_time,
            external_balance,
            book_balance,
            discrepancy,
            discrepancy_type,
            adjustment_journal_entry_ref,
            note,
            create_time
          FROM reconciliation_history
          WHERE id = ${reconciliationId}
        `;

        if (result.rows.length === 0) {
          throw new Error(t('reconciliation', 'reconciliationNotFoundError'));
        }

        const row = result.rows[0];
        state.details = /** @type {ReconciliationDetails} */ ({
          id: Number(row.id),
          accountCode: Number(row.account_code),
          accountName: String(row.account_name),
          type: /** @type {'STATEMENT' | 'PHYSICAL'} */ (String(row.type)),
          checkpointTime: Number(row.checkpoint_time),
          externalBalance: Number(row.external_balance),
          bookBalance: Number(row.book_balance),
          discrepancy: Number(row.discrepancy),
          discrepancyType: /** @type {'balanced' | 'overage' | 'shortage'} */ (String(row.discrepancy_type)),
          adjustmentJournalEntryRef: row.adjustment_journal_entry_ref === null ? null : Number(row.adjustment_journal_entry_ref),
          note: row.note === null ? null : String(row.note),
          createTime: Number(row.create_time),
        });
      }
      catch (error) {
        state.details = null;
        state.error = normalizeReconciliationError(error, l);
      }
      finally {
        state.isLoading = false;
      }
    }

    function closeDialog() {
      dialog.open = false;
    }

    function handleViewAdjustmentEntry() {
      if (state.details?.adjustmentJournalEntryRef === null || state.details === null) return;
      host.dispatchEvent(new CustomEvent('view-journal-entry', {
        bubbles: true,
        composed: true,
        detail: { journalEntryRef: state.details.adjustmentJournalEntryRef },
      }));
    }

    /** @param {'PHYSICAL' | 'STATEMENT'} type */
    function getTypeLabel(type) {
      return type === 'PHYSICAL'
        ? t('reconciliation', 'typePhysicalLabel')
        : t('reconciliation', 'typeStatementLabel');
    }

    /** @param {'balanced' | 'overage' | 'shortage'} discrepancyType */
    function getDiscrepancyLabel(discrepancyType) {
      if (discrepancyType === 'balanced') return t('reconciliation', 'balancedLabel');
      if (discrepancyType === 'overage') return t('reconciliation', 'overageLabel');
      return t('reconciliation', 'shortageLabel');
    }

    function renderLoading() {
      return html`
        <div role="status" style="display: grid; gap: 16px; justify-items: center; padding: 48px 24px;">
          <div role="progressbar" class="linear indeterminate" style="width: 240px;">
            <div class="track"><div class="indicator"></div></div>
          </div>
          <p>${t('reconciliation', 'loadingDetailsLabel')}</p>
        </div>
      `;
    }

    function renderError() {
      return html`
        <div role="alert" style="display: grid; gap: 16px; padding: 24px; text-align: center;">
          <material-symbols name="error"></material-symbols>
          <h3 style="margin: 0;">${t('reconciliation', 'loadErrorTitle')}</h3>
          <p style="margin: 0;">${state.error?.message}</p>
        </div>
      `;
    }

    function renderDetails() {
      if (state.details === null) return nothing;

      const discrepancyTone = state.details.discrepancyType === 'balanced'
        ? 'var(--md-sys-color-primary-container)'
        : state.details.discrepancyType === 'overage'
          ? 'var(--md-sys-color-tertiary-container)'
          : 'var(--md-sys-color-error-container)';
      const discrepancyColor = state.details.discrepancyType === 'balanced'
        ? 'var(--md-sys-color-on-primary-container)'
        : state.details.discrepancyType === 'overage'
          ? 'var(--md-sys-color-on-tertiary-container)'
          : 'var(--md-sys-color-on-error-container)';
      const externalBalanceLabel = state.details.type === 'PHYSICAL'
        ? t('reconciliation', 'countedAmountLabel')
        : t('reconciliation', 'statementBalanceLabel');

      return html`
        <div class="content" style="display: grid; gap: 20px;">
          <section style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
            <span class="label-medium" style="padding: 6px 12px; border-radius: var(--md-sys-shape-corner-full); background: var(--md-sys-color-surface-container-high);">${getTypeLabel(state.details.type)}</span>
            <span class="label-medium" style="padding: 6px 12px; border-radius: var(--md-sys-shape-corner-full); background: ${discrepancyTone}; color: ${discrepancyColor};">${getDiscrepancyLabel(state.details.discrepancyType)}</span>
          </section>

          <section style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
            <article style="padding: 16px; border-radius: var(--md-sys-shape-corner-large); background: var(--md-sys-color-surface-container-low);">
              <p class="label-medium" style="margin: 0; color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'accountLabel')}</p>
              <p class="title-medium" style="margin: 8px 0 0 0;">${state.details.accountCode} - ${state.details.accountName}</p>
            </article>
            <article style="padding: 16px; border-radius: var(--md-sys-shape-corner-large); background: var(--md-sys-color-surface-container-low);">
              <p class="label-medium" style="margin: 0; color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'checkpointTimeLabel')}</p>
              <p class="title-medium" style="margin: 8px 0 0 0;">${i18n.date.format(new Date(state.details.checkpointTime))}</p>
            </article>
            <article style="padding: 16px; border-radius: var(--md-sys-shape-corner-large); background: var(--md-sys-color-surface-container-low);">
              <p class="label-medium" style="margin: 0; color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'recordedTimeLabel')}</p>
              <p class="title-medium" style="margin: 8px 0 0 0;">${i18n.date.format(new Date(state.details.createTime))}</p>
            </article>
          </section>

          <section style="display: grid; gap: 12px;">
            <h3 style="margin: 0;">${t('reconciliation', 'balancesTitle')}</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
              <article style="padding: 16px; border-radius: var(--md-sys-shape-corner-large); background: var(--md-sys-color-surface-container-low);">
                <p class="label-medium" style="margin: 0; color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'bookBalanceLabel')}</p>
                <p class="title-large" style="margin: 8px 0 0 0;">${i18n.displayCurrency(state.details.bookBalance)}</p>
              </article>
              <article style="padding: 16px; border-radius: var(--md-sys-shape-corner-large); background: var(--md-sys-color-surface-container-low);">
                <p class="label-medium" style="margin: 0; color: var(--md-sys-color-on-surface-variant);">${externalBalanceLabel}</p>
                <p class="title-large" style="margin: 8px 0 0 0;">${i18n.displayCurrency(state.details.externalBalance)}</p>
              </article>
              <article style="padding: 16px; border-radius: var(--md-sys-shape-corner-large); background: ${discrepancyTone}; color: ${discrepancyColor};">
                <p class="label-medium" style="margin: 0; opacity: 0.85;">${t('reconciliation', 'balanceDifferenceLabel')}</p>
                <p class="title-large" style="margin: 8px 0 0 0;">${i18n.displayCurrency(state.details.discrepancy)}</p>
              </article>
            </div>
          </section>

          <section style="display: grid; gap: 12px;">
            <h3 style="margin: 0;">${t('reconciliation', 'adjustmentEntryTitle')}</h3>
            ${state.details.adjustmentJournalEntryRef === null ? html`
              <p style="margin: 0; color: var(--md-sys-color-on-surface-variant);">${t('reconciliation', 'noAdjustmentEntryMessage')}</p>
            ` : html`
              <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
                <p style="margin: 0;">${t('reconciliation', 'adjustmentEntryRefLabel')}: ${state.details.adjustmentJournalEntryRef}</p>
                <button type="button" class="text" @click=${handleViewAdjustmentEntry}>${t('reconciliation', 'viewAdjustmentEntryLabel')}</button>
              </div>
            `}
          </section>

          <section style="display: grid; gap: 12px;">
            <h3 style="margin: 0;">${t('reconciliation', 'notesTitle')}</h3>
            <p style="margin: 0; color: var(--md-sys-color-on-surface-variant);">${state.details.note ?? t('reconciliation', 'noNoteLabel')}</p>
          </section>
        </div>
      `;
    }

    useWatch(host, dialog, 'open', function onOpenChange(isOpen) {
      if (isOpen) void loadDetails();
    });

    useEffect(host, function renderDetailsDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="account-reconciliation-details-dialog"
          role="dialog"
          aria-labelledby="account-reconciliation-details-title"
        >
          <article class="container">
            <header>
              <hgroup>
                <h2 id="account-reconciliation-details-title">${state.details === null ? t('reconciliation', 'detailsDialogTitle') : t('reconciliation', 'detailsDialogTitleWithId', state.details.id)}</h2>
              </hgroup>
              <button type="button" class="text" commandfor="account-reconciliation-details-dialog" command="close" aria-label="${t('reconciliation', 'closeDetailsButtonLabel')}"><material-symbols name="close"></material-symbols></button>
            </header>
            ${state.isLoading ? renderLoading() : nothing}
            ${state.isLoading === false && state.error instanceof Error ? renderError() : nothing}
            ${state.isLoading === false && state.error === null ? renderDetails() : nothing}
            <footer>
              <button type="button" class="filled" @click=${closeDialog}>${t('reconciliation', 'closeDetailsButtonLabel')}</button>
            </footer>
          </article>
        </dialog>
      `);
    });
  }
}

defineWebComponent('account-reconciliation-details-dialog', AccountReconciliationDetailsDialogElement);
