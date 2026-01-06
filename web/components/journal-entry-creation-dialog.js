import { computed, reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { TimeContextElement } from '#web/contexts/time-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useConnectedCallback } from '#web/hooks/use-lifecycle.js';
import { useRender } from '#web/hooks/use-render.js';
import { useElement } from '#web/hooks/use-element.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { conditionalClass } from '#web/tools/dom.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';
import '#web/components/account-selector-dialog.js';

/**
 * @typedef {object} JournalEntryLine
 * @property {number} id - Unique line ID for tracking in UI
 * @property {string} accountName - Account name (resolved from account code)
 * @property {boolean} isAccountValid - Whether account code is valid
 * @property {boolean} isAccountChecked - Whether account code has been validated
 */

/**
 * Journal Entry Creation Dialog Component
 * 
 * A full-screen dialog for creating new journal entries with tabular line input.
 * 
 * @fires journal-entry-created - Fired when a journal entry is successfully created. Detail: { ref: number, posted: boolean }
 * 
 * @example
 * <button type="button" commandfor="journal-entry-creation-dialog" command="--open">Create Entry</button>
 * <journal-entry-creation-dialog
 *   id="journal-entry-creation-dialog"
 *   @journal-entry-created=${(e) => console.log('Created:', e.detail)}
 * ></journal-entry-creation-dialog>
 */
export class JournalEntryCreationDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const time = useContext(host, TimeContextElement);

    const journalEntryLinesTBody = useElement(host, HTMLTableSectionElement);
    const totalDebitCell = useElement(host, HTMLTableCellElement);
    const totalCreditCell = useElement(host, HTMLTableCellElement);
    const errorAlertDialog = useElement(host, HTMLDialogElement);

    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    /** @param {FocusEvent} event */
    async function accountCodeValidationHandler(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      const input = event.currentTarget;
      const accountNameLabel = input.closest('tr').querySelector('label.account-name');
      assertInstanceOf(HTMLLabelElement, accountNameLabel);
      accountNameLabel.textContent = '-';
      const accountCode = input.value.trim();
      input.setCustomValidity('');
      if (accountCode) {
        try {
          const existingAccountResult = await database.sql`
            SELECT name FROM accounts WHERE account_code = ${accountCode} LIMIT 1;
          `;
          if (existingAccountResult.rows.length === 1) {
            accountNameLabel.textContent = String(existingAccountResult.rows[0].name);
          }
          else input.setCustomValidity('Account code not found.');
        }
        catch (error) {
          input.setCustomValidity('Error validating account code.');
        }
      }
    }

    function syncSumOfDebitAndCredit() {
      let sumOfDebit = 0;
      let sumOfCredit = 0;
      for (const lineRow of journalEntryLinesTBody.value.children) {
        const debitInput = lineRow.querySelector('input[name="debit"]');
        const creditInput = lineRow.querySelector('input[name="credit"]');
        assertInstanceOf(HTMLInputElement, debitInput);
        assertInstanceOf(HTMLInputElement, creditInput);
        const debitValue = parseInt(debitInput.value, 10);
        const creditValue = parseInt(creditInput.value, 10);
        sumOfDebit += isNaN(debitValue) ? 0 : debitValue;
        sumOfCredit += isNaN(creditValue) ? 0 : creditValue;
      }
      totalDebitCell.value.textContent = i18n.displayCurrency(sumOfDebit);
      totalCreditCell.value.textContent = i18n.displayCurrency(sumOfCredit);
      const isBalanced = sumOfDebit === sumOfCredit;
      const isFilled = sumOfDebit !== 0 || sumOfCredit !== 0;
      conditionalClass(totalDebitCell.value, isFilled && !isBalanced, 'text-error');
      conditionalClass(totalCreditCell.value, isFilled && !isBalanced, 'text-error');
    }

    /** @param {FocusEvent} event */
    function debitBlurHandler(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      const debitInput = event.currentTarget;
      const creditInput = debitInput.closest('tr').querySelector('input[name="credit"]');
      assertInstanceOf(HTMLInputElement, creditInput);
      if (debitInput.value.trim()) {
        const value = parseInt(debitInput.value, 10);
        if (isNaN(value)) debitInput.setCustomValidity('Invalid debit amount.');
        else if (value < 0) debitInput.setCustomValidity('Debit amount cannot be negative.');
        else if (value === 0) creditInput.readOnly = false;
        else if (value > 0) {
          creditInput.readOnly = true;
          creditInput.value = '0';
        }
        syncSumOfDebitAndCredit();
      }
    }

    /** @param {FocusEvent} event */
    function creditBlurHandler(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      const creditInput = event.currentTarget;
      const debitInput = creditInput.closest('tr').querySelector('input[name="debit"]');
      assertInstanceOf(HTMLInputElement, debitInput);
      if (creditInput.value.trim()) {
        const value = parseInt(creditInput.value, 10);
        if (isNaN(value)) creditInput.setCustomValidity('Invalid credit amount.');
        else if (value < 0) creditInput.setCustomValidity('Credit amount cannot be negative.');
        else if (value === 0) debitInput.readOnly = false;
        else if (value > 0) {
          debitInput.readOnly = true;
          debitInput.value = '0';
        }
        syncSumOfDebitAndCredit();
      }
    }

    let nextLineId = 1;
    const form = reactive({
      lineIds: [nextLineId++, nextLineId++],
      state: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      error: null,
    });

    const initialEntryDatetime = computed(function initialEntryDatetime() {
      if (dialog.open) {
        const now = time.currentDate();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      }
    });

    function addJournalEntryLine() { form.lineIds.push(nextLineId++); }

    /** @param {MouseEvent} event */
    function removeJournalEntryLineHandler(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      const lineIdStr = event.currentTarget.dataset.lineId;
      const lineId = parseInt(lineIdStr, 10);
      if (isNaN(lineId)) throw new Error('Invalid line ID to remove.');
      const index = form.lineIds.indexOf(lineId);
      if (index === -1) throw new Error('Line ID to remove not found.');
      form.lineIds.splice(index, 1);
      syncSumOfDebitAndCredit();
    }

    /** @param {CustomEvent} event */
    function handleAccountSelect(event) {
      const detail = event.detail;
      const tr = journalEntryLinesTBody.value.children.item(detail.journalEntryLineIndex);
      assertInstanceOf(HTMLTableRowElement, tr);
      const accountCodeInput = tr.querySelector('input[name="accountCode"]');
      const accountNameLabel = tr.querySelector('label.account-name');
      assertInstanceOf(HTMLInputElement, accountCodeInput);
      assertInstanceOf(HTMLLabelElement, accountNameLabel);
      accountCodeInput.value = String(detail.accountCode);
      accountNameLabel.textContent = String(detail.accountName);
    }

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
      event.preventDefault();
      assertInstanceOf(HTMLFormElement, event.currentTarget);

      const tx = await database.transaction('write');

      try {
        form.state = 'submitting';
        form.error = null;

        const data = new FormData(event.currentTarget);
        const entryTimeStr = /** @type {string} */ (data.get('entryTime'));
        const note = /** @type {string} */ (data.get('note'));

        const accountCodes = data.getAll('accountCode');
        const debits = data.getAll('debit');
        const credits = data.getAll('credit');

        const journalEntryLines = [];
        let totalDebit = 0;
        let totalCredit = 0;

        for (let index = 0; index < accountCodes.length; index++) {
          const accountCode = /** @type {string} */ (accountCodes[index]).trim();
          const debit = parseInt(/** @type {string} */(debits[index]), 10) || 0;
          const credit = parseInt(/** @type {string} */(credits[index]), 10) || 0;

          // Skip empty journal entry lines (no account code and no amount)
          if (!accountCode && debit === 0 && credit === 0) continue;

          // Validate journal entry line
          if (!accountCode) throw new Error(`Line ${index + 1}: Account code is required.`);
          if (debit < 0 || credit < 0) throw new Error(`Line ${index + 1}: Amounts cannot be negative.`);
          if (debit === 0 && credit === 0) throw new Error(`Line ${index + 1}: Either debit or credit amount must be greater than zero.`);
          if (debit > 0 && credit > 0) throw new Error(`Line ${index + 1}: Only one of debit or credit amount can be greater than zero.`);

          journalEntryLines.push({ accountCode, debit, credit });
          totalDebit += debit;
          totalCredit += credit;
        }

        if (journalEntryLines.length === 0) {
          form.state = 'error';
          form.error = new Error('At least one journal entry line is required.');
          return;
        }

        if (totalDebit !== totalCredit) {
          form.state = 'error';
          form.error = new Error('Journal entry must be balanced to post.');
          return;
        }

        const entryTime = new Date(entryTimeStr).getTime();

        const journalEntryInsert = await tx.sql`
          INSERT INTO journal_entries (entry_time, note, source_type, created_by)
          VALUES (${entryTime}, ${note || null}, 'Manual', 'User')
          RETURNING ref;
        `;

        const journalEntryRef = journalEntryInsert.rows[0].ref;

        for (const line of journalEntryLines) await tx.sql`
          INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit)
          VALUES (${journalEntryRef}, ${line.accountCode}, ${line.debit}, ${line.credit});
        `;

        await tx.commit();

        form.state = 'success';
        await feedbackDelay();

        host.dispatchEvent(new CustomEvent('journal-entry-created', {
          detail: { journalEntryRef },
          bubbles: true,
          composed: true,
        }));

        dialog.open = false;
      }
      catch (error) {
        await tx.rollback();
        form.state = 'error';
        form.error = error;
        await feedbackDelay();
      }
      finally {
        form.state = 'idle';
      }
    }

    useEffect(host, async function syncErrorAlertDialogState() {
      if (errorAlertDialog.value instanceof HTMLDialogElement) {
        if (form.error instanceof Error) errorAlertDialog.value.showModal();
        else errorAlertDialog.value.close();
      }
    });

    function handleDismissErrorDialog() { form.error = null; }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog ${dialog.element} id="journal-entry-creation-dialog" class="full-screen">
          <form class="container" @submit=${handleSubmit}>
            <header>
              <h2>Create Journal Entry</h2>
              <button
                role="button"
                type="button"
                class="text"
                commandfor="journal-entry-creation-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              <button role="button" type="submit" name="action">Draft Entry</button>
            </header>

            <div class="content">
              ${form.state !== 'idle' ? html`
                <div role="status" aria-live="polite" aria-busy="true">
                  <div role="progressbar" class="linear indeterminate">
                    <div class="track"><div class="indicator"></div></div>
                  </div>
                  <p>Creating journal entry...</p>
                </div>
              ` : nothing}

              <div style="display: flex; flex-direction: column; gap: 16px; padding: 16px 0px;">
                <div style="display: flex; gap: 16px;">
                  <div class="outlined-text-field" style="flex: 1; --md-sys-density: -3;">
                    <div class="container">
                      <label for="journal-entry-date">Entry Date</label>
                      <input
                        id="journal-entry-date"
                        name="entryTime"
                        type="datetime-local"
                        required
                        placeholder=" "
                        value=${initialEntryDatetime.value}
                      />
                    </div>
                  </div>

                  <div class="outlined-text-field" style="flex: 3; --md-sys-density: -3;">
                    <div class="container">
                      <label for="journal-entry-note">Note (optional)</label>
                      <input id="journal-entry-note" name="note" type="text" placeholder=" "/>
                    </div>
                  </div>
                </div>
              </div>

              <hr>

              <!-- Journal Entry Lines Section -->
              <section>
                <header style="display: flex; align-items: center; justify-content: space-between;">
                  <h3 class="body-large">Entry Lines</h3>
                  <button role="button" type="button" class="outlined" @click=${addJournalEntryLine}>
                    <material-symbols name="add"></material-symbols>
                    Add Line
                  </button>
                </header>

                <table aria-label="Journal entry lines" style="--md-sys-density: -4;">
                  <thead>
                    <tr>
                      <th scope="col" id="jel-line-number-col" style="text-align: center; width: 64px;">#</th>
                      <th scope="col" id="jel-account-code-col" style="text-align: left; width: 128px;">Account Code</th>
                      <th scope="col" id="jel-account-name-col" style="text-align: left; width: 256px;">Account Name</th>
                      <th scope="col" id="jel-debit-col" style="text-align: right; width: 128px;">Debit</th>
                      <th scope="col" id="jel-credit-col" style="text-align: right; width: 128px;">Credit</th>
                      <th scope="col" id="jel-action-col" style="text-align: center; width: 64px;"></th>
                    </tr>
                  </thead>
                  <tbody ${journalEntryLinesTBody}>
                    ${repeat(form.lineIds, (lineId) => lineId, (lineId, index) => html`
                      <tr>
                        <td style="text-align: center; width: 64px;">${index + 1}</td>
                        <td style="text-align: left; width: 128px;">
                          <div class="outlined-text-field" style="--md-sys-density: -4;">
                            <div class="container">
                              <input
                                id=${`account-code-${lineId}`}
                                type="text"
                                name="accountCode"
                                inputmode="numeric"
                                pattern="[0-9]*"
                                placeholder=" "
                                aria-label="Account Code"
                                aria-discribedby=${`account-name-${lineId}`}
                                @blur=${accountCodeValidationHandler}
                              />
                              <button
                                type="button"
                                class="trailing-icon"
                                aria-label=${`Select account for line ${index + 1}`}
                                commandfor="account-selector-dialog"
                                command="--open"
                                data-journal-entry-line-index=${index}
                              ><material-symbols name="search"></material-symbols></button>
                            </div>
                          </div>
                        </td>
                        <td style="text-align: left; width: 256px;">
                          <label id=${`account-name-${lineId}`} for=${`account-code-${lineId}`} class="account-name">-</label>
                        </td>
                        <td style="text-align: right; width: 128px;">
                          <div class="outlined-text-field" style="--md-sys-density: -4;">
                            <div class="container">
                              <input
                                type="text"
                                name="debit"
                                inputmode="decimal"
                                placeholder=" "
                                value="0"
                                aria-label="Debit"
                                aria-discribedby=${`account-name-${lineId}`}
                                @blur=${debitBlurHandler}
                                style="text-align: right;"
                              />
                          </div>
                        </td>
                        <td style="text-align: right; width: 128px;">
                          <div class="outlined-text-field" style="--md-sys-density: -4;">
                            <div class="container">
                              <input
                                type="text"
                                name="credit"
                                inputmode="decimal"
                                placeholder=" "
                                value="0"
                                aria-label="Credit"
                                aria-discribedby=${`account-name-${lineId}`}
                                @blur=${creditBlurHandler}
                                style="text-align: right;"
                              />
                            </div>
                          </div>
                        </td>
                        <td style="text-align: center; width: 64px;">
                          <button
                            role="button"
                            type="button"
                            aria-label=${`Remove line ${index + 1}`}
                            data-line-id=${lineId}
                            @click=${removeJournalEntryLineHandler}
                            ?disabled=${form.lineIds.length <= 2}
                          ><material-symbols name="delete"></material-symbols></button>
                        </td>
                      </tr>
                    `)}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="3" class="label-medium" style="text-align: right;">Total</td>
                      <td ${totalDebitCell} class="label-medium" style="text-align: right;"></td>
                      <td ${totalCreditCell} class="label-medium" style="text-align: right;"></td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </section>

              <hr>
            </div>
          </form>
        </dialog>

        <dialog ${errorAlertDialog} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>Error</h3>
            </header>
            <div class="content">
              <p>${form.error?.message}</p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  @click=${handleDismissErrorDialog}
                >Dismiss</button>
              </li>
            </menu>
          </div>
        </dialog>

        <account-selector-dialog
          id="account-selector-dialog"
          @account-select=${handleAccountSelect}
        ></account-selector-dialog>
      `);
    });

    useConnectedCallback(host, syncSumOfDebitAndCredit);
  }
}

defineWebComponent('journal-entry-creation-dialog', JournalEntryCreationDialogElement);
