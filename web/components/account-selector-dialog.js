import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { readValue } from '#web/directives/read-value.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useAttribute } from '#web/hooks/use-attribute.js';
import { useContext } from '#web/hooks/use-context.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { useExposed } from '#web/hooks/use-exposed.js';
import { useRender } from '#web/hooks/use-render.js';
import { webStyleSheets } from '#web/styles.js';

import '#web/components/material-symbols.js';

/**
 * @typedef {object} AccountRow
 * @property {number} account_code
 * @property {string} name
 * @property {number} normal_balance
 * @property {number} balance
 * @property {number} is_active
 * @property {number} is_posting_account
 * @property {string | null} account_type - Derived from account_tags (Asset, Liability, etc.)
 */

/**
 * @typedef {HTMLElementEventMap & { 'account-select': CustomEvent<{ accountCode: string, accountName: string, journalEntryLineIndex: string }> }} AccountSelectorDialogElementEventMap
 */

/**
 * @template {keyof AccountSelectorDialogElementEventMap} K
 * @typedef {(type: K, listener: (this: AccountSelectorDialogElement, ev: AccountSelectorDialogElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions) => void} AccountSelectorDialogElementAddEventListenerType
 */

/**
 * Account Selector Dialog Component
 * 
 * A dialog for searching and selecting accounts.
 * 
 * @class
 * @property {AccountSelectorDialogElementAddEventListenerType} addEventListener - Add event listener method
 * 
 * @example assuming we use lit-html for rendering
    <button
      type="button"
      commandfor="account-selector-dialog"
      command="--open"
    >Select Account</button>
    <account-selector-dialog
      id="account-selector-dialog"
      @account-select=${() => console.log('Selected:', event.detail.accountCode, event.detail.accountName)}
    ></account-selector-dialog>
 */
export class AccountSelectorDialogElement extends HTMLElement {
  static observedAttributes = ['filter-tag'];

  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const searchInputElement = useElement(host, HTMLInputElement);
    const filterTagAttr = useAttribute(host, 'filter-tag');

    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      accounts: /** @type {AccountRow[]} */ ([]),
      searchQuery: '',
      isLoading: false,
      error: /** @type {Error | null} */ (null),
    });

    this.open = useExposed(host, function readDialogState() {
      return dialog.open;
    });

    useEffect(host, async function loadAccounts() {
      if (!dialog.open) {
        // Reset state when dialog closes
        state.searchQuery = '';
        return;
      }

      const query = state.searchQuery.trim();
      const filterTag = filterTagAttr.value || null;

      try {
        state.isLoading = true;
        state.error = null;

        // Query active posting accounts with their primary account type tag
        const result = await database.sql`
          SELECT
            a.account_code,
            a.name,
            a.normal_balance,
            a.balance,
            a.is_active,
            a.is_posting_account,
            (
              SELECT at.tag
              FROM account_tags at
              WHERE at.account_code = a.account_code
                AND at.tag IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')
              LIMIT 1
            ) as account_type
          FROM accounts a
          WHERE a.is_active = 1
            AND a.is_posting_account = 1
            AND (
              ${query} = ''
              OR a.account_code LIKE '%' || ${query} || '%'
              OR a.name LIKE '%' || ${query} || '%'
            )
            AND (
              ${filterTag} IS NULL
              OR EXISTS (
                SELECT 1 FROM account_tags at
                WHERE at.account_code = a.account_code
                  AND at.tag = ${filterTag}
              )
            )
          ORDER BY a.account_code ASC
        `;

        state.accounts = result.rows.map(function (row) {
          return /** @type {AccountRow} */ ({
            account_code: Number(row.account_code),
            name: String(row.name),
            normal_balance: Number(row.normal_balance),
            balance: Number(row.balance),
            is_active: Number(row.is_active),
            is_posting_account: Number(row.is_posting_account),
            account_type: row.account_type ? String(row.account_type) : null,
          });
        });
      }
      catch (error) {
        console.error('Failed to load accounts:', error);
        state.error = error instanceof Error ? error : new Error(String(error));
      }
      finally {
        state.isLoading = false;
      }
    });

    /** @param {Event} event */
    function handleAccountSelect(event) {
      const validEvent = (event instanceof MouseEvent && event.type === 'click')
        || (event instanceof KeyboardEvent && (['Enter', ' '].includes(event.key)));
      if (!validEvent) return;

      const listItem = event.currentTarget;
      if (!(listItem instanceof HTMLElement)) return;

      const accountCode = Number(listItem.dataset.value);
      const accountName = String(listItem.dataset.name);

      const journalEntryLineIndex = dialog.context?.dataset?.journalEntryLineIndex;

      host.dispatchEvent(new CustomEvent('account-select', {
        detail: { accountCode, accountName, journalEntryLineIndex },
        bubbles: true,
        composed: true,
      }));

      dialog.open = false;
    }

    function renderLoadingIndicator() {
      return html`
        <section class="loading-state" role="status" aria-live="polite" aria-label="Loading accounts">
          <div role="progressbar" class="linear indeterminate">
            <div class="track">
              <div class="indicator"></div>
            </div>
          </div>
          <p>Loading accounts...</p>
        </section>
      `;
    }

    function renderErrorNotice() {
      return html`
        <section role="alert" aria-live="assertive">
          <material-symbols name="error" size="48"></material-symbols>
          <h3>Unable to load accounts</h3>
          <p>${state.error.message}</p>
        </section>
      `;
    }

    function renderAccountList() {
      const filteredAccounts = state.accounts;
      if (filteredAccounts.length === 0) return html`
        <section aria-live="polite" style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
          <material-symbols name="search_off" size="48"></material-symbols>
          <p>${state.searchQuery ? 'No accounts match your search' : 'No accounts available'}</p>
        </section>
      `;
      else return html`
        <menu role="list" aria-label="Available accounts" style="max-height: 320px; overflow-y: auto;">
          ${repeat(filteredAccounts, account => account.account_code, account => html`
            <li
              role="menuitemradio"
              aria-checked="false"
              class="divider-inset"
              tabindex="0"
              data-value=${account.account_code}
              data-name=${account.name}
              @click=${handleAccountSelect}
              @keydown=${handleAccountSelect}
            >
              <div class="content">
                <div class="headline">${account.name}</div>
                <div class="supporting-text">
                  <span class="account-code">${account.account_code}</span>
                  ${account.account_type ? html`<span class="account-type-badge">${account.account_type}</span>` : nothing}
                </div>
              </div>
              <div class="trailing text">
                ${i18n.displayCurrency(account.balance)}
              </div>
            </li>
          `)}
        </menu>
      `;
    }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="account-selector-dialog"
          aria-labelledby="account-selector-dialog-title"
        >
          <form class="container" style="max-width: min(320px, 90vw);">
            <header>
              <h2 id="account-selector-dialog-title">Select Account</h2>
            </header>

            <div class="content">
              <div class="outlined-text-field" style="--md-sys-density: -4;">
                <div class="container">
                  <material-symbols name="search" class="leading-icon" aria-hidden="true"></material-symbols>
                  <label for="account-search">Search accounts</label>
                  <input
                    ${searchInputElement}
                    ${readValue(state, 'searchQuery')}
                    id="account-search"
                    type="text"
                    placeholder=" "
                    autocomplete="off"
                  />
                </div>
              </div>
              ${state.isLoading ? renderLoadingIndicator() : nothing}
              ${state.error instanceof Error ? renderErrorNotice() : nothing}
              ${!state.isLoading ? renderAccountList() : nothing}
            </div>

            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  commandfor="account-selector-dialog"
                  command="close"
                  style="--sys-md-density: -4;"
                >Cancel</button>
              </li>
            </menu>
          </form>
        </dialog>
      `);
    });
  }
}

defineWebComponent('account-selector-dialog', AccountSelectorDialogElement);
