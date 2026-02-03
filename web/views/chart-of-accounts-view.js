import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { AccountCreationDialogElement } from '#web/components/account-creation-dialog.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { readValue } from '#web/directives/read-value.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

import '#web/components/material-symbols.js';
import '#web/components/account-creation-dialog.js';

/** @import { TemplateResult } from 'lit-html' */


/**
 * @typedef {object} AccountRow
 * @property {number} account_code
 * @property {string} name
 * @property {number} normal_balance
 * @property {number} balance
 * @property {number} is_active
 * @property {number} is_posting_account
 * @property {number | null} control_account_code
 * @property {string | null} account_type
 * @property {string[]} tags
 */

/**
 * @typedef {object} AccountTreeNode
 * @property {AccountRow} account
 * @property {AccountTreeNode[]} children
 * @property {boolean} expanded
 * @property {number} level
 */

const accountTypes = /** @type {const} */ (['All', 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense']);
const statusTypes = /** @type {const} */ (['All', 'Active', 'Inactive']);

/** @typedef {typeof accountTypes[number]} AccountType */
/** @typedef {typeof statusTypes[number]} StatusType */

export class ChartOfAccountsViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);

    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      accounts: /** @type {AccountRow[]} */ ([]),
      accountTree: /** @type {AccountTreeNode[]} */ ([]),
      expandedCodes: /** @type {Set<number>} */ (new Set()),
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      typeFilter: /** @type {AccountType} */ ('All'),
      statusFilter: /** @type {StatusType} */ ('Active'),
      searchQuery: '',
      selectedAccountCode: /** @type {number | null} */ (null),
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false;
    });

    /**
     * Build hierarchical tree from flat account list
     * @param {AccountRow[]} accounts
     * @returns {AccountTreeNode[]}
     */
    function buildAccountTree(accounts) {
      const accountMap = new Map();
      const rootNodes = /** @type {AccountTreeNode[]} */ ([]);

      // Create nodes for all accounts
      for (const account of accounts) {
        accountMap.set(account.account_code, {
          account,
          children: [],
          expanded: state.expandedCodes.has(account.account_code),
          level: 0,
        });
      }

      // Build parent-child relationships
      for (const account of accounts) {
        const node = accountMap.get(account.account_code);
        if (account.control_account_code && accountMap.has(account.control_account_code)) {
          const parentNode = accountMap.get(account.control_account_code);
          parentNode.children.push(node);
          node.level = parentNode.level + 1;
        } else {
          rootNodes.push(node);
        }
      }

      // Calculate levels recursively
      /**
       * @param {AccountTreeNode} node
       * @param {number} level
       */
      function setLevels(node, level) {
        node.level = level;
        for (const child of node.children) {
          setLevels(child, level + 1);
        }
      }

      for (const root of rootNodes) {
        setLevels(root, 0);
      }

      // Sort children by account_code
      /**
       * @param {AccountTreeNode} node
       */
      function sortChildren(node) {
        node.children.sort((a, b) => a.account.account_code - b.account.account_code);
        for (const child of node.children) {
          sortChildren(child);
        }
      }

      rootNodes.sort((a, b) => a.account.account_code - b.account.account_code);
      for (const root of rootNodes) {
        sortChildren(root);
      }

      return rootNodes;
    }

    /**
     * Get filtered accounts based on current filter state
     * @param {AccountRow[]} accounts
     * @returns {AccountRow[]}
     */
    function filterAccounts(accounts) {
      return accounts.filter(function (account) {
        // Type filter
        if (state.typeFilter !== 'All') {
          if (account.account_type !== state.typeFilter) return false;
        }

        // Status filter
        if (state.statusFilter === 'Active' && !account.is_active) return false;
        if (state.statusFilter === 'Inactive' && account.is_active) return false;

        // Search filter
        if (state.searchQuery.trim()) {
          const query = state.searchQuery.toLowerCase();
          const matchesCode = String(account.account_code).includes(query);
          const matchesName = account.name.toLowerCase().includes(query);
          if (!matchesCode && !matchesName) return false;
        }

        return true;
      });
    }

    async function loadAccounts() {
      try {
        state.isLoading = true;
        state.error = null;

        const result = await database.sql`
          SELECT
            a.account_code,
            a.name,
            a.normal_balance,
            a.balance,
            a.is_active,
            a.is_posting_account,
            a.control_account_code,
            (
              SELECT at.tag
              FROM account_tags at
              WHERE at.account_code = a.account_code
                AND at.tag IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')
              LIMIT 1
            ) as account_type,
            (
              SELECT GROUP_CONCAT(at.tag, ', ')
              FROM account_tags at
              WHERE at.account_code = a.account_code
            ) as tags
          FROM accounts a
          ORDER BY a.account_code ASC
        `;

        state.accounts = result.rows.map(function rowToAccount(row) {
          return /** @type {AccountRow} */ ({
            account_code: Number(row.account_code),
            name: String(row.name),
            normal_balance: Number(row.normal_balance),
            balance: Number(row.balance),
            is_active: Number(row.is_active),
            is_posting_account: Number(row.is_posting_account),
            control_account_code: row.control_account_code ? Number(row.control_account_code) : null,
            account_type: row.account_type ? String(row.account_type) : null,
            tags: row.tags ? String(row.tags).split(', ') : [],
          });
        });

        // Build tree from filtered accounts
        const filteredAccounts = filterAccounts(state.accounts);

        // When filtering, we need to include parent accounts even if they don't match
        // to maintain the hierarchical structure
        const accountsToInclude = new Set(filteredAccounts.map((a) => a.account_code));

        // Add parent accounts for any filtered account
        for (const account of filteredAccounts) {
          let parentCode = account.control_account_code;
          while (parentCode !== null) {
            accountsToInclude.add(parentCode);
            const parentAccount = state.accounts.find((a) => a.account_code === parentCode);
            parentCode = parentAccount ? parentAccount.control_account_code : null;
          }
        }

        const accountsForTree = state.accounts.filter((a) => accountsToInclude.has(a.account_code));
        state.accountTree = buildAccountTree(accountsForTree);

        state.isLoading = false;
      } catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
        state.isLoading = false;
      }
    }

    /** @param {Event} event */
    function toggleExpanded(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      const button = event.currentTarget;
      const hasChildren = button.dataset.hasChildren === 'true';
      if (!hasChildren) return; // No children to expand/collapse
      const accountCode = Number(button.dataset.accountCode);
      if (state.expandedCodes.has(accountCode)) state.expandedCodes.delete(accountCode);
      else state.expandedCodes.add(accountCode);
      // Rebuild tree to update expanded state
      const accountsToInclude = new Set(filterAccounts(state.accounts).map(function (account) {
        return account.account_code;
      }));
      for (const account of filterAccounts(state.accounts)) {
        let parentCode = account.control_account_code;
        while (parentCode !== null) {
          accountsToInclude.add(parentCode);
          const parentAccount = state.accounts.find(function (account) {
            return account.account_code === parentCode;
          });
          parentCode = parentAccount ? parentAccount.control_account_code : null;
        }
      }
      const accountsForTree = state.accounts.filter(function (account) {
        return accountsToInclude.has(account.account_code);
      });
      state.accountTree = buildAccountTree(accountsForTree);
    }

    function expandAll() {
      for (const account of state.accounts) {
        if (!account.is_posting_account) state.expandedCodes.add(account.account_code);
      }
      const accountsToInclude = new Set(filterAccounts(state.accounts).map(function (account) {
        return account.account_code;
      }));
      for (const account of filterAccounts(state.accounts)) {
        let parentCode = account.control_account_code;
        while (parentCode !== null) {
          accountsToInclude.add(parentCode);
          const parentAccount = state.accounts.find(function (account) {
            return account.account_code === parentCode;
          });
          parentCode = parentAccount ? parentAccount.control_account_code : null;
        }
      }
      const accountsForTree = state.accounts.filter(function (account) {
        return accountsToInclude.has(account.account_code);
      });
      state.accountTree = buildAccountTree(accountsForTree);
    }

    function collapseAll() {
      state.expandedCodes.clear();
      const accountsToInclude = new Set(filterAccounts(state.accounts).map(function (account) {
        return account.account_code;
      }));
      for (const account of filterAccounts(state.accounts)) {
        let parentCode = account.control_account_code;
        while (parentCode !== null) {
          accountsToInclude.add(parentCode);
          const parentAccount = state.accounts.find(function (account) {
            return account.account_code === parentCode;
          });
          parentCode = parentAccount ? parentAccount.control_account_code : null;
        }
      }
      const accountsForTree = state.accounts.filter(function (account) {
        return accountsToInclude.has(account.account_code);
      });
      state.accountTree = buildAccountTree(accountsForTree);
    }

    /** @param {Event} event */
    function handleTypeFilterChange(event) {
      if (!(event.currentTarget instanceof HTMLButtonElement)) return;
      state.typeFilter = /** @type {AccountType} */ (event.currentTarget.dataset.accountType);
      loadAccounts();
    }

    /** @param {Event} event */
    function handleStatusFilterChange(event) {
      if (!(event.currentTarget instanceof HTMLButtonElement)) return;
      state.statusFilter = /** @type {StatusType} */ (event.currentTarget.dataset.statusType);
      loadAccounts();
    }

    /** @param {Event} event */
    function handleSearchInput(event) {
      if (!(event.currentTarget instanceof HTMLInputElement)) return;
      state.searchQuery = event.currentTarget.value;
      loadAccounts();
    }

    useEffect(host, loadAccounts);

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label="${t('account', 'loadingAccountsViewAriaLabel')}"
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
          <p>${t('account', 'loadingAccountsViewMessage')}</p>
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
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('account', 'unableToLoadAccountsViewTitle')}</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadAccounts}>
            <material-symbols name="refresh"></material-symbols>
            ${t('account', 'retryButtonLabel')}
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
          <material-symbols name="account_tree" size="64"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('account', 'noAccountsFoundTitle')}</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            ${state.searchQuery ? t('account', 'noAccountsFoundMessage') : t('account', 'noAccountsFoundEmptyMessage')}
          </p>
        </div>
      `;
    }

    /**
     * @param {string | null} accountType
     */
    function getAccountTypeStyle(accountType) {
      switch (accountType) {
        case 'Asset':
          return 'background-color: var(--md-sys-color-custom-asset-container); color: var(--md-sys-color-custom-on-asset-container);';
        case 'Liability':
          return 'background-color: var(--md-sys-color-custom-liability-container); color: var(--md-sys-color-custom-on-liability-container);';
        case 'Equity':
          return 'background-color: var(--md-sys-color-custom-equity-container); color: var(--md-sys-color-custom-on-equity-container);';
        case 'Revenue':
          return 'background-color: var(--md-sys-color-custom-revenue-container); color: var(--md-sys-color-custom-on-revenue-container);';
        case 'Expense':
          return 'background-color: var(--md-sys-color-custom-expense-container); color: var(--md-sys-color-custom-on-expense-container);';
        default:
          return 'background-color: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface-variant);';
      }
    }

    function getVisibleRows() {
      const rows = /** @type {AccountTreeNode[]} */ ([]);
      /** @param {AccountTreeNode[]} nodes */
      function traverse(nodes) {
        for (const node of nodes) {
          rows.push(node);
          if (node.expanded) traverse(node.children);
        }
      }
      traverse(state.accountTree);
      return rows;
    }

    /**
     * @param {AccountTreeNode} node
     * @returns {TemplateResult}
     */
    function renderAccountRow(node) {
      const account = node.account;
      const hasChildren = node.children.length > 0;
      const isExpanded = node.expanded;
      const indentPadding = node.level * 24;
      const normalBalanceText = account.normal_balance === 0 ? t('account', 'normalBalanceShortDebit') : t('account', 'normalBalanceShortCredit');
      return html`
        <tr>
          <td style="padding-left: ${16 + indentPadding}px; white-space: nowrap;">
            <button
              role="button"
              type="button"
              class="text extra-small"
              style="--md-sys-density: -4;"
              aria-label="${hasChildren ? (isExpanded ? t('account', 'collapseAccountAriaLabel', account.name) : t('account', 'expandAccountAriaLabel', account.name)) : t('account', 'accountAriaLabel', account.name)}"
              @click=${hasChildren ? toggleExpanded : nothing}
              data-account-code="${account.account_code}"
              data-has-children="${hasChildren ? 'true' : 'false'}"
              ${hasChildren ? '' : 'disabled'}
            >
              <span style="display: flex; align-items: center; gap: 8px; height: 100%;">
                ${hasChildren ? html`
                  <material-symbols
                    name="${isExpanded ? 'keyboard_arrow_down' : 'chevron_right'}"
                    size="20"
                    aria-hidden="true"
                  ></material-symbols>
                ` : html`<span style="width: 20px;"></span>`}
                <span class="label-large" style="color: var(--md-sys-color-primary);">${account.account_code}</span>
              </span>
            </button>
          </td>
          <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${account.name}</td>
          <td class="center">
            ${account.account_type ? html`
              <span
                class="label-small"
                style="
                  display: inline-flex;
                  padding: 4px 8px;
                  border-radius: var(--md-sys-shape-corner-small);
                  ${getAccountTypeStyle(account.account_type)}
                "
              >${account.account_type}</span>
            ` : '—'}
          </td>
          <td class="center">
            <span
              class="label-small"
              style="
                display: inline-flex;
                padding: 2px 6px;
                border-radius: var(--md-sys-shape-corner-extra-small);
                background-color: ${account.normal_balance === 0 ? 'var(--md-sys-color-custom-asset-container)' : 'var(--md-sys-color-custom-liability-container)'};
                color: ${account.normal_balance === 0 ? 'var(--md-sys-color-custom-on-asset-container)' : 'var(--md-sys-color-custom-on-liability-container)'};
              "
            >${normalBalanceText}</span>
          </td>
          <td class="numeric" style="color: ${account.balance < 0 ? 'var(--md-sys-color-error)' : 'inherit'}; white-space: nowrap;">
            ${i18n.displayCurrency(Math.abs(account.balance))}
            ${account.balance < 0 ? ' (Cr)' : ''}
          </td>
          <td class="center">
            <span
              class="label-small"
              style="
                display: inline-flex;
                padding: 4px 8px;
                border-radius: var(--md-sys-shape-corner-small);
                background-color: ${account.is_active ? '#E8F5E9' : 'var(--md-sys-color-surface-container-highest)'};
                color: ${account.is_active ? '#1B5E20' : 'var(--md-sys-color-on-surface-variant)'};
              "
            >${account.is_active ? t('account', 'accountStatusActive') : t('account', 'accountStatusInactive')}</span>
          </td>
          <td class="center">
            <span
              class="label-small"
              style="
                display: inline-flex;
                padding: 4px 8px;
                border-radius: var(--md-sys-shape-corner-small);
                background-color: ${account.is_posting_account ? '#E8F5E9' : '#FFF3E0'};
                color: ${account.is_posting_account ? '#2E7D32' : '#E65100'};
              "
            >${account.is_posting_account ? t('account', 'accountKindPosting') : t('account', 'accountKindControl')}</span>
          </td>
        </tr>
      `;
    }

    function renderAccountsTable() {
      if (state.accountTree.length === 0) return renderEmptyState();
      return html`
        <table role="treegrid" aria-label="${t('account', 'chartOfAccountsTreeAriaLabel')}" style="--md-sys-density: -3;">
          <thead class="sticky">
            <tr>
              <th scope="col" style="width: 250px;">${t('account', 'tableHeaderCode')}</th>
              <th scope="col">${t('account', 'tableHeaderName')}</th>
              <th scope="col" class="center" style="width: 100px;">${t('account', 'tableHeaderType')}</th>
              <th scope="col" class="center" style="width: 80px;">${t('account', 'tableHeaderNormal')}</th>
              <th scope="col" class="numeric" style="width: 140px;">${t('account', 'tableHeaderBalance')}</th>
              <th scope="col" class="center" style="width: 90px;">${t('account', 'tableHeaderStatus')}</th>
              <th scope="col" class="center" style="width: 90px;">${t('account', 'tableHeaderKind')}</th>
            </tr>
          </thead>
          <tbody>
            ${repeat(getVisibleRows(), (node) => node.account.account_code, renderAccountRow)}
          </tbody>
        </table>
      `;
    }

    useEffect(host, function renderChartOfAccountsView() {
      render(html`
        <div style="display: flex; flex-direction: column; height: 100%; gap: 16px; padding-top: 16px; box-sizing: border-box;">
          <header style="display: flex; flex-direction: row; justify-content: space-between; padding-inline: 24px; box-sizing: border-box;">
            <div style="display: flex; flex-direction: row; gap: 12px;">
              <div class="outlined-text-field" style="--md-sys-density: -4; width: 180px; min-width: 160px;">
                <div class="container">
                  <material-symbols name="search" class="leading-icon" aria-hidden="true"></material-symbols>
                  <label for="account-search-input">${t('account', 'searchLabel')}</label>
                  <input
                    ${readValue(state, 'searchQuery')}
                    id="account-search-input"
                    type="text"
                    placeholder=" "
                    autocomplete="off"
                    @input=${handleSearchInput}
                  />
                </div>
              </div>
              <div class="outlined-text-field" style="--md-sys-density: -4; min-width: 160px; anchor-name: --type-menu-anchor;">
                <div class="container">
                  <label for="type-filter-input">${t('account', 'typeFilterLabel')}</label>
                  <input
                    id="type-filter-input"
                    type="button"
                    value="${state.typeFilter}"
                    aria-label="${t('account', 'typeFilterLabel')}"
                    popovertarget="type-filter-menu"
                    popovertargetaction="show"
                    placeholder=" "
                  />
                  <label for="type-filter-input" class="trailing-icon">
                    <material-symbols name="arrow_drop_down"></material-symbols>
                  </label>
                </div>
              </div>
              <menu role="menu" popover id="type-filter-menu" aria-label="${t('account', 'accountTypeFilterAriaLabel')}" class="dropdown" style="position-anchor: --type-menu-anchor;">
                ${accountTypes.map((accountType) => html`
                  <li>
                    <button
                      role="menuitem"
                      data-account-type="${accountType}"
                      @click=${handleTypeFilterChange}
                      popovertarget="type-filter-menu"
                      popovertargetaction="hide"
                      aria-selected=${accountType === state.typeFilter ? 'true' : 'false'}
                    >
                      ${accountType === state.typeFilter ? html`<material-symbols name="check"></material-symbols>` : ''}
                      ${accountType}
                    </button>
                  </li>
                `)}
              </menu>
              <div class="outlined-text-field" style="--md-sys-density: -4; min-width: 160px; anchor-name: --status-menu-anchor;">
                <div class="container">
                  <label for="status-filter-input">${t('account', 'statusFilterLabel')}</label>
                  <input
                    id="status-filter-input"
                    type="button"
                    value="${state.statusFilter}"
                    aria-label="${t('account', 'statusFilterLabel')}"
                    popovertarget="status-filter-menu"
                    popovertargetaction="show"
                    placeholder=" "
                  />
                  <label for="status-filter-input" class="trailing-icon" aria-hidden="true">
                    <material-symbols name="arrow_drop_down"></material-symbols>
                  </label>
                </div>
              </div>
              <menu role="menu" popover id="status-filter-menu" class="dropdown" style="position-anchor: --status-menu-anchor;">
                ${statusTypes.map((statusType) => html`
                  <li>
                    <button
                      role="menuitemradio"
                      aria-checked="${state.statusFilter === statusType ? 'true' : 'false'}"
                      type="button"
                      popovertarget="status-filter-menu"
                      popovertargetaction="hide"
                      data-status-type="${statusType}"
                      @click=${handleStatusFilterChange}
                    >
                      ${state.statusFilter === statusType ? html`<material-symbols name="check"></material-symbols>` : nothing}
                      ${statusType}
                    </button>
                  </li>
                `)}
              </menu>
            </div>
            <div style="display: flex; flex-direction: row; gap: 12px;">
              <button role="button" class="text" @click=${expandAll} aria-label="${t('account', 'expandAllAriaLabel')}" title="${t('account', 'expandAllTitle')}">
                <material-symbols name="unfold_more"></material-symbols>
                ${t('account', 'expandAllButtonLabel')}
              </button>
              <button role="button" class="text" @click=${collapseAll} aria-label="${t('account', 'collapseAllAriaLabel')}" title="${t('account', 'collapseAllTitle')}">
                <material-symbols name="unfold_less"></material-symbols>
                ${t('account', 'collapseAllButtonLabel')}
              </button>
              <button role="button" class="text" @click=${loadAccounts} aria-label="${t('account', 'refreshAriaLabel')}">
                <material-symbols name="refresh"></material-symbols>
                ${t('account', 'refreshButtonLabel')}
              </button>
              <button role="button" class="tonal" commandfor="account-creation-dialog" command="--open">
                <material-symbols name="add"></material-symbols>
                ${t('account', 'createAccountButtonLabel')}
              </button>
            </div>
          </header>
          <div class="scrollable" style="flex: 1; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding-inline: 24px;">
            ${state.isLoading ? renderLoadingIndicator() : nothing}
            ${state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
            ${state.isLoading === false && state.error === null ? renderAccountsTable() : nothing}
          </div>
        </div>

        <account-creation-dialog
          id="account-creation-dialog"
          @account-created=${loadAccounts}
        ></account-creation-dialog>
      `);
    });
  }
}

defineWebComponent('chart-of-accounts-view', ChartOfAccountsViewElement);
