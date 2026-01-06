import { html, nothing } from 'lit-html';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { AccountTagAssignmentDialogElement } from '#web/components/account-tag-assignment-dialog.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { readValue } from '#web/directives/read-value.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { useRender } from '#web/hooks/use-render.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

import '#web/components/material-symbols.js';
import '#web/components/account-tag-assignment-dialog.js';

/** @import { TemplateResult } from 'lit-html' */

/**
 * @typedef {object} AccountTagRow
 * @property {number} account_code
 * @property {string} account_name
 * @property {string} tag
 */

/**
 * @typedef {object} TagSummary
 * @property {string} tag
 * @property {number} count
 * @property {AccountTagRow[]} accounts
 */

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

const allTags = Object.values(tagCategories).flat();

const categoryOptions = /** @type {const} */ (['All', ...Object.keys(tagCategories)]);

/** @typedef {typeof categoryOptions[number]} CategoryFilter */

export class AccountTagsViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);

    const accountTagAssignmentDialog = useElement(host, AccountTagAssignmentDialogElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      accountTags: /** @type {AccountTagRow[]} */ ([]),
      tagSummaries: /** @type {TagSummary[]} */ ([]),
      expandedTags: /** @type {Set<string>} */ (new Set()),
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      categoryFilter: /** @type {CategoryFilter} */ ('All'),
      searchQuery: '',
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false;
    });

    /**
     * Get tags filtered by category
     * @returns {string[]}
     */
    function getFilteredTags() {
      if (state.categoryFilter === 'All') return allTags;
      return tagCategories[state.categoryFilter] || [];
    }

    /**
     * Build tag summaries from account tags
     * @param {AccountTagRow[]} accountTags
     * @returns {TagSummary[]}
     */
    function buildTagSummaries(accountTags) {
      const tagMap = new Map();

      // Initialize all tags with empty arrays
      const filteredTags = getFilteredTags();
      for (const tag of filteredTags) {
        tagMap.set(tag, { tag, count: 0, accounts: [] });
      }

      // Populate with actual data
      for (const row of accountTags) {
        if (!filteredTags.includes(row.tag)) continue;
        const summary = tagMap.get(row.tag);
        if (summary) {
          summary.count++;
          summary.accounts.push(row);
        }
      }

      // Filter by search query
      let summaries = Array.from(tagMap.values());
      if (state.searchQuery.trim()) {
        const query = state.searchQuery.toLowerCase();
        summaries = summaries.filter(function (summary) {
          const matchesTag = summary.tag.toLowerCase().includes(query);
          const matchesAccount = summary.accounts.some(function (account) {
            return account.account_name.toLowerCase().includes(query)
              || String(account.account_code).includes(query);
          });
          return matchesTag || matchesAccount;
        });
      }

      // Sort by tag name
      summaries.sort(function (a, b) {
        return a.tag.localeCompare(b.tag);
      });

      return summaries;
    }

    async function loadAccountTags() {
      try {
        state.isLoading = true;
        state.error = null;

        const result = await database.sql`
          SELECT
            at.account_code,
            a.name as account_name,
            at.tag
          FROM account_tags at
          JOIN accounts a ON a.account_code = at.account_code
          ORDER BY at.tag, a.account_code
        `;

        state.accountTags = result.rows.map(function (row) {
          return /** @type {AccountTagRow} */ ({
            account_code: Number(row.account_code),
            account_name: String(row.account_name),
            tag: String(row.tag),
          });
        });

        state.tagSummaries = buildTagSummaries(state.accountTags);
        state.isLoading = false;
      }
      catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
        state.isLoading = false;
      }
    }

    useEffect(host, loadAccountTags);

    /** @param {Event} event */
    function handleCategoryFilterChange(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      state.categoryFilter = /** @type {CategoryFilter} */ (event.currentTarget.dataset.category);
      state.tagSummaries = buildTagSummaries(state.accountTags);
    }

    /** @param {Event} event */
    function handleSearchInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.searchQuery = event.target.value;
      state.tagSummaries = buildTagSummaries(state.accountTags);
    }

    /** @param {Event} event */
    function toggleTagExpanded(event) {
      assertInstanceOf(HTMLTableRowElement, event.currentTarget);
      const tag = event.currentTarget.dataset.tag;
      if (!tag) return;
      if (state.expandedTags.has(tag)) state.expandedTags.delete(tag);
      else state.expandedTags.add(tag);
      // Rebuild summaries to update expanded state
      state.tagSummaries = buildTagSummaries(state.accountTags);
    }

    /** @param {Event} event */
    function handleRowKeydown(event) {
      assertInstanceOf(KeyboardEvent, event);
      if (['Enter', ' '].includes(event.key)) {
        toggleTagExpanded(event);
        event.preventDefault();
      }
    }

    function expandAll() {
      for (const tag of allTags) {
        state.expandedTags.add(tag);
      }
      state.tagSummaries = buildTagSummaries(state.accountTags);
    }

    function collapseAll() {
      state.expandedTags.clear();
      state.tagSummaries = buildTagSummaries(state.accountTags);
    }

    /**
     * @param {number} accountCode
     * @param {string} tag
     */
    async function removeTagFromAccount(accountCode, tag) {
      try {
        await database.sql`
          DELETE FROM account_tags
          WHERE account_code = ${accountCode} AND tag = ${tag}
        `;
        await loadAccountTags();
      }
      catch (error) {
        console.error('Failed to remove tag:', error);
        alert('Failed to remove tag: ' + (error instanceof Error ? error.message : String(error)));
      }
    }

    /**
     * @param {number} accountCode
     * @param {string} tag
     */
    function handleRemoveTagClick(accountCode, tag) {
      return function (event) {
        event.stopPropagation();
        removeTagFromAccount(accountCode, tag);
      };
    }

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label="Loading account tags"
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
          <p>Loading account tags...</p>
        </div>
      `;
    }

    /**
     * @param {Error} error
     */
    function renderErrorNotice(error) {
      return html`
        <div
          role="alert"
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
          <material-symbols name="error" size="48"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">Unable to load account tags</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadAccountTags}>
            <material-symbols name="refresh"></material-symbols>
            Retry
          </button>
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
            min-height: 300px;
            text-align: center;
            padding: 48px;
          "
        >
          <material-symbols name="label" size="64"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">No account tags found</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            ${state.searchQuery
          ? 'Try adjusting your search or filters.'
          : 'Account tags are used to categorize accounts for financial reporting. Create accounts and assign tags to organize your chart of accounts.'}
          </p>
        </div>
      `;
    }

    function renderFilterControls() {
      return html`
        <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; flex-wrap: wrap;">
          <!-- Search Field -->
          <div class="outlined-text-field" style="--md-sys-density: -4; width: 200px; min-width: 160px;">
            <div class="container">
              <material-symbols name="search" class="leading-icon" aria-hidden="true"></material-symbols>
              <label for="tag-search-input">Search</label>
              <input
                ${readValue(state, 'searchQuery')}
                id="tag-search-input"
                type="text"
                placeholder=" "
                autocomplete="off"
                @input=${handleSearchInput}
              />
            </div>
          </div>

          <!-- Category Filter -->
          <div class="outlined-text-field" style="--md-sys-density: -4; min-width: 180px; anchor-name: --category-menu-anchor;">
            <div class="container">
              <label for="category-filter-input">Category</label>
              <input
                id="category-filter-input"
                type="button"
                value="${state.categoryFilter}"
                popovertarget="category-filter-menu"
                popovertargetaction="show"
                placeholder=" "
              />
              <label for="category-filter-input" class="trailing-icon">
                <material-symbols name="arrow_drop_down"></material-symbols>
              </label>
            </div>
          </div>
          <menu role="menu" popover id="category-filter-menu" aria-label="Category filter" class="dropdown" style="position-anchor: --category-menu-anchor;">
            ${categoryOptions.map(function (category) {
        return html`
                <li>
                  <button
                    role="menuitem"
                    data-category="${category}"
                    @click=${handleCategoryFilterChange}
                    popovertarget="category-filter-menu"
                    popovertargetaction="hide"
                    aria-selected=${category === state.categoryFilter ? 'true' : 'false'}
                  >
                    ${category === state.categoryFilter ? html`<material-symbols name="check"></material-symbols>` : ''}
                    ${category}
                  </button>
                </li>
              `;
      })}
          </menu>
        </div>
      `;
    }

    /**
     * @param {string} tag
     */
    function getTagCategoryStyle(tag) {
      if (/** @type {readonly string[]} */ (tagCategories['Account Types']).includes(tag)) {
        return 'background-color: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container);';
      }
      if (/** @type {readonly string[]} */ (tagCategories['Account Classifications']).includes(tag)) {
        return 'background-color: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container);';
      }
      if (/** @type {readonly string[]} */ (tagCategories['Fiscal Year Closing']).includes(tag)) {
        return 'background-color: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container);';
      }
      if (/** @type {readonly string[]} */ (tagCategories['Balance Sheet']).includes(tag)) {
        return 'background-color: #E3F2FD; color: #1565C0;';
      }
      if (/** @type {readonly string[]} */ (tagCategories['Income Statement']).includes(tag)) {
        return 'background-color: #E8F5E9; color: #2E7D32;';
      }
      if (/** @type {readonly string[]} */ (tagCategories['Cash Flow Statement']).includes(tag)) {
        return 'background-color: #FFF3E0; color: #E65100;';
      }
      if (/** @type {readonly string[]} */ (tagCategories['POS System']).includes(tag)) {
        return 'background-color: #F3E5F5; color: #7B1FA2;';
      }
      return 'background-color: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface-variant);';
    }

    /**
     * @param {TagSummary} summary
     * @returns {TemplateResult[]}
     */
    function renderTagRowWithAccounts(summary) {
      const isExpanded = state.expandedTags.has(summary.tag);
      const hasAccounts = summary.accounts.length > 0;
      const rows = /** @type {TemplateResult[]} */ ([]);

      // Main tag row
      rows.push(html`
        <tr
          tabindex="0"
          aria-label="Tag ${summary.tag}"
          style="cursor: ${hasAccounts ? 'pointer' : 'default'};"
          data-tag="${summary.tag}"
          @click=${hasAccounts ? toggleTagExpanded : nothing}
          @keydown=${hasAccounts ? handleRowKeydown : nothing}
        >
          <td style="white-space: nowrap;">
            <span style="display: flex; align-items: center; gap: 8px;">
              ${hasAccounts ? html`
                <material-symbols
                  name="${isExpanded ? 'keyboard_arrow_down' : 'chevron_right'}"
                  size="20"
                  aria-hidden="true"
                ></material-symbols>
              ` : html`<span style="width: 20px;"></span>`}
              <span
                class="label-medium"
                style="
                  display: inline-flex;
                  padding: 4px 8px;
                  border-radius: var(--md-sys-shape-corner-small);
                  ${getTagCategoryStyle(summary.tag)}
                "
              >${summary.tag}</span>
            </span>
          </td>
          <td class="center">
            <span
              class="label-small"
              style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 24px;
                height: 24px;
                padding: 0 8px;
                border-radius: var(--md-sys-shape-corner-full);
                background-color: ${summary.count > 0 ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)'};
                color: ${summary.count > 0 ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)'};
              "
            >${summary.count}</span>
          </td>
          <td class="center">
            <button
              role="button"
              class="text extra-small"
              title="Manage tag assignments"
              aria-label="Manage ${summary.tag} tag assignments"
              commandfor="account-tag-assignment-dialog"
              command="--open"
              data-tag="${summary.tag}"
            >
              <material-symbols name="edit" size="20"></material-symbols>
            </button>
          </td>
        </tr>
      `);

      // Account sub-rows (when expanded)
      if (isExpanded && hasAccounts) {
        for (const account of summary.accounts) {
          rows.push(html`
            <tr class="nested-row" aria-label="Account ${account.account_name}" style="background-color: var(--md-sys-color-surface-container-low);">
              <td style="padding-left: 52px;">
                <span style="display: flex; align-items: center; gap: 8px;">
                  <span class="label-large" style="color: var(--md-sys-color-primary);">${account.account_code}</span>
                  <span>${account.account_name}</span>
                </span>
              </td>
              <td></td>
              <td class="center">
                <button
                  role="button"
                  class="text extra-small"
                  title="Remove tag from account"
                  aria-label="Remove ${summary.tag} tag from ${account.account_name}"
                  @click=${handleRemoveTagClick(account.account_code, summary.tag)}
                >
                  <material-symbols name="close" size="18"></material-symbols>
                </button>
              </td>
            </tr>
          `);
        }
      }

      return rows;
    }

    function renderAccountTagsTable() {
      if (state.tagSummaries.length === 0) return renderEmptyState();

      return html`
        <div>
          <table role="treegrid" aria-label="Account Tags" style="--md-sys-density: -4;">
            <thead>
              <tr>
                <th scope="col">Tag</th>
                <th scope="col" class="center" style="width: 100px;">Accounts</th>
                <th scope="col" class="center" style="width: 80px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${state.tagSummaries.flatMap(renderTagRowWithAccounts)}
            </tbody>
          </table>
        </div>
      `;
    }

    useEffect(host, function renderAccountTagsView() {
      render(html`
        <div style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 12px 24px; height: 100%; overflow-y: scroll;">
          <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; justify-content: space-between;">
            ${renderFilterControls()}
            <div>
              <button role="button" class="text" @click=${expandAll} aria-label="Expand all tags" title="Expand All">
                <material-symbols name="unfold_more"></material-symbols>
              </button>
              <button role="button" class="text" @click=${collapseAll} aria-label="Collapse all tags" title="Collapse All">
                <material-symbols name="unfold_less"></material-symbols>
              </button>
              <button role="button" class="text" @click=${loadAccountTags} aria-label="Refresh account tags">
                <material-symbols name="refresh"></material-symbols>
                Refresh
              </button>
            </div>
          </div>

          ${state.isLoading ? renderLoadingIndicator() : nothing}
          ${state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
          ${state.isLoading === false && state.error === null ? renderAccountTagsTable() : nothing}
        </div>

        <account-tag-assignment-dialog
          ${accountTagAssignmentDialog}
          id="account-tag-assignment-dialog"
          @tag-assignment-changed=${loadAccountTags}
        ></account-tag-assignment-dialog>
      `);
    });
  }
}

defineWebComponent('account-tags-view', AccountTagsViewElement);
