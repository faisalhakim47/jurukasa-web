import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

import '#web/components/material-symbols.js';

/**
 * @typedef {object} BalanceReportRow
 * @property {number} id
 * @property {number} report_time
 * @property {string} report_type
 * @property {string | null} name
 * @property {number} create_time
 */

/**
 * @typedef {object} TrialBalanceRow
 * @property {number} balance_report_id
 * @property {number} account_code
 * @property {string} account_name
 * @property {number} normal_balance
 * @property {number} debit
 * @property {number} credit
 */

/**
 * @typedef {object} BalanceSheetRow
 * @property {number} balance_report_id
 * @property {string} classification
 * @property {string} category
 * @property {number} account_code
 * @property {string} account_name
 * @property {number} amount
 */

/**
 * @typedef {object} IncomeStatementRow
 * @property {string} classification
 * @property {string} category
 * @property {number} account_code
 * @property {string} account_name
 * @property {number} amount
 * @property {number} begin_time
 * @property {number} end_time
 * @property {string | null} fiscal_year_name
 */

/**
 * @typedef {object} FiscalYearRow
 * @property {number} begin_time
 * @property {number} end_time
 * @property {string | null} name
 * @property {number | null} post_time
 */

const reportTypes = /** @type {const} */ (['trialBalance', 'balanceSheet', 'incomeStatement']);
const reportTypeValues = /** @type {const} */ (['Period End', 'Monthly', 'Quarterly', 'Annual', 'Ad Hoc']);

/** @typedef {typeof reportTypes[number]} ReportType */
/** @typedef {typeof reportTypeValues[number]} ReportTypeValue */

export class FinancialReportsViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);

    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      selectedReportType: /** @type {ReportType} */ ('trialBalance'),
      balanceReports: /** @type {BalanceReportRow[]} */ ([]),
      selectedBalanceReportId: /** @type {number | null} */ (null),
      trialBalanceLines: /** @type {TrialBalanceRow[]} */ ([]),
      balanceSheetLines: /** @type {BalanceSheetRow[]} */ ([]),
      incomeStatementLines: /** @type {IncomeStatementRow[]} */ ([]),
      fiscalYears: /** @type {FiscalYearRow[]} */ ([]),
      selectedFiscalYear: /** @type {number | null} */ (null),
      isGenerating: false,
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false;
    });

    /**
     * @param {string} classification
     * @returns {string}
     */
    function translateClassification(classification) {
      const map = {
        'Assets': 'classificationAssets',
        'Liabilities': 'classificationLiabilities',
        'Equity': 'classificationEquity',
        'Revenue': 'classificationRevenue',
        'Cost of Goods Sold': 'classificationCostOfGoodsSold',
        'Expenses': 'classificationExpenses',
      };
      return t('financialReport', map[classification] || classification);
    }

    /**
     * @param {string} category
     * @returns {string}
     */
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

    async function loadBalanceReports() {
      try {
        const result = await database.sql`
          SELECT
            id,
            report_time,
            report_type,
            name,
            create_time
          FROM balance_reports
          ORDER BY report_time DESC, id DESC
          LIMIT 50
        `;
        state.balanceReports = result.rows.map(function rowToBalanceReport(row) {
          return /** @type {BalanceReportRow} */ ({
            id: Number(row.id),
            report_time: Number(row.report_time),
            report_type: String(row.report_type),
            name: row.name ? String(row.name) : null,
            create_time: Number(row.create_time),
          });
        });
      } catch (error) {
        throw error;
      }
    }

    async function loadFiscalYears() {
      try {
        const result = await database.sql`
          SELECT
            begin_time,
            end_time,
            name,
            post_time
          FROM fiscal_years
          ORDER BY begin_time DESC
        `;
        state.fiscalYears = result.rows.map(function rowToFiscalYear(row) {
          return /** @type {FiscalYearRow} */ ({
            begin_time: Number(row.begin_time),
            end_time: Number(row.end_time),
            name: row.name ? String(row.name) : null,
            post_time: row.post_time ? Number(row.post_time) : null,
          });
        });
      } catch (error) {
        throw error;
      }
    }

    async function loadTrialBalance() {
      if (state.selectedBalanceReportId === null) {
        state.trialBalanceLines = [];
        return;
      }
      try {
        const reportId = state.selectedBalanceReportId;
        const result = await database.sql`
          SELECT
            balance_report_id,
            account_code,
            account_name,
            normal_balance,
            debit,
            credit
          FROM trial_balance
          WHERE balance_report_id = ${reportId}
          ORDER BY account_code ASC
        `;
        state.trialBalanceLines = result.rows.map(function rowToTrialBalanceLine(row) {
          return /** @type {TrialBalanceRow} */ ({
            balance_report_id: Number(row.balance_report_id),
            account_code: Number(row.account_code),
            account_name: String(row.account_name),
            normal_balance: Number(row.normal_balance),
            debit: Number(row.debit),
            credit: Number(row.credit),
          });
        });
      } catch (error) {
        throw error;
      }
    }

    async function loadBalanceSheet() {
      if (state.selectedBalanceReportId === null) {
        state.balanceSheetLines = [];
        return;
      }
      try {
        const reportId = state.selectedBalanceReportId;
        const result = await database.sql`
          SELECT
            balance_report_id,
            classification,
            category,
            account_code,
            account_name,
            amount
          FROM balance_sheet
          WHERE balance_report_id = ${reportId}
          ORDER BY
            CASE classification
              WHEN 'Assets' THEN 1
              WHEN 'Liabilities' THEN 2
              WHEN 'Equity' THEN 3
            END,
            CASE category
              WHEN 'Current Assets' THEN 1
              WHEN 'Non-Current Assets' THEN 2
              WHEN 'Current Liabilities' THEN 1
              WHEN 'Non-Current Liabilities' THEN 2
              WHEN 'Equity' THEN 1
            END,
            account_code ASC
        `;
        state.balanceSheetLines = result.rows.map(function rowToBalanceSheetLine(row) {
          return /** @type {BalanceSheetRow} */ ({
            balance_report_id: Number(row.balance_report_id),
            classification: String(row.classification),
            category: String(row.category),
            account_code: Number(row.account_code),
            account_name: String(row.account_name),
            amount: Number(row.amount),
          });
        });
      } catch (error) {
        throw error;
      }
    }

    async function loadIncomeStatement() {
      if (state.selectedFiscalYear === null) {
        state.incomeStatementLines = [];
        return;
      }
      try {
        const fiscalYearBegin = state.selectedFiscalYear;
        const result = await database.sql`
          SELECT
            classification,
            category,
            account_code,
            account_name,
            amount,
            begin_time,
            end_time,
            fiscal_year_name
          FROM income_statement
          WHERE begin_time = ${fiscalYearBegin}
          ORDER BY
            CASE classification
              WHEN 'Revenue' THEN 1
              WHEN 'Cost of Goods Sold' THEN 2
              WHEN 'Expenses' THEN 3
              ELSE 4
            END,
            category,
            account_code ASC
        `;
        state.incomeStatementLines = result.rows.map(function rowToIncomeStatementLine(row) {
          return /** @type {IncomeStatementRow} */ ({
            classification: String(row.classification),
            category: String(row.category),
            account_code: Number(row.account_code),
            account_name: String(row.account_name),
            amount: Number(row.amount),
            begin_time: Number(row.begin_time),
            end_time: Number(row.end_time),
            fiscal_year_name: row.fiscal_year_name ? String(row.fiscal_year_name) : null,
          });
        });
      } catch (error) {
        throw error;
      }
    }

    async function loadReportData() {
      try {
        state.isLoading = true;
        state.error = null;

        await loadBalanceReports();
        await loadFiscalYears();

        // Auto-select first available report if none selected
        if (state.selectedBalanceReportId === null && state.balanceReports.length > 0) {
          state.selectedBalanceReportId = state.balanceReports[0].id;
        }

        // Auto-select first fiscal year if none selected
        if (state.selectedFiscalYear === null && state.fiscalYears.length > 0) {
          state.selectedFiscalYear = state.fiscalYears[0].begin_time;
        }

        if (state.selectedReportType === 'trialBalance') {
          await loadTrialBalance();
        } else if (state.selectedReportType === 'balanceSheet') {
          await loadBalanceSheet();
        } else if (state.selectedReportType === 'incomeStatement') {
          await loadIncomeStatement();
        }

        state.isLoading = false;
      } catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
        state.isLoading = false;
      }
    }

    async function generateNewReport() {
      try {
        state.isGenerating = true;
        const now = Date.now();
        await database.sql`
          INSERT INTO balance_reports (report_time, report_type, name, create_time)
          VALUES (${now}, 'Ad Hoc', ${t('financialReport', 'adHocReportNameFormat', i18n.date.format(now))}, ${now})
        `;
        await loadReportData();
        state.isGenerating = false;
      } catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
        state.isGenerating = false;
      }
    }

    /** @param {Event} event */
    function handleReportTypeChange(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      state.selectedReportType = /** @type {ReportType} */ (event.currentTarget.dataset.reportType);
      loadReportData();
    }

    /** @param {Event} event */
    function handleBalanceReportChange(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      state.selectedBalanceReportId = Number(event.currentTarget.dataset.reportId);
      loadReportData();
    }

    /** @param {Event} event */
    function handleFiscalYearChange(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      state.selectedFiscalYear = Number(event.currentTarget.dataset.fiscalYear);
      loadReportData();
    }

    useEffect(host, loadReportData);

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
          <button role="button" class="tonal" @click=${loadReportData}>
            <material-symbols name="refresh"></material-symbols>
            ${t('financialReport', 'retryActionLabel')}
          </button>
        </div>
      `;
    }

    function renderReportTypeSelector() {
      return html`
        <div class="outlined-text-field" style="min-width: 180px; anchor-name: --report-type-menu-anchor;">
          <div class="container">
            <label for="report-type-input">${t('financialReport', 'reportTypeLabel')}</label>
            <input
              id="report-type-input"
              type="button"
              value="${t('financialReport', state.selectedReportType === 'trialBalance' ? 'reportTypeTrialBalance' : state.selectedReportType === 'balanceSheet' ? 'reportTypeBalanceSheet' : 'reportTypeIncomeStatement')}"
              popovertarget="report-type-menu"
              popovertargetaction="show"
              placeholder=" "
            />
            <label for="report-type-input" class="trailing-icon">
              <material-symbols name="arrow_drop_down"></material-symbols>
            </label>
          </div>
        </div>
        <menu role="menu" popover id="report-type-menu" aria-label="${t('financialReport', 'reportTypeMenuLabel')}" class="dropdown" style="position-anchor: --report-type-menu-anchor;">
          ${repeat(reportTypes, (reportType) => reportType, (reportType) => html`
            <li>
              <button
                role="menuitemradio"
                aria-checked="${reportType === state.selectedReportType ? 'true' : 'false'}"
                type="button"
                popovertarget="report-type-menu"
                popovertargetaction="hide"
                data-report-type="${reportType}"
                @click=${handleReportTypeChange}
              >
                ${reportType === state.selectedReportType ? html`<material-symbols name="check"></material-symbols>` : nothing}
                ${t('financialReport', reportType === 'trialBalance' ? 'reportTypeTrialBalance' : reportType === 'balanceSheet' ? 'reportTypeBalanceSheet' : 'reportTypeIncomeStatement')}
              </button>
            </li>
          `)}
        </menu>
      `;
    }

    function renderBalanceReportSelector() {
      if (state.selectedReportType === 'incomeStatement') return nothing;

      const selectedReport = state.balanceReports.find(function (report) {
        return report.id === state.selectedBalanceReportId;
      });
      const displayValue = selectedReport
        ? (selectedReport.name || i18n.date.format(selectedReport.report_time))
        : t('financialReport', 'selectReportLabel');

      return html`
        <div class="outlined-text-field" style="min-width: 200px; anchor-name: --balance-report-menu-anchor;">
          <div class="container">
            <label for="balance-report-input">${t('financialReport', 'reportDateLabel')}</label>
            <input
              id="balance-report-input"
              type="button"
              value="${displayValue}"
              popovertarget="balance-report-menu"
              popovertargetaction="show"
              placeholder=" "
            />
            <label for="balance-report-input" class="trailing-icon">
              <material-symbols name="arrow_drop_down"></material-symbols>
            </label>
          </div>
        </div>
        <menu role="menu" popover id="balance-report-menu" aria-label="${t('financialReport', 'reportDateMenuLabel')}" class="dropdown" style="position-anchor: --balance-report-menu-anchor; max-height: 300px; overflow-y: auto;">
          ${state.balanceReports.length === 0 ? html`
            <li style="padding: 12px 16px; color: var(--md-sys-color-on-surface-variant);">
              ${t('financialReport', 'noReportsAvailable')}
            </li>
          ` : nothing}
          ${repeat(state.balanceReports, (report) => report.id, (report) => html`
            <li>
              <button
                role="menuitem"
                data-report-id="${report.id}"
                aria-selected=${report.id === state.selectedBalanceReportId ? 'true' : 'false'}
                @click=${handleBalanceReportChange}
                popovertarget="balance-report-menu"
                popovertargetaction="hide"
              >
                ${report.id === state.selectedBalanceReportId ? html`<material-symbols name="check"></material-symbols>` : nothing}
                <span style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
                  <span>${report.name || t('financialReport', 'reportIdFormat', report.id)}</span>
                  <span class="label-small" style="color: var(--md-sys-color-on-surface-variant);">
                    ${t('financialReport', 'reportDetailsWithDate', i18n.date.format(report.report_time), report.report_type)}
                  </span>
                </span>
              </button>
            </li>
          `)}
        </menu>
      `;
    }

    function renderFiscalYearSelector() {
      if (state.selectedReportType !== 'incomeStatement') return nothing;

      const selectedFY = state.fiscalYears.find(function (fy) {
        return fy.begin_time === state.selectedFiscalYear;
      });
      const displayValue = selectedFY
        ? (selectedFY.name || t('financialReport', 'fiscalYearDateRange', i18n.date.format(selectedFY.begin_time), i18n.date.format(selectedFY.end_time)))
        : t('financialReport', 'selectFiscalYearLabel');

      return html`
        <div class="outlined-text-field" style="min-width: 200px; anchor-name: --fiscal-year-menu-anchor;">
          <div class="container">
            <label for="fiscal-year-input">${t('financialReport', 'fiscalYearLabel')}</label>
            <input
              id="fiscal-year-input"
              type="button"
              value="${displayValue}"
              popovertarget="fiscal-year-menu"
              popovertargetaction="show"
              placeholder=" "
            />
            <label for="fiscal-year-input" class="trailing-icon">
              <material-symbols name="arrow_drop_down"></material-symbols>
            </label>
          </div>
        </div>
        <menu role="menu" popover id="fiscal-year-menu" class="dropdown" style="position-anchor: --fiscal-year-menu-anchor; max-height: 300px; overflow-y: auto;">
          ${state.fiscalYears.length === 0 ? html`
            <li style="padding: 12px 16px; color: var(--md-sys-color-on-surface-variant);">
              ${t('financialReport', 'noFiscalYearsDefined')}
            </li>
          ` : nothing}
          ${repeat(state.fiscalYears, (fy) => fy.begin_time, (fy) => html`
            <li>
              <button
                role="menuitem"
                data-fiscal-year="${fy.begin_time}"
                aria-selected=${fy.begin_time === state.selectedFiscalYear ? 'true' : 'false'}
                @click=${handleFiscalYearChange}
                popovertarget="fiscal-year-menu"
                popovertargetaction="hide"
              >
                ${fy.begin_time === state.selectedFiscalYear ? html`<material-symbols name="check"></material-symbols>` : nothing}
                <span style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
                  <span>${fy.name || t('financialReport', 'fiscalYearDefaultName')}</span>
                  <span class="label-small" style="color: var(--md-sys-color-on-surface-variant);">
                    ${t('financialReport', 'fiscalYearDateRange', i18n.date.format(fy.begin_time), i18n.date.format(fy.end_time))}
                    ${fy.post_time !== null ? ' • ' + t('financialReport', 'fiscalYearStatusClosed') : ' • ' + t('financialReport', 'fiscalYearStatusOpen')}
                  </span>
                </span>
              </button>
            </li>
          `)}
        </menu>
      `;
    }

    function renderEmptyState() {
      if (state.selectedReportType === 'incomeStatement') {
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
              ${t('financialReport', state.fiscalYears.length === 0 ? 'noIncomeStatementFiscalYearMessage' : 'noIncomeStatementTransactionsMessage')}
            </p>
          </div>
        `;
      }

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
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('financialReport', 'noReportsGeneratedTitle')}</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            ${t('financialReport', 'noReportsGeneratedMessage')}
          </p>
          <button
            role="button"
            class="tonal"
            @click=${generateNewReport}
            ?disabled=${state.isGenerating}
          >
            ${state.isGenerating ? html`
              <div role="progressbar" class="linear indeterminate" style="width: 80px;">
                <div class="track">
                  <div class="indicator"></div>
                </div>
              </div>
            ` : html`
              <material-symbols name="add"></material-symbols>
              ${t('financialReport', 'generateReportActionLabel')}
            `}
          </button>
        </div>
      `;
    }

    function renderTrialBalance() {
      if (state.trialBalanceLines.length === 0) return renderEmptyState();

      let totalDebit = 0;
      let totalCredit = 0;
      for (const line of state.trialBalanceLines) {
        totalDebit += line.debit;
        totalCredit += line.credit;
      }
      const isBalanced = totalDebit === totalCredit;

      return html`
        <div style="overflow-x: auto;">
          <table aria-label="${t('financialReport', 'trialBalanceTableLabel')}" style="--md-sys-density: -3; min-width: 600px;">
            <thead>
              <tr>
                <th scope="col" style="width: 100px;">${t('financialReport', 'codeColumnHeader')}</th>
                <th scope="col">${t('financialReport', 'accountNameColumnHeader')}</th>
                <th scope="col" class="center" style="width: 80px;">${t('financialReport', 'normalColumnHeader')}</th>
                <th scope="col" class="numeric" style="width: 140px;">${t('financialReport', 'debitColumnHeader')}</th>
                <th scope="col" class="numeric" style="width: 140px;">${t('financialReport', 'creditColumnHeader')}</th>
              </tr>
            </thead>
            <tbody>
              ${repeat(state.trialBalanceLines, (line) => line.account_code, (line) => html`
                <tr>
                  <td class="label-large" style="color: var(--md-sys-color-primary);">${line.account_code}</td>
                  <td>${line.account_name}</td>
                  <td class="center">
                    <span
                      class="label-small"
                      style="
                        display: inline-flex;
                        padding: 2px 6px;
                        border-radius: var(--md-sys-shape-corner-extra-small);
                        background-color: ${line.normal_balance === 0 ? 'var(--md-sys-color-custom-asset-container)' : 'var(--md-sys-color-custom-liability-container)'};
                        color: ${line.normal_balance === 0 ? 'var(--md-sys-color-custom-on-asset-container)' : 'var(--md-sys-color-custom-on-liability-container)'};
                      "
                    >${line.normal_balance === 0 ? t('financialReport', 'normalBalanceDebit') : t('financialReport', 'normalBalanceCredit')}</span>
                  </td>
                  <td class="numeric">${line.debit > 0 ? i18n.displayCurrency(line.debit) : t('financialReport', 'noAmountLabel')}</td>
                  <td class="numeric">${line.credit > 0 ? i18n.displayCurrency(line.credit) : t('financialReport', 'noAmountLabel')}</td>
                </tr>
              `)}
            </tbody>
            <tfoot>
              <tr style="font-weight: 600; border-top: 2px solid var(--md-sys-color-outline);">
                <td colspan="3" style="text-align: right; padding-right: 16px;">${t('financialReport', 'totalRowLabel')}</td>
                <td class="numeric">${i18n.displayCurrency(totalDebit)}</td>
                <td class="numeric">${i18n.displayCurrency(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    function renderBalanceSheet() {
      if (state.balanceSheetLines.length === 0) return renderEmptyState();

      /** @type {Map<string, Map<string, BalanceSheetRow[]>>} */
      const groupedLines = new Map();
      for (const line of state.balanceSheetLines) {
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

      for (const line of state.balanceSheetLines) {
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
          .map(function evaluteCategory([categoryName, lines]) {
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
          ${repeat(calculatedCategories, (category) => category.name, (category) => html`
            <tr style="background-color: var(--md-sys-color-surface-container-low);">
              <th colspan="3" scope="colgroup" class="label-large" style="text-align: left; padding: 8px 16px 8px 32px; color: var(--md-sys-color-on-surface-variant);">
                ${translateCategory(category.name)}
              </th>
            </tr>
            ${repeat(category.lines, (line) => line.account_code, (line) => html`
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
                    <material-symbols name="${isBalanced ? 'check_circle' : 'error'}" size="20"></material-symbols>
                    ${isBalanced ? t('financialReport', 'balanceSheetBalancedMessage') : t('financialReport', 'balanceSheetOutOfBalanceMessage', i18n.displayCurrency(Math.abs(totalAssets - totalLiabilities - totalEquity)))}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    function renderIncomeStatement() {
      if (state.incomeStatementLines.length === 0) return renderEmptyState();

      /** @type {Map<string, Map<string, IncomeStatementRow[]>>} */
      const groupedLines = new Map();
      for (const line of state.incomeStatementLines) {
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

      for (const line of state.incomeStatementLines) {
        if (line.classification === 'Revenue') totalRevenue += Math.abs(line.amount);
        else if (line.classification === 'Cost of Goods Sold') totalCOGS += Math.abs(line.amount);
        else if (line.classification === 'Expenses') totalExpenses += Math.abs(line.amount);
      }

      const grossProfit = totalRevenue - totalCOGS;
      const netIncome = grossProfit - totalExpenses;

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
          .map(function evaluteCategory([categoryName, lines]) {
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
          ${repeat(calculatedCategories, (category) => category.name, (category) => html`
            ${category.name !== classification ? html`
              <tr style="background-color: var(--md-sys-color-surface-container-low);">
                <th colspan="3" scope="colgroup" class="label-large" style="text-align: left; padding: 8px 16px 8px 32px; color: var(--md-sys-color-on-surface-variant);">
                  ${category}
                </th>
              </tr>
            ` : nothing}
            ${repeat(category.lines, (line) => line.account_code, (line) => html`
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
                  ${t('financialReport', 'totalCategoryFormat', category)}
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

    function renderReportContent() {
      if (state.selectedReportType === 'trialBalance') return renderTrialBalance();
      else if (state.selectedReportType === 'balanceSheet') return renderBalanceSheet();
      else if (state.selectedReportType === 'incomeStatement') return renderIncomeStatement();
      else return nothing;
    }

    useEffect(host, function renderFinancialReportsView() {
      render(html`
        <div style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 16px 24px; height: 100%;">
          <header style="--md-sys-density: -4; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;">
            <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; flex-wrap: wrap;">
              ${renderReportTypeSelector()}
              ${renderBalanceReportSelector()}
              ${renderFiscalYearSelector()}
            </div>
            <div style="display: flex; flex-direction: row; gap: 12px; align-items: center;">
              <button role="button" class="text" @click=${loadReportData} aria-label="Refresh report">
                <material-symbols name="refresh"></material-symbols>
                ${t('financialReport', 'refreshActionLabel')}
              </button>
              ${state.selectedReportType !== 'incomeStatement' ? html`
                <button
                  role="button"
                  class="tonal"
                  @click=${generateNewReport}
                  ?disabled=${state.isGenerating}
                >
                  ${state.isGenerating ? html`
                    <span style="width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center;">
                      <div role="progressbar" class="linear indeterminate" style="width: 60px;">
                        <div class="track">
                          <div class="indicator"></div>
                        </div>
                      </div>
                    </span>
                  ` : html`
                    <material-symbols name="add"></material-symbols>
                  `}
                  ${t('financialReport', 'generateReportActionLabel')}
                </button>
              ` : nothing}
            </div>
          </header>

          <div class="scrollable" style="flex: 1; overflow-y: auto;">
            ${state.isLoading ? renderLoadingIndicator() : nothing}
            ${state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
            ${state.isLoading === false && state.error === null ? renderReportContent() : nothing}
          </div>
        </div>
      `);
    });
  }
}

defineWebComponent('financial-reports-view', FinancialReportsViewElement);
