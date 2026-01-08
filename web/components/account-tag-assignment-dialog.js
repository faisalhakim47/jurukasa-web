import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useAttribute } from '#web/hooks/use-attribute.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useElement } from '#web/hooks/use-element.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { sleep } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';

/**
 * @typedef {object} AccountOption
 * @property {number} account_code
 * @property {string} name
 * @property {boolean} hasTag
 */

// Extracted from web/schemas/001-accounting.sql
const tagCategories = /** @type {const} */ ({
  'Account Types': [
    'Asset',
    'Liability',
    'Equity',
    'Revenue',
    'Expense',
    'Contra Asset',
    'Contra Liability',
    'Contra Equity',
    'Contra Revenue',
    'Contra Expense',
  ],
  'Account Classifications': [
    'Current Asset',
    'Non-Current Asset',
    'Current Liability',
    'Non-Current Liability',
  ],
  'Fiscal Year Closing': [
    'Fiscal Year Closing - Retained Earning',
    'Fiscal Year Closing - Revenue',
    'Fiscal Year Closing - Expense',
    'Fiscal Year Closing - Dividend',
  ],
  'Balance Sheet': [
    'Balance Sheet - Current Asset',
    'Balance Sheet - Non-Current Asset',
    'Balance Sheet - Current Liability',
    'Balance Sheet - Non-Current Liability',
    'Balance Sheet - Equity',
  ],
  'Income Statement': [
    'Income Statement - Revenue',
    'Income Statement - Contra Revenue',
    'Income Statement - Other Revenue',
    'Income Statement - COGS',
    'Income Statement - Expense',
    'Income Statement - Other Expense',
  ],
  'Cash Flow Statement': [
    'Cash Flow - Cash Equivalents',
    'Cash Flow - Revenue',
    'Cash Flow - Expense',
    'Cash Flow - Activity - Operating',
    'Cash Flow - Activity - Investing',
    'Cash Flow - Activity - Financing',
    'Cash Flow - Non-Cash - Depreciation',
    'Cash Flow - Non-Cash - Amortization',
    'Cash Flow - Non-Cash - Impairment',
    'Cash Flow - Non-Cash - Gain/Loss',
    'Cash Flow - Non-Cash - Stock Compensation',
    'Cash Flow - Working Capital - Current Asset',
    'Cash Flow - Working Capital - Current Liability',
  ],
  'POS System': [
    'POS - Accounts Payable',
    'POS - Bank Fees',
    'POS - Sales Revenue',
    'POS - Sales Discount',
    'POS - Cost of Goods Sold',
    'POS - Inventory',
    'POS - Inventory Gain',
    'POS - Inventory Shrinkage',
    'POS - Payment Method',
  ],
});

// Tags that can only be assigned to one account
const uniqueTags = [
  'Fiscal Year Closing - Retained Earning',
  'POS - Accounts Payable',
  'POS - Bank Fees',
  'POS - Sales Revenue',
  'POS - Sales Discount',
  'POS - Cost of Goods Sold',
  'POS - Inventory Gain',
  'POS - Inventory Shrinkage',
];

/**
 * Account Tag Assignment Dialog Component
 * 
 * @fires tag-assignment-changed - Fired when tag assignments are changed
 */
export class AccountTagAssignmentDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);

    const t = useTranslator(host);
    const errorAlertDialog = useElement(host, HTMLDialogElement);

    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      accounts: /** @type {AccountOption[]} */ ([]),
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      searchQuery: '',
      isSaving: false,
    });

    /**
     * Get the category of the current tag
     * @returns {string | null}
     */
    function getTagCategory() {
      const tag = dialog.context?.dataset.tag;
      if (!tag) return null;
      for (const [category, tags] of Object.entries(tagCategories)) {
        if (/** @type {readonly string[]} */ (tags).includes(tag)) return category;
      }
      return null;
    }

    /**
     * Check if current tag is unique (only one account can have it)
     * @returns {boolean}
     */
    function isUniqueTag() {
      return uniqueTags.includes(dialog.context?.dataset.tag || '');
    }

    async function loadAccounts() {
      const tag = dialog.context?.dataset.tag;
      if (!tag) {
        state.accounts = [];
        state.isLoading = false;
        return;
      }

      try {
        state.isLoading = true;
        state.error = null;

        const result = await database.sql`
          SELECT
            a.account_code,
            a.name,
            CASE WHEN at.tag IS NOT NULL THEN 1 ELSE 0 END as has_tag
          FROM accounts a
          LEFT JOIN account_tags at ON at.account_code = a.account_code AND at.tag = ${tag}
          WHERE a.is_active = 1
          ORDER BY a.account_code ASC
        `;

        state.accounts = result.rows.map(function (row) {
          return /** @type {AccountOption} */ ({
            account_code: Number(row.account_code),
            name: String(row.name),
            hasTag: Number(row.has_tag) === 1,
          });
        });

        state.isLoading = false;
      }
      catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
        state.isLoading = false;
      }
    }

    useEffect(host, function watchTagAttribute() {
      if (dialog.open) loadAccounts();
    });

    useEffect(host, function watchDialogOpen() {
      if (dialog.open) loadAccounts();
    });

    /**
     * @param {number} accountCode
     */
    async function assignTag(accountCode) {
      const tag = dialog.context?.dataset.tag;
      if (!tag) return;

      const tx = await database.transaction('write');

      try {
        state.isSaving = true;

        // For unique tags, remove from any other account first
        if (isUniqueTag()) {
          await tx.sql`
            DELETE FROM account_tags WHERE tag = ${tag}
          `;
        }

        await tx.sql`
          INSERT INTO account_tags (account_code, tag)
          VALUES (${accountCode}, ${tag})
        `;

        await tx.commit();

        for (const account of state.accounts) {
          if (isUniqueTag()) account.hasTag = false;
          if (account.account_code === accountCode) account.hasTag = true;
        }

        host.dispatchEvent(new CustomEvent('tag-assignment-changed', {
          detail: { tag, accountCode, action: 'assign' },
          bubbles: true,
          composed: true,
        }));
      }
      catch (error) {
        await tx.rollback();
        state.error = error instanceof Error ? error : new Error(String(error));
      }
      finally {
        state.isSaving = false;
      }
    }

    /**
     * @param {number} accountCode
     */
    async function removeTag(accountCode) {
      const tag = dialog.context?.dataset.tag;
      if (!tag) return;

      try {
        state.isSaving = true;

        await database.sql`
          DELETE FROM account_tags
          WHERE account_code = ${accountCode} AND tag = ${tag}
        `;

        for (const account of state.accounts) {
          if (account.account_code === accountCode) {
            account.hasTag = false;
            break;
          }
        }

        host.dispatchEvent(new CustomEvent('tag-assignment-changed', {
          detail: { tag, accountCode, action: 'remove' },
          bubbles: true,
          composed: true,
        }));
      }
      catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
      }
      finally {
        state.isSaving = false;
      }
    }

    /** @param {Event} event */
    function handleToggleTagInteraction(event) {
      if (event instanceof KeyboardEvent && !['Enter', ' '].includes(event.key)) return;
      assertInstanceOf(HTMLTableRowElement, event.currentTarget);
      const accountCode = parseInt(event.currentTarget.dataset.accountCode, 10);
      const hasTag = event.currentTarget.dataset.hasTag === 'true';
      if (hasTag) removeTag(accountCode);
      else assignTag(accountCode);
    };

    /** @param {Event} event */
    function handleSearchInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.searchQuery = event.target.value;
    }

    function getFilteredAccounts() {
      if (!state.searchQuery.trim()) return state.accounts;
      const query = state.searchQuery.toLowerCase();
      return state.accounts.filter(function (account) {
        return account.name.toLowerCase().includes(query)
          || String(account.account_code).includes(query);
      });
    }

    function handleDismissErrorDialog() {
      state.error = null;
    }

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label="${t('account', 'loadingAccountsAriaLabel')}"
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            min-height: 200px;
            color: var(--md-sys-color-on-surface-variant);
          "
        >
          <div role="progressbar" class="linear indeterminate" style="width: 200px;">
            <div class="track">
              <div class="indicator"></div>
            </div>
          </div>
          <p>${t('account', 'loadingAccountsMessage')}</p>
        </div>
      `;
    }

    function renderEmptyState() {
      return html`
        <div
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            min-height: 200px;
            text-align: center;
            padding: 24px;
          "
        >
          <material-symbols name="search_off" size="48"></material-symbols>
          <p style="color: var(--md-sys-color-on-surface-variant);">
            ${state.searchQuery ? t('account', 'noAccountsMatchMessage') : t('account', 'noActiveAccountsMessage')}
          </p>
        </div>
      `;
    }

    /**
     * @param {AccountOption} account
     */
    function renderAccountRow(account) {
      return html`
        <tr
          tabindex="0"
          aria-label="Account ${account.name}"
          data-account-code=${account.account_code}
          data-has-tag=${account.hasTag ? 'true' : 'false'}
          @click=${handleToggleTagInteraction}
          @keydown=${handleToggleTagInteraction}
        >
          <td style="width: 48px; text-align: center;">
            <span
              style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                border-radius: var(--md-sys-shape-corner-extra-small);
                border: 2px solid ${account.hasTag ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'};
                background-color: ${account.hasTag ? 'var(--md-sys-color-primary)' : 'transparent'};
                transition: all 0.2s ease;
              "
            >
              ${account.hasTag ? html`
                <material-symbols name="check" size="18" style="color: var(--md-sys-color-on-primary);"></material-symbols>
              ` : nothing}
            </span>
          </td>
          <td class="label-large" style="color: var(--md-sys-color-primary); width: 100px;">${account.account_code}</td>
          <td>${account.name}</td>
        </tr>
      `;
    }

    function renderAccountsList() {
      const filteredAccounts = getFilteredAccounts();
      if (filteredAccounts.length === 0) return renderEmptyState();

      const assignedCount = state.accounts.filter(function (account) {
        return account.hasTag;
      }).length;

      return html`
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <p class="body-small" style="color: var(--md-sys-color-on-surface-variant);">
              ${assignedCount === 1 ? t('account', 'accountsAssignedMessage', assignedCount) : t('account', 'accountsAssignedMessagePlural', assignedCount)}
              ${isUniqueTag() ? html`<span style="color: var(--md-sys-color-error);">${' ' + t('account', 'uniqueTagWarning')}</span>` : nothing}
            </p>
          </div>
          <div style="max-height: 400px; overflow-y: auto;">
            <table aria-label="${t('account', 'accountsListAriaLabel')}" style="--md-sys-density: -3;">
              <thead>
                <tr>
                  <th scope="col" style="width: 48px;"></th>
                  <th scope="col" style="width: 100px;">${t('account', 'tableHeaderCode')}</th>
                  <th scope="col">${t('account', 'tableHeaderName')}</th>
                </tr>
              </thead>
              <tbody>
                ${filteredAccounts.map(renderAccountRow)}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    useEffect(host, function renderDialog() {
      const category = getTagCategory();

      render(html`
        <dialog
          ${dialog.element}
          id="account-tag-assignment-dialog"
          class="full-screen"
          aria-labelledby="account-tag-assignment-dialog-title"
        >
          <div class="container">
            <header>
              <h2 id="account-tag-assignment-dialog-title">${t('account', 'manageTagDialogTitle', dialog.context?.dataset.tag || 'Unknown')}</h2>
              <button
                role="button"
                type="button"
                class="text"
                commandfor="account-tag-assignment-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
            </header>

            <div class="content" style="display: flex; flex-direction: column; gap: 16px;">
              ${state.isSaving ? html`
                <div role="status" aria-live="polite" aria-busy="true">
                  <div role="progressbar" class="linear indeterminate">
                    <div class="track"><div class="indicator"></div></div>
                  </div>
                </div>
              ` : nothing}

              ${category ? html`
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('account', 'categoryLabel')}</span>
                  <span
                    class="label-medium"
                    style="
                      display: inline-flex;
                      padding: 4px 8px;
                      border-radius: var(--md-sys-shape-corner-small);
                      background-color: var(--md-sys-color-secondary-container);
                      color: var(--md-sys-color-on-secondary-container);
                    "
                  >${category}</span>
                </div>
              ` : nothing}

              <!-- Search Field -->
              <div class="outlined-text-field" style="--md-sys-density: -4;">
                <div class="container">
                  <material-symbols name="search" class="leading-icon" aria-hidden="true"></material-symbols>
                  <label for="account-search-input">${t('account', 'searchAccountsLabel')}</label>
                  <input
                    id="account-search-input"
                    type="text"
                    placeholder=" "
                    autocomplete="off"
                    @input=${handleSearchInput}
                  />
                </div>
              </div>

              ${state.isLoading ? renderLoadingIndicator() : renderAccountsList()}
            </div>
          </div>
        </dialog>

        <dialog ${errorAlertDialog} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>${t('account', 'errorDialogTitle')}</h3>
            </header>
            <div class="content">
              <p>${state.error?.message}</p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  @click=${handleDismissErrorDialog}
                >${t('account', 'dismissButtonLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('account-tag-assignment-dialog', AccountTagAssignmentDialogElement);
