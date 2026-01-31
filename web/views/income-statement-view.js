import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';

import '#web/components/material-symbols.js';

/**
 * Income Statement View
 * 
 * Displays income statement for a specific fiscal year.
 * Uses the fiscal year begin_time URL parameter to load the income statement data.
 */
export class IncomeStatementViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const router = useContext(host, RouterContextElement);
    const t = useTranslator(host);

    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      fiscalYear: {
        begin_time: /** @type {number | null} */ (null),
        end_time: /** @type {number | null} */ (null),
        name: /** @type {string | null} */ (null),
      },
      lines: /** @type {Array<{classification: string, category: string, account_code: number, account_name: string, amount: number}>} */ ([]),
      isLoaded: false,
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false;
    });

    async function loadIncomeStatement() {
      try {
        const urlParams = new URLSearchParams(router.route.search);
        const beginTimeParam = urlParams.get('beginTime');

        if (!beginTimeParam) {
          state.error = new Error('Missing beginTime parameter');
          state.isLoading = false;
          return;
        }

        const beginTime = Number(beginTimeParam);

        const result = await database.sql`
          SELECT
            fy.begin_time,
            fy.end_time,
            fy.name AS fiscal_year_name,
            CASE
              WHEN at.tag IN ('Income Statement - Revenue', 'Income Statement - Contra Revenue', 'Income Statement - Other Revenue') THEN 'Revenue'
              WHEN at.tag = 'Income Statement - COGS' THEN 'Cost of Goods Sold'
              WHEN at.tag IN ('Income Statement - Expense', 'Income Statement - Other Expense') THEN 'Expenses'
              ELSE 'Other'
            END AS classification,
            CASE
              WHEN at.tag = 'Income Statement - Revenue' THEN 'Revenue'
              WHEN at.tag = 'Income Statement - Contra Revenue' THEN 'Contra Revenue'
              WHEN at.tag = 'Income Statement - Other Revenue' THEN 'Other Revenue'
              WHEN at.tag = 'Income Statement - COGS' THEN 'Cost of Goods Sold'
              WHEN at.tag = 'Income Statement - Expense' THEN 'Operating Expenses'
              WHEN at.tag = 'Income Statement - Other Expense' THEN 'Other Expenses'
            END AS category,
            fyam.account_code,
            fyam.account_name,
            fyam.net_change AS amount
          FROM fiscal_year_account_mutation fyam
          JOIN account_tags at ON at.account_code = fyam.account_code
          JOIN fiscal_years fy ON fy.id = fyam.fiscal_year_id
          WHERE fyam.begin_time = ${beginTime}
            AND at.tag IN (
              'Income Statement - Revenue',
              'Income Statement - Contra Revenue',
              'Income Statement - Other Revenue',
              'Income Statement - COGS',
              'Income Statement - Expense',
              'Income Statement - Other Expense'
            )
            AND fyam.net_change != 0
          ORDER BY
            CASE
              WHEN at.tag IN ('Income Statement - Revenue', 'Income Statement - Contra Revenue', 'Income Statement - Other Revenue') THEN 1
              WHEN at.tag = 'Income Statement - COGS' THEN 2
              WHEN at.tag IN ('Income Statement - Expense', 'Income Statement - Other Expense') THEN 3
              ELSE 4
            END,
            category,
            fyam.account_code ASC
        `;

        if (result.rows.length === 0) {
          state.error = new Error('No income statement data found');
          state.isLoading = false;
          state.isLoaded = true;
          return;
        }

        const firstRow = result.rows[0];
        state.fiscalYear.begin_time = Number(firstRow.begin_time);
        state.fiscalYear.end_time = Number(firstRow.end_time);
        state.fiscalYear.name = firstRow.fiscal_year_name ? String(firstRow.fiscal_year_name) : null;

        state.lines = result.rows.map(function mapRow(row) {
          return {
            classification: String(row.classification),
            category: String(row.category),
            account_code: Number(row.account_code),
            account_name: String(row.account_name),
            amount: Number(row.amount),
          };
        });

        state.isLoading = false;
        state.isLoaded = true;
      }
      catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
        state.isLoading = false;
        state.isLoaded = true;
      }
    }

    useEffect(host, loadIncomeStatement);

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label="${t('financialReport', 'loadingReportsLabel')}"
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
          <p>${t('financialReport', 'loadingReportsLabel')}</p>
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
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">Unable to load income statement</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadIncomeStatement}>
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
          <material-symbols name="assignment" size="64"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('financialReport', 'noIncomeStatementDataTitle')}</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            ${t('financialReport', 'noIncomeStatementTransactionsMessage')}
          </p>
        </div>
      `;
    }

    function renderIncomeStatementTable() {
      if (state.lines.length === 0) {
        return renderEmptyState();
      }

      /** @type {Map<string, Map<string, Array<{account_code: number, account_name: string, amount: number}>>>} */
      const groupedLines = new Map();
      for (const line of state.lines) {
        if (!groupedLines.has(line.classification)) {
          groupedLines.set(line.classification, new Map());
        }
        const categories = groupedLines.get(line.classification);
        if (!categories.has(line.category)) {
          categories.set(line.category, []);
        }
        categories.get(line.category).push(line);
      }

      let totalRevenue = 0;
      let totalCOGS = 0;
      let totalExpenses = 0;

      for (const line of state.lines) {
        if (line.classification === 'Revenue') totalRevenue += Math.abs(line.amount);
        else if (line.classification === 'Cost of Goods Sold') totalCOGS += Math.abs(line.amount);
        else if (line.classification === 'Expenses') totalExpenses += Math.abs(line.amount);
      }

      const grossProfit = totalRevenue - totalCOGS;
      const netIncome = grossProfit - totalExpenses;

      function translateClassification(classification) {
        const map = {
          'Revenue': 'classificationRevenue',
          'Cost of Goods Sold': 'classificationCostOfGoodsSold',
          'Expenses': 'classificationExpenses',
        };
        return t('financialReport', map[classification] || classification);
      }

      /**
       * @param {string} classification
       * @param {string} colorToken
       */
      function renderIncomeSection(classification, colorToken) {
        const categories = groupedLines.get(classification);
        if (!categories) return nothing;

        let classificationTotal = 0;
        for (const [, lines] of categories) {
          for (const line of lines) {
            classificationTotal += Math.abs(line.amount);
          }
        }

        const calculatedCategories = Array.from(categories.entries())
          .map(function evaluateCategory([categoryName, lines]) {
            return {
              name: categoryName,
              lines,
              total: lines.reduce(function sumCategoryTotal(accumulator, line) {
                return accumulator + Math.abs(line.amount);
              }, 0),
            };
          });

        return html`
          <tr style="background-color: var(--md-sys-color-surface-container);">
            <th colspan="3" scope="colgroup" class="title-medium" style="text-align: left; padding: 12px 16px; color: ${colorToken};">
              ${translateClassification(classification)}
            </th>
          </tr>
          ${calculatedCategories.map((category) => html`
            ${category.name !== classification ? html`
              <tr style="background-color: var(--md-sys-color-surface-container-low);">
                <th colspan="3" scope="colgroup" class="label-large" style="text-align: left; padding: 8px 16px 8px 32px; color: var(--md-sys-color-on-surface-variant);">
                  ${category.name}
                </th>
              </tr>
            ` : nothing}
            ${category.lines.map((line) => html`
              <tr>
                <td style="padding-left: ${category.name !== classification ? '48px' : '32px'};">
                  <span class="label-medium" style="color: var(--md-sys-color-primary);">${line.account_code}</span>
                </td>
                <td>${line.account_name}</td>
                <td class="numeric">${i18n.displayCurrency(Math.abs(line.amount))}</td>
              </tr>
            `)}
            ${category.name !== classification ? html`
              <tr style="border-top: 1px solid var(--md-sys-color-outline-variant);">
                <td colspan="2" style="text-align: right; padding-right: 16px; font-weight: 500;">
                  ${t('financialReport', 'totalCategoryFormat', category.name)}
                </td>
                <td class="numeric" style="font-weight: 500;">${i18n.displayCurrency(category.total)}</td>
              </tr>
            ` : nothing}
          `)}
          <tr style="border-top: 2px solid var(--md-sys-color-outline); background-color: var(--md-sys-color-surface-container-high);">
            <td colspan="2" style="text-align: right; padding-right: 16px; font-weight: 600;">
              ${t('financialReport', 'totalClassificationFormat', translateClassification(classification))}
            </td>
            <td class="numeric" style="font-weight: 600; color: ${colorToken};">${i18n.displayCurrency(classificationTotal)}</td>
          </tr>
        `;
      }

      return html`
        <div style="overflow-x: auto;">
          <table aria-label="${t('financialReport', 'incomeStatementTableLabel')}" style="--md-sys-density: -3; min-width: 500px;">
            <thead>
              <tr>
                <th scope="col" style="width: 100px;">${t('financialReport', 'codeColumnHeader')}</th>
                <th scope="col">${t('financialReport', 'accountNameColumnHeader')}</th>
                <th scope="col" class="numeric" style="width: 160px;">${t('financialReport', 'amountColumnHeader')}</th>
              </tr>
            </thead>
            <tbody>
              ${renderIncomeSection('Revenue', 'var(--md-sys-color-custom-on-revenue-container, #2E7D32)')}
              ${renderIncomeSection('Cost of Goods Sold', 'var(--md-sys-color-custom-on-expense-container, #D84315)')}
              <tr style="border-top: 3px double var(--md-sys-color-outline); background-color: var(--md-sys-color-secondary-container);">
                <td colspan="2" style="text-align: right; padding-right: 16px; font-weight: 700;">
                  ${t('financialReport', 'grossProfitLabel')}
                </td>
                <td class="numeric" style="font-weight: 700; color: ${grossProfit >= 0 ? '#2E7D32' : '#C62828'};">
                  ${grossProfit < 0 ? '(' + i18n.displayCurrency(Math.abs(grossProfit)) + ')' : i18n.displayCurrency(grossProfit)}
                </td>
              </tr>
              ${renderIncomeSection('Expenses', 'var(--md-sys-color-custom-on-expense-container, #D84315)')}
            </tbody>
            <tfoot>
              <tr style="border-top: 3px double var(--md-sys-color-outline); background-color: ${netIncome >= 0 ? '#E8F5E9' : '#FFEBEE'};">
                <td colspan="2" style="text-align: right; padding-right: 16px; font-weight: 700;">
                  ${t('financialReport', 'netIncomeLabel')}
                </td>
                <td class="numeric" style="font-weight: 700; color: ${netIncome >= 0 ? '#2E7D32' : '#C62828'};">
                  ${netIncome < 0 ? '(' + i18n.displayCurrency(Math.abs(netIncome)) + ')' : i18n.displayCurrency(netIncome)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    useEffect(host, function renderIncomeStatementView() {
      render(html`
        <div style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 16px 24px; height: 100%;">
          <header style="--md-sys-density: -4; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <hgroup>
                <h1 class="title-large">${t('financialReport', 'reportTypeIncomeStatement')}</h1>
                <p class="label-medium" style="color: var(--md-sys-color-on-surface-variant);">
                  ${state.fiscalYear.name || `Fiscal Year ${new Date(state.fiscalYear.begin_time || 0).getFullYear()}`}
                  ${state.fiscalYear.begin_time ? ` • ${i18n.date.format(state.fiscalYear.begin_time)} – ${i18n.date.format(state.fiscalYear.end_time || 0)}` : nothing}
                </p>
              </hgroup>
            </div>
            <div style="display: flex; flex-direction: row; gap: 12px; align-items: center;">
              <button role="button" class="text" @click=${loadIncomeStatement} aria-label="Refresh report">
                <material-symbols name="refresh"></material-symbols>
                ${t('financialReport', 'refreshActionLabel')}
              </button>
            </div>
          </header>

          <div class="scrollable" style="flex: 1; overflow-y: auto;">
            ${state.isLoading ? renderLoadingIndicator() : nothing}
            ${state.isLoaded && state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
            ${state.isLoaded && state.error === null ? renderIncomeStatementTable() : nothing}
          </div>
        </div>
      `);
    });
  }
}

defineWebComponent('income-statement-view', IncomeStatementViewElement);
