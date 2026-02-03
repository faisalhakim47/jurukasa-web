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
 * Balance Sheet View
 * 
 * Displays balance sheet for a specific balance report.
 * Uses the reportId URL parameter to load the balance sheet data.
 */
export class BalanceSheetViewElement extends HTMLElement {
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
      reportId: /** @type {number | null} */ (null),
      reportTime: /** @type {number | null} */ (null),
      reportName: /** @type {string | null} */ (null),
      lines: /** @type {Array<{account_code: number, account_name: string, classification: string, category: string, amount: number}>} */ ([]),
      isLoaded: false,
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false;
    });

    async function loadBalanceSheet() {
      try {
        const urlParams = new URLSearchParams(router.route.search);
        const reportIdParam = urlParams.get('reportId');

        if (!reportIdParam) {
          state.error = new Error('Missing reportId parameter');
          state.isLoading = false;
          return;
        }

        state.reportId = Number(reportIdParam);

        const result = await database.sql`
          SELECT
            br.id,
            br.report_time,
            br.name,
            bsl.account_code,
            a.name AS account_name,
            bsl.classification,
            bsl.category,
            bsl.amount
          FROM balance_reports br
          JOIN balance_sheet_lines bsl ON bsl.balance_report_id = br.id
          JOIN accounts a ON a.account_code = bsl.account_code
          WHERE br.id = ${state.reportId}
          ORDER BY
            CASE bsl.classification
              WHEN 'Assets' THEN 1
              WHEN 'Liabilities' THEN 2
              WHEN 'Equity' THEN 3
            END,
            CASE bsl.category
              WHEN 'Current Assets' THEN 1
              WHEN 'Non-Current Assets' THEN 2
              WHEN 'Current Liabilities' THEN 1
              WHEN 'Non-Current Liabilities' THEN 2
              WHEN 'Equity' THEN 1
            END,
            bsl.account_code ASC
        `;

        if (result.rows.length === 0) {
          state.error = new Error('Report not found');
          state.isLoading = false;
          state.isLoaded = true;
          return;
        }

        state.reportTime = Number(result.rows[0].report_time);
        state.reportName = result.rows[0].name ? String(result.rows[0].name) : null;

        state.lines = result.rows.map(function mapRow(row) {
          return {
            account_code: Number(row.account_code),
            account_name: String(row.account_name),
            classification: String(row.classification),
            category: String(row.category),
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

    useEffect(host, loadBalanceSheet);

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
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('financialReport', 'unableToLoadReportsTitle')}</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadBalanceSheet}>
            <material-symbols name="refresh"></material-symbols>
            ${t('financialReport', 'retryActionLabel')}
          </button>
        </div>
      `;
    }

    function translateClassification(classification) {
      const map = {
        'Assets': 'classificationAssets',
        'Liabilities': 'classificationLiabilities',
        'Equity': 'classificationEquity',
      };
      return t('financialReport', map[classification] || classification);
    }

    function translateCategory(category) {
      const map = {
        'Current Assets': 'categoryCurrentAssets',
        'Non-Current Assets': 'categoryNonCurrentAssets',
        'Current Liabilities': 'categoryCurrentLiabilities',
        'Non-Current Liabilities': 'categoryNonCurrentLiabilities',
        'Equity': 'categoryEquity',
      };
      return t('financialReport', map[category] || category);
    }

    function renderBalanceSheetTable() {
      if (state.lines.length === 0) {
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
            <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">No Data</h2>
            <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
              No balance sheet data available for this report.
            </p>
          </div>
        `;
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

      let totalAssets = 0;
      let totalLiabilities = 0;
      let totalEquity = 0;

      for (const line of state.lines) {
        if (line.classification === 'Assets') totalAssets += line.amount;
        else if (line.classification === 'Liabilities') totalLiabilities += line.amount;
        else if (line.classification === 'Equity') totalEquity += line.amount;
      }

      const isBalanced = totalAssets === (totalLiabilities + totalEquity);

      /**
       * @param {string} classification
       * @param {string} colorToken
       */
      function renderClassificationSection(classification, colorToken) {
        const categories = groupedLines.get(classification);

        if (!(categories instanceof Map)) return nothing;

        const classificationTotal = Array.from(categories.values())
          .reduce(function classificationSum(total, lines) {
            return total + lines.reduce(function linesSum(lineTotal, line) {
              return lineTotal + line.amount;
            }, 0);
          }, 0);

        const calculatedCategories = Array.from(categories.entries())
          .map(function evaluateCategory([categoryName, lines]) {
            return {
              name: categoryName,
              lines,
              total: lines.reduce(function scopeSum(total, line) {
                return total + line.amount;
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
            <tr style="background-color: var(--md-sys-color-surface-container-low);">
              <th colspan="3" scope="colgroup" class="label-large" style="text-align: left; padding: 8px 16px 8px 32px; color: var(--md-sys-color-on-surface-variant);">
                ${translateCategory(category.name)}
              </th>
            </tr>
            ${category.lines.map((line) => html`
              <tr>
                <td style="padding-left: 48px;">
                  <span class="label-medium" style="color: var(--md-sys-color-primary);">${line.account_code}</span>
                </td>
                <td>${line.account_name}</td>
                <td class="numeric">${i18n.displayCurrency(line.amount)}</td>
              </tr>
            `)}
            <tr style="border-top: 1px solid var(--md-sys-color-outline-variant);">
              <td colspan="2" style="text-align: right; padding-right: 16px; font-weight: 500;">
                ${t('financialReport', 'totalCategoryFormat', translateCategory(category.name))}
              </td>
              <td class="numeric" style="font-weight: 500;">${i18n.displayCurrency(category.total)}</td>
            </tr>
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
          <table aria-label="${t('financialReport', 'balanceSheetTableLabel')}" style="--md-sys-density: -3; min-width: 500px;">
            <thead>
              <tr>
                <th scope="col" style="width: 100px;">${t('financialReport', 'codeColumnHeader')}</th>
                <th scope="col">${t('financialReport', 'accountNameColumnHeader')}</th>
                <th scope="col" class="numeric" style="width: 160px;">${t('financialReport', 'amountColumnHeader')}</th>
              </tr>
            </thead>
            <tbody>
              ${renderClassificationSection('Assets', 'var(--md-sys-color-custom-on-asset-container, #1565C0)')}
              ${renderClassificationSection('Liabilities', 'var(--md-sys-color-custom-on-liability-container, #C2185B)')}
              ${renderClassificationSection('Equity', 'var(--md-sys-color-custom-on-equity-container, #6A1B9A)')}
            </tbody>
            <tfoot>
              <tr style="border-top: 3px double var(--md-sys-color-outline);">
                <td colspan="2" style="text-align: right; padding-right: 16px; font-weight: 600;">
                  ${t('financialReport', 'liabilitiesEquityTotalLabel')}
                </td>
                <td class="numeric" style="font-weight: 600;">${i18n.displayCurrency(totalLiabilities + totalEquity)}</td>
              </tr>
              <tr>
                <td colspan="3" style="text-align: center; padding: 12px;">
                  <span
                    class="label-medium"
                    style="
                      display: inline-flex;
                      align-items: center;
                      gap: 8px;
                      padding: 8px 16px;
                      border-radius: var(--md-sys-shape-corner-small);
                      background-color: ${isBalanced ? '#E8F5E9' : '#FFEBEE'};
                      color: ${isBalanced ? '#2E7D32' : '#C62828'};
                    "
                  >
                    ${isBalanced ? html`
                      <material-symbols name="check_circle" size="20"></material-symbols>
                    ` : html`
                      <material-symbols name="error" size="20"></material-symbols>
                    `}
                    ${isBalanced ? t('financialReport', 'balanceSheetBalancedMessage') : t('financialReport', 'balanceSheetOutOfBalanceMessage', i18n.displayCurrency(Math.abs(totalAssets - totalLiabilities - totalEquity)))}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    useEffect(host, function renderBalanceSheetView() {
      render(html`
        <div style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 16px 24px; height: 100%;">
          <header style="--md-sys-density: -4; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <hgroup>
                <h1 class="title-large">${t('financialReport', 'reportTypeBalanceSheet')}</h1>
                <p class="label-medium" style="color: var(--md-sys-color-on-surface-variant);">
                  ${state.reportName ? state.reportName : t('financialReport', 'reportIdFormat', state.reportId || 0)}
                  ${state.reportTime ? ` • ${i18n.date.format(state.reportTime)}` : nothing}
                </p>
              </hgroup>
            </div>
            <div style="display: flex; flex-direction: row; gap: 12px; align-items: center;">
              <button role="button" class="text" @click=${loadBalanceSheet} aria-label="Refresh report">
                <material-symbols name="refresh"></material-symbols>
                ${t('financialReport', 'refreshActionLabel')}
              </button>
            </div>
          </header>

          <div class="scrollable" style="flex: 1; overflow-y: auto;">
            ${state.isLoading ? renderLoadingIndicator() : nothing}
            ${state.isLoaded && state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
            ${state.isLoaded && state.error === null ? renderBalanceSheetTable() : nothing}
          </div>
        </div>
      `);
    });
  }
}

defineWebComponent('balance-sheet-view', BalanceSheetViewElement);
