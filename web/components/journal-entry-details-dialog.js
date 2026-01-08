import { html, nothing } from 'lit-html';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { TimeContextElement } from '#web/contexts/time-context.js';
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
 * @typedef {object} JournalEntryRow
 * @property {number} ref
 * @property {number} entry_time
 * @property {string | null} note
 * @property {string} source_type
 * @property {number | null} post_time
 * @property {number} total_amount
 * @property {number | null} reversal_of_ref - Reference to the journal entry this entry reverses
 * @property {number | null} reversed_by_ref - Reference to the journal entry that reversed this entry
 */

/**
 * @typedef {object} JournalEntryLine
 * @property {number} line_number
 * @property {number} account_code
 * @property {string} account_name
 * @property {number} debit
 * @property {number} credit
 * @property {string | null} description
 * @property {string | null} reference
 */

export class JournalEntryDetailsDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const time = useContext(host, TimeContextElement);

    const t = useTranslator(host);
    const dialog = useDialog(host);
    const render = useRender(host);
    const confirmationDialog = useElement(host, HTMLDialogElement);
    useAdoptedStyleSheets(host, webStyleSheets);

    this.open = useExposed(host, function readPopoverState() {
      return dialog.open;
    });

    const state = reactive({
      journalEntry: /** @type {JournalEntryRow | null} */ (null),
      journalEntryLines: /** @type {JournalEntryLine[]} */ ([]),
      isLoading: false,
      error: /** @type {Error | null} */ (null),
      actionState: /** @type {'idle' | 'confirming-post' | 'confirming-discard' | 'confirming-reverse' | 'processing' | 'success' | 'error'} */ ('idle'),
      actionError: /** @type {Error | null} */ (null),
    });

    async function loadJournalEntry() {
      const journalEntryRef = parseInt(dialog.context?.dataset.journalEntryRef, 10);

      if (isNaN(journalEntryRef)) {
        state.journalEntry = null;
        state.journalEntryLines = [];
        state.error = null;
      }
      else try {
        state.isLoading = true;
        state.error = null;

        const journalEntryResult = await database.sql`
            SELECT
              je.ref,
              je.entry_time,
              je.note,
              je.source_type,
              je.post_time,
              je.reversal_of_ref,
              je.reversed_by_ref,
              COALESCE(SUM(jel.debit), 0) as total_amount
            FROM journal_entries je
            LEFT JOIN journal_entry_lines jel ON jel.journal_entry_ref = je.ref
            WHERE je.ref = ${journalEntryRef}
            GROUP BY je.ref
          `;

        if (journalEntryResult.rows.length === 0) throw new Error(t('journalEntry', 'entryNotFound', journalEntryRef));

        const journalEntryRow = journalEntryResult.rows[0];
        state.journalEntry = {
          ref: Number(journalEntryRow.ref),
          entry_time: Number(journalEntryRow.entry_time),
          note: journalEntryRow.note ? String(journalEntryRow.note) : null,
          source_type: String(journalEntryRow.source_type),
          post_time: journalEntryRow.post_time ? Number(journalEntryRow.post_time) : null,
          total_amount: Number(journalEntryRow.total_amount),
          reversal_of_ref: journalEntryRow.reversal_of_ref ? Number(journalEntryRow.reversal_of_ref) : null,
          reversed_by_ref: journalEntryRow.reversed_by_ref ? Number(journalEntryRow.reversed_by_ref) : null,
        };

        const journalEntryLinesResult = await database.sql`
            SELECT
              jel.line_number,
              jel.account_code,
              a.name as account_name,
              jel.debit,
              jel.credit,
              jel.description,
              jel.reference
            FROM journal_entry_lines jel
            JOIN accounts a ON a.account_code = jel.account_code
            WHERE jel.journal_entry_ref = ${journalEntryRef}
            ORDER BY jel.line_number ASC
          `;

        state.journalEntryLines = journalEntryLinesResult.rows.map(function mapRowToJournalEntryLine(row) {
          return /** @type {JournalEntryLine} */ ({
            line_number: Number(row.line_number),
            account_code: Number(row.account_code),
            account_name: String(row.account_name),
            debit: Number(row.debit),
            credit: Number(row.credit),
            description: row.description ? String(row.description) : null,
            reference: row.reference ? String(row.reference) : null,
          });
        });
      }
      catch (error) {
        console.error('Failed to load entry details:', error);
        state.error = error instanceof Error ? error : new Error(String(error));
      }
      finally {
        state.isLoading = false;
      }
    }

    useEffect(host, loadJournalEntry);

    function handlePostClick() {
      state.actionState = 'confirming-post';
    }

    function handleDiscardClick() {
      state.actionState = 'confirming-discard';
    }

    function handleReverseClick() {
      state.actionState = 'confirming-reverse';
    }

    function handleCancelAction() {
      state.actionState = 'idle';
      state.actionError = null;
    }

    async function handleConfirmPost() {
      const tx = await database.transaction('write');
      try {
        state.actionState = 'processing';
        state.actionError = null;

        const postTime = time.currentDate().getTime();

        await tx.sql`
          UPDATE journal_entries
          SET post_time = ${postTime}
          WHERE ref = ${state.journalEntry.ref}
        `;

        await tx.commit();
        state.actionState = 'success';
        await sleep(1000);

        host.dispatchEvent(new CustomEvent('journal-entry-posted', {
          detail: { ref: state.journalEntry.ref },
          bubbles: true,
          composed: true,
        }));

        await loadJournalEntry();
        state.actionState = 'idle';
      }
      catch (error) {
        await tx.rollback();
        state.actionState = 'error';
        state.actionError = error instanceof Error ? error : new Error(String(error));
      }
    }

    async function handleConfirmDiscard() {
      const tx = await database.transaction('write');
      try {
        state.actionState = 'processing';
        state.actionError = null;

        await tx.sql`
          DELETE FROM journal_entry_lines
          WHERE journal_entry_ref = ${state.journalEntry.ref}
        `;

        await tx.sql`
          DELETE FROM journal_entries
          WHERE ref = ${state.journalEntry.ref}
        `;

        await tx.commit();
        state.actionState = 'success';
        await sleep(1000);

        host.dispatchEvent(new CustomEvent('journal-entry-discarded', {
          detail: { ref: state.journalEntry.ref },
          bubbles: true,
          composed: true,
        }));

        dialog.open = false;
        state.actionState = 'idle';
      }
      catch (error) {
        await tx.rollback();
        state.actionState = 'error';
        state.actionError = error instanceof Error ? error : new Error(String(error));
      }
    }

    async function handleConfirmReverse() {
      const tx = await database.transaction('write');
      try {
        state.actionState = 'processing';
        state.actionError = null;

        const entryTime = time.currentDate().getTime();
        const postTime = entryTime;
        const originalRef = state.journalEntry.ref;
        const originalNote = state.journalEntry.note;
        let reversalNote = t('journalEntry', 'reversalNote', originalRef);
        if (originalNote) reversalNote += ` - ${originalNote}`;

        // Create reversal journal entry
        const insertResult = await tx.sql`
          INSERT INTO journal_entries (entry_time, note, source_type, created_by, reversal_of_ref)
          VALUES (${entryTime}, ${reversalNote}, 'Manual', 'User', ${originalRef})
          RETURNING ref
        `;

        const reversalRef = Number(insertResult.rows[0].ref);

        // Create reversed lines (swap debit and credit)
        for (const line of state.journalEntryLines) {
          await tx.sql`
            INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description, reference)
            VALUES (${reversalRef}, ${line.account_code}, ${line.credit}, ${line.debit}, ${line.description}, ${line.reference})
          `;
        }

        // Post the reversal entry
        await tx.sql`
          UPDATE journal_entries
          SET post_time = ${postTime}
          WHERE ref = ${reversalRef}
        `;

        // Update original entry to reference the reversal
        await tx.sql`
          UPDATE journal_entries
          SET reversed_by_ref = ${reversalRef}
          WHERE ref = ${originalRef}
        `;

        await tx.commit();
        state.actionState = 'success';
        await sleep(1000);

        host.dispatchEvent(new CustomEvent('journal-entry-reversed', {
          detail: { originalRef, reversalRef },
          bubbles: true,
          composed: true,
        }));

        await loadJournalEntry();
        state.actionState = 'idle';
      }
      catch (error) {
        await tx.rollback();
        state.actionState = 'error';
        state.actionError = error instanceof Error ? error : new Error(String(error));
      }
    }

    function handleDismissError() {
      state.actionState = 'idle';
      state.actionError = null;
    }

    useEffect(host, function syncConfirmationDialogState() {
      if (confirmationDialog.value instanceof HTMLDialogElement) {
        const shouldBeOpen = ['confirming-post', 'confirming-discard', 'confirming-reverse', 'processing', 'error'].includes(state.actionState);
        if (shouldBeOpen && !confirmationDialog.value.open) {
          confirmationDialog.value.showModal();
        }
        else if (!shouldBeOpen && confirmationDialog.value.open) {
          confirmationDialog.value.close();
        }
      }
    });

    function renderErrorNotice() {
      return html`
        <div role="alert">
          <material-symbols name="error" size="48"></material-symbols>
          <h3>${t('journalEntry', 'loadErrorTitle')}</h3>
          <p>${state.error.message}</p>
        </div>
      `;
    }

    function renderLoadingIndicator() {
      return html`
        <div role="status" aria-label=${t('journalEntry', 'loadingDetailsLabel')}>
          <div role="progressbar" class="linear indeterminate">
            <div class="track">
              <div class="indicator"></div>
            </div>
          </div>
          <p>${t('journalEntry', 'loadingDetailsLabel')}</p>
        </div>
      `;
    }

    function renderStatusBadge() {
      const isPosted = state.journalEntry.post_time !== null;
      const isReversed = state.journalEntry.reversed_by_ref !== null;
      const isReversal = state.journalEntry.reversal_of_ref !== null;

      if (isReversed) {
        return html`<span style="
          display: inline-flex;
          padding: 0px 8px;
          border-radius: var(--md-sys-shape-corner-small);
          background-color: #FFEBEE;
          color: #B71C1C;
          font-size: 0.8em;
        ">${t('journalEntry', 'statusReversedBy', state.journalEntry.reversed_by_ref)}</span>`;
      }

      if (isReversal) {
        return html`<span style="
          display: inline-flex;
          padding: 0px 8px;
          border-radius: var(--md-sys-shape-corner-small);
          background-color: #E3F2FD;
          color: #0D47A1;
          font-size: 0.8em;
        ">${t('journalEntry', 'statusReversalOf', state.journalEntry.reversal_of_ref)}</span>`;
      }

      if (isPosted) {
        return html`<span style="
          display: inline-flex;
          padding: 0px 8px;
          border-radius: var(--md-sys-shape-corner-small);
          background-color: #E8F5E9;
          color: #1B5E20;
          font-size: 0.8em;
        ">${t('journalEntry', 'statusPosted')}</span>`;
      }

      return html`<span style="
        display: inline-flex;
        padding: 0px 8px;
        border-radius: var(--md-sys-shape-corner-small);
        background-color: #FFF3E0;
        color: #E65100;
        font-size: 0.8em;
      ">Draft</span>`;
    }

    function renderDialogContent() {
      const isPosted = state.journalEntry.post_time !== null;

      return html`
        <section>
          <dl style="display: grid; grid-template-columns: max-content 1fr; gap: 8px 24px; margin: 0;">
            <dt style="color: var(--md-sys-color-on-surface-variant);">${t('journalEntry', 'dateLabel')}</dt>
            <dd style="margin: 0; color: var(--md-sys-color-on-surface);">${i18n.date.format(state.journalEntry.entry_time)}</dd>

            <dt style="color: var(--md-sys-color-on-surface-variant);">${t('journalEntry', 'statusLabel')}</dt>
            <dd style="margin: 0; color: var(--md-sys-color-on-surface);">${renderStatusBadge()}</dd>

            <dt style="color: var(--md-sys-color-on-surface-variant);">${t('journalEntry', 'sourceLabel')}</dt>
            <dd style="margin: 0; color: var(--md-sys-color-on-surface);">${state.journalEntry.source_type}</dd>

            <dt style="color: var(--md-sys-color-on-surface-variant);">${t('journalEntry', 'postedDateLabel')}</dt>
            <dd style="margin: 0; color: var(--md-sys-color-on-surface);">${isPosted ? i18n.date.format(state.journalEntry.post_time) : t('journalEntry', 'unpostedLabel')}</dd>

            <dt style="color: var(--md-sys-color-on-surface-variant);">${t('journalEntry', 'noteLabel')}</dt>
            <dd style="margin: 0; color: var(--md-sys-color-on-surface);">${state.journalEntry.note ? state.journalEntry.note : '—'}</dd>
          </dl>
        </section>
        <div class="container" style="height: min(max(200px, 40vh), 400px); margin-top: 16px;">
          <table role="table" aria-label="Journal entry lines" style="--md-sys-density: -3;">
            <thead>
              <tr>
                <th scope="col">${t('journalEntry', 'accountColumnInfo')}</th>
                <th scope="col" class="numeric">${t('journalEntry', 'debitColumnInfo')}</th>
                <th scope="col" class="numeric">${t('journalEntry', 'creditColumnInfo')}</th>
              </tr>
            </thead>
            <tbody>
              ${state.journalEntryLines.map((line) => html`
                <tr>
                  <td>
                    <div style="display: flex; flex-direction: column;">
                      <span style="font-weight: 500;">${line.account_name}</span>
                      <span style="font-size: 0.8em; color: var(--md-sys-color-on-surface-variant);">${line.account_code}</span>
                      ${line.description ? html`<span style="font-size: 0.9em; font-style: italic;">${line.description}</span>` : ''}
                    </div>
                  </td>
                  <td class="numeric">${line.debit > 0 ? i18n.displayCurrency(line.debit) : '—'}</td>
                  <td class="numeric">${line.credit > 0 ? i18n.displayCurrency(line.credit) : '—'}</td>
                </tr>
              `)}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold; background-color: var(--md-sys-color-surface-container-low);">
                <td>${t('journalEntry', 'totalLabel')}</td>
                <td class="numeric">${i18n.displayCurrency(state.journalEntry.total_amount)}</td>
                <td class="numeric">${i18n.displayCurrency(state.journalEntry.total_amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    function renderActionButtons() {
      const isPosted = state.journalEntry.post_time !== null;
      const isReversed = state.journalEntry.reversed_by_ref !== null;

      if (!isPosted) {
        // Draft actions: Post and Discard
        return html`
          <button
            role="button"
            type="button"
            class="tonal"
            @click=${handlePostClick}
            aria-label=${t('journalEntry', 'postActionLabel')}
          >
            <material-symbols name="check_circle"></material-symbols>
            ${t('journalEntry', 'postActionLabel')}
          </button>
          <button
            role="button"
            type="button"
            class="text"
            style="color: var(--md-sys-color-error);"
            @click=${handleDiscardClick}
            aria-label=${t('journalEntry', 'discardActionLabel')}
          >
            <material-symbols name="delete"></material-symbols>
            ${t('journalEntry', 'discardActionLabel')}
          </button>
        `;
      }

      if (isPosted && !isReversed) {
        // Posted actions: Reverse
        return html`
          <button
            role="button"
            type="button"
            class="text"
            style="color: var(--md-sys-color-error);"
            @click=${handleReverseClick}
            aria-label=${t('journalEntry', 'reverseActionLabel')}
          >
            <material-symbols name="undo"></material-symbols>
            ${t('journalEntry', 'reverseActionLabel')}
          </button>
        `;
      }

      // Reversed entry - no actions available
      return nothing;
    }

    function renderConfirmationDialogContent() {
      if (state.actionState === 'confirming-post') {
        return html`
          <material-symbols name="check_circle" style="color: var(--md-sys-color-primary);"></material-symbols>
          <header>
            <h3>${t('journalEntry', 'confirmPostTitle')}</h3>
          </header>
          <div class="content">
            <p>${t('journalEntry', 'confirmPostMessage', state.journalEntry?.ref)}</p>
            <p style="color: var(--md-sys-color-on-surface-variant); font-size: 0.9em;">
              ${t('journalEntry', 'confirmPostWarning')}
            </p>
          </div>
          <menu>
            <button role="button" type="button" class="text" @click=${handleCancelAction}>${t('journalEntry', 'cancelActionLabel')}</button>
            <button role="button" type="button" class="tonal" @click=${handleConfirmPost}>${t('journalEntry', 'confirmPostActionLabel')}</button>
          </menu>
        `;
      }

      if (state.actionState === 'confirming-discard') {
        return html`
          <material-symbols name="delete" style="color: var(--md-sys-color-error);"></material-symbols>
          <header>
            <h3>${t('journalEntry', 'confirmDiscardTitle')}</h3>
          </header>
          <div class="content">
            <p>${t('journalEntry', 'confirmDiscardMessage', state.journalEntry?.ref)}</p>
            <p style="color: var(--md-sys-color-error); font-size: 0.9em;">
              ${t('journalEntry', 'confirmDiscardWarning')}
            </p>
          </div>
          <menu>
            <button role="button" type="button" class="text" @click=${handleCancelAction}>${t('journalEntry', 'cancelActionLabel')}</button>
            <button role="button" type="button" class="tonal" style="background-color: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container);" @click=${handleConfirmDiscard}>${t('journalEntry', 'confirmDiscardActionLabel')}</button>
          </menu>
        `;
      }

      if (state.actionState === 'confirming-reverse') {
        return html`
          <material-symbols name="undo" style="color: var(--md-sys-color-error);"></material-symbols>
          <header>
            <h3>${t('journalEntry', 'confirmReverseTitle')}</h3>
          </header>
          <div class="content">
            <p>${t('journalEntry', 'confirmReverseMessage', state.journalEntry?.ref)}</p>
            <p style="color: var(--md-sys-color-on-surface-variant); font-size: 0.9em;">
              ${t('journalEntry', 'confirmReverseWarning')}
            </p>
          </div>
          <menu>
            <button role="button" type="button" class="text" @click=${handleCancelAction}>${t('journalEntry', 'cancelActionLabel')}</button>
            <button role="button" type="button" class="tonal" @click=${handleConfirmReverse}>${t('journalEntry', 'confirmReverseActionLabel')}</button>
          </menu>
        `;
      }

      if (state.actionState === 'processing') {
        return html`
          <div role="status" aria-label=${t('journalEntry', 'processingTitle')}>
            <div role="progressbar" class="linear indeterminate">
              <div class="track">
                <div class="indicator"></div>
              </div>
            </div>
          </div>
          <header>
            <h3>${t('journalEntry', 'processingTitle')}</h3>
          </header>
          <div class="content">
            <p>${t('journalEntry', 'processingMessage')}</p>
          </div>
        `;
      }

      if (state.actionState === 'error') {
        return html`
          <material-symbols name="error" style="color: var(--md-sys-color-error);"></material-symbols>
          <header>
            <h3>${t('journalEntry', 'dialogErrorTitle')}</h3>
          </header>
          <div class="content">
            <p>${state.actionError?.message}</p>
          </div>
          <menu>
            <button role="button" type="button" class="text" @click=${handleDismissError}>${t('journalEntry', 'dismissLabel')}</button>
          </menu>
        `;
      }

      return nothing;
    }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="journal-entry-details-dialog"
          aria-labelledby="journal-entry-details-dialog-title"
          style="width: min(max(96%, 600px), 90vw);"
        >
          <div class="container">
            <material-symbols name="receipt_long"></material-symbols>
            <header>
              <h2 id="journal-entry-details-dialog-title">${state.journalEntry ? t('journalEntry', 'detailsTitleWithRef', state.journalEntry.ref) : t('journalEntry', 'detailsTitle')}</h2>
            </header>
            <div class="content">
              ${state.isLoading ? renderLoadingIndicator() : nothing}
              ${state.error instanceof Error ? renderErrorNotice() : nothing}
              ${!state.isLoading && state.journalEntry ? renderDialogContent() : nothing}
            </div>
            <menu>
              ${!state.isLoading && state.journalEntry ? renderActionButtons() : nothing}
              <button
                role="button"
                type="button"
                class="text"
                commandfor="journal-entry-details-dialog"
                command="close"
              >${t('journalEntry', 'closeActionLabel')}</button>
            </menu>
          </div>
        </dialog>

        <dialog ${confirmationDialog} role="alertdialog" aria-labelledby="confirmation-dialog-title">
          <div class="container">
            ${renderConfirmationDialogContent()}
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('journal-entry-details-dialog', JournalEntryDetailsDialogElement);
