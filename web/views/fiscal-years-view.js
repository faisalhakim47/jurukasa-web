import { html, nothing } from 'lit-html';
import { when } from 'lit-html/directives/when.js';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { FiscalYearClosingDialogElement } from '#web/components/fiscal-year-closing-dialog.js';
import { FiscalYearReversalDialogElement } from '#web/components/fiscal-year-reversal-dialog.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useElement } from '#web/hooks/use-element.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';

import '#web/components/material-symbols.js';
import '#web/components/fiscal-year-creation-dialog.js';
import '#web/components/fiscal-year-closing-dialog.js';
import '#web/components/fiscal-year-reversal-dialog.js';

/**
 * @typedef {object} FiscalYearRow
 * @property {number} begin_time
 * @property {number} end_time
 * @property {string | null} name
 * @property {number | null} post_time
 * @property {number | null} closing_journal_entry_ref
 * @property {number | null} reversal_time
 * @property {number | null} reversal_journal_entry_ref
 */

/**
 * @typedef {object} BalanceReportRow
 * @property {number} id
 * @property {number} report_time
 * @property {string} report_type
 * @property {string | null} name
 * @property {number} create_time
 */

/**
 * @typedef {object} ClosingEntryDetail
 * @property {number} journal_entry_ref
 * @property {number} entry_time
 * @property {string | null} note
 * @property {number} line_number
 * @property {number} account_code
 * @property {string} account_name
 * @property {number} debit
 * @property {number} credit
 */

export class FiscalYearsViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);

    const fiscalYearClosingDialog = useElement(host, FiscalYearClosingDialogElement);
    const fiscalYearReversalDialog = useElement(host, FiscalYearReversalDialogElement);
    const fiscalYearDetailsDialog = useElement(host, HTMLDialogElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      fiscalYears: /** @type {FiscalYearRow[]} */ ([]),
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      selectedFiscalYearForDetails: /** @type {FiscalYearRow | null} */ (null),
      detailsState: {
        isLoading: false,
        error: /** @type {Error | null} */ (null),
        incomeStatementLines: /** @type {Array<{classification: string, category: string, account_code: number, account_name: string, amount: number}>} */ ([]),
        closingEntryRef: /** @type {number | null} */ (null),
        closingEntryLines: /** @type {ClosingEntryDetail[]} */ ([]),
        balanceReportsBeforeClosing: /** @type {BalanceReportRow[]} */ ([]),
        balanceReportsAfterClosing: /** @type {BalanceReportRow[]} */ ([]),
      },
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false;
    });

    async function loadFiscalYears() {
      try {
        state.isLoading = true;
        state.error = null;

        const result = await database.sql`
          SELECT
            begin_time,
            end_time,
            name,
            post_time,
            closing_journal_entry_ref,
            reversal_time,
            reversal_journal_entry_ref
          FROM fiscal_years
          ORDER BY begin_time DESC
        `;

        state.fiscalYears = result.rows.map(function rowToFiscalYear(row) {
          return /** @type {FiscalYearRow} */ ({
            begin_time: Number(row.begin_time),
            end_time: Number(row.end_time),
            name: row.name ? String(row.name) : null,
            post_time: row.post_time ? Number(row.post_time) : null,
            closing_journal_entry_ref: row.closing_journal_entry_ref ? Number(row.closing_journal_entry_ref) : null,
            reversal_time: row.reversal_time ? Number(row.reversal_time) : null,
            reversal_journal_entry_ref: row.reversal_journal_entry_ref ? Number(row.reversal_journal_entry_ref) : null,
          });
        });

        state.isLoading = false;
      }
      catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
        state.isLoading = false;
      }
    }

    async function loadFiscalYearDetails() {
      if (!state.selectedFiscalYearForDetails) return;

      try {
        state.detailsState.isLoading = true;
        state.detailsState.error = null;

        const beginTime = state.selectedFiscalYearForDetails.begin_time;
        const endTime = state.selectedFiscalYearForDetails.end_time;
        const postTime = state.selectedFiscalYearForDetails.post_time;

        const [incomeResult, closingEntryResult, balanceReportsBeforeResult, balanceReportsAfterResult] = await Promise.all([
          database.sql`
            SELECT
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
          `,
          state.selectedFiscalYearForDetails.closing_journal_entry_ref ? database.sql`
            SELECT
              jel.journal_entry_ref,
              je.entry_time,
              je.note,
              jel.line_number,
              jel.account_code,
              a.name AS account_name,
              jel.debit,
              jel.credit
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.ref = jel.journal_entry_ref
            JOIN accounts a ON a.account_code = jel.account_code
            WHERE jel.journal_entry_ref = ${state.selectedFiscalYearForDetails.closing_journal_entry_ref}
            ORDER BY jel.line_number ASC
          ` : Promise.resolve({ rows: [] }),
          database.sql`
            SELECT
              id,
              report_time,
              report_type,
              name,
              create_time
            FROM balance_reports
            WHERE report_time <= ${endTime}
              AND (${postTime} IS NULL OR report_time <= ${postTime})
            ORDER BY report_time DESC
            LIMIT 10
          `,
          postTime ? database.sql`
            SELECT
              id,
              report_time,
              report_type,
              name,
              create_time
            FROM balance_reports
            WHERE report_time > ${postTime}
              AND report_time <= ${Date.now()}
            ORDER BY report_time DESC
            LIMIT 10
          ` : Promise.resolve({ rows: [] }),
        ]);

        state.detailsState.incomeStatementLines = incomeResult.rows.map(function mapRow(row) {
          return {
            classification: String(row.classification),
            category: String(row.category),
            account_code: Number(row.account_code),
            account_name: String(row.account_name),
            amount: Number(row.amount),
          };
        });

        state.detailsState.closingEntryRef = state.selectedFiscalYearForDetails.closing_journal_entry_ref;
        state.detailsState.closingEntryLines = closingEntryResult.rows.map(function mapRow(row) {
          return {
            journal_entry_ref: Number(row.journal_entry_ref),
            entry_time: Number(row.entry_time),
            note: row.note ? String(row.note) : null,
            line_number: Number(row.line_number),
            account_code: Number(row.account_code),
            account_name: String(row.account_name),
            debit: Number(row.debit),
            credit: Number(row.credit),
          };
        });

        state.detailsState.balanceReportsBeforeClosing = balanceReportsBeforeResult.rows.map(function mapRow(row) {
          return {
            id: Number(row.id),
            report_time: Number(row.report_time),
            report_type: String(row.report_type),
            name: row.name ? String(row.name) : null,
            create_time: Number(row.create_time),
          };
        });

        state.detailsState.balanceReportsAfterClosing = balanceReportsAfterResult.rows.map(function mapRow(row) {
          return {
            id: Number(row.id),
            report_time: Number(row.report_time),
            report_type: String(row.report_type),
            name: row.name ? String(row.name) : null,
            create_time: Number(row.create_time),
          };
        });

        state.detailsState.isLoading = false;
      }
      catch (error) {
        state.detailsState.error = error instanceof Error ? error : new Error(String(error));
        state.detailsState.isLoading = false;
      }
    }

    useEffect(host, loadFiscalYears);

    useEffect(host, function loadDetailsWhenFiscalYearSelected() {
      if (state.selectedFiscalYearForDetails) {
        loadFiscalYearDetails();
      }
    });

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label="${t('fiscalYear', 'loadingFiscalYearLabel')}"
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
          <p>${t('fiscalYear', 'loadingLabel')}</p>
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
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('fiscalYear', 'loadErrorTitle')}</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadFiscalYears}>
            <material-symbols name="refresh"></material-symbols>
            ${t('fiscalYear', 'retryActionLabel')}
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
          <material-symbols name="calendar_month" size="64"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('fiscalYear', 'emptyStateTitle')}</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            ${t('fiscalYear', 'emptyStateMessage')}
          </p>
          <button
            role="button"
            type="button"
            class="tonal"
            commandfor="fiscal-year-creation-dialog"
            command="--open"
          >
            <material-symbols name="add"></material-symbols>
            ${t('fiscalYear', 'createActionLabel')}
          </button>
        </div>
      `;
    }

    /**
     * @param {FiscalYearRow} fiscalYear
     */
    function renderFiscalYearRow(fiscalYear) {
      const statusText = fiscalYear.reversal_time ? t('fiscalYear', 'statusReversed') : fiscalYear.post_time ? t('fiscalYear', 'statusClosed') : t('fiscalYear', 'statusOpen');
      const displayName = fiscalYear.name || t('fiscalYear', 'fiscalYearDefaultName', new Date(fiscalYear.begin_time).getFullYear());
      const canReverse = fiscalYear.post_time && !fiscalYear.reversal_time;

      return html`
        <tr>
          <td class="label-large" style="color: var(--md-sys-color-primary);">
            <button
              role="button"
              type="button"
              class="text extra-small"
              style="--md-sys-density: -4;"
              data-begin-time="${fiscalYear.begin_time}"
              @click=${() => { state.selectedFiscalYearForDetails = fiscalYear; fiscalYearDetailsDialog.value?.showModal(); }}
            >${displayName}</button>
          </td>
          <td style="white-space: nowrap;">${i18n.date.format(fiscalYear.begin_time)}</td>
          <td style="white-space: nowrap;">${i18n.date.format(fiscalYear.end_time)}</td>
          <td class="center">
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span
                class="label-small"
                style="
                  display: inline-flex;
                  align-items: center;
                  gap: 4px;
                  padding: 4px 8px;
                  border-radius: var(--md-sys-shape-corner-small);
                  background-color: ${fiscalYear.reversal_time ? 'var(--md-sys-color-error-container)' : fiscalYear.post_time ? 'var(--md-sys-color-tertiary-container)' : 'var(--md-sys-color-secondary-container)'};
                  color: ${fiscalYear.reversal_time ? 'var(--md-sys-color-on-error-container)' : fiscalYear.post_time ? 'var(--md-sys-color-on-tertiary-container)' : 'var(--md-sys-color-on-secondary-container)'};
                "
              >
                ${when(fiscalYear.reversal_time, () => html`<material-symbols name="history" size="16" aria-hidden="true"></material-symbols>`)}
                ${when(!fiscalYear.reversal_time && fiscalYear.post_time, () => html`<material-symbols name="lock" size="16" aria-hidden="true"></material-symbols>`)}
                ${when(!fiscalYear.reversal_time && !fiscalYear.post_time, () => html`<material-symbols name="lock_open" size="16" aria-hidden="true"></material-symbols>`)}
                ${statusText}
              </span>
              ${canReverse ? html`
                <button
                  role="button"
                  type="button"
                  class="text extra-small"
                  style="--md-sys-density: -4;"
                  commandfor="fiscal-year-reversal-dialog"
                  command="--open"
                  data-begin-time="${fiscalYear.begin_time}"
                  aria-label="${t('fiscalYear', 'reverseActionLabel')} ${displayName}"
                >
                  <material-symbols name="history" size="18"></material-symbols>
                  ${t('fiscalYear', 'reverseActionLabel')}
                </button>
              ` : nothing}
            </div>
          </td>
          <td style="white-space: nowrap;">${fiscalYear.post_time ? i18n.date.format(fiscalYear.post_time) : '—'}</td>
          <td class="center">
            ${fiscalYear.closing_journal_entry_ref
          ? html`<span style="color: var(--md-sys-color-primary);">#${fiscalYear.closing_journal_entry_ref}</span>`
          : '—'}
          </td>
        </tr>
      `;
    }

    function renderFiscalYearsTable() {
      if (state.fiscalYears.length === 0) return renderEmptyState();
      return html`
        <table aria-label="Fiscal years list" style="--md-sys-density: -3;">
          <thead>
            <tr>
              <th scope="col">${t('fiscalYear', 'nameColumn')}</th>
              <th scope="col" style="width: 140px;">${t('fiscalYear', 'beginDateColumn')}</th>
              <th scope="col" style="width: 140px;">${t('fiscalYear', 'endDateColumn')}</th>
              <th scope="col" class="center" style="width: 100px;">${t('fiscalYear', 'statusColumn')}</th>
              <th scope="col" style="width: 140px;">${t('fiscalYear', 'closedOnColumn')}</th>
              <th scope="col" class="center" style="width: 120px;">${t('fiscalYear', 'closingEntryColumn')}</th>
            </tr>
          </thead>
          <tbody>
            ${state.fiscalYears.map(renderFiscalYearRow)}
          </tbody>
        </table>
      `;
    }

    function renderIncomeStatementSection() {
      if (!state.selectedFiscalYearForDetails || !state.selectedFiscalYearForDetails.post_time) {
        return html`
          <div style="text-align: center; padding: 32px; color: var(--md-sys-color-on-surface-variant);">
            <material-symbols name="info" size="48" style="margin-bottom: 16px;"></material-symbols>
            <p>Fiscal year must be closed to view income statement.</p>
          </div>
        `;
      }

      if (state.detailsState.isLoading) {
        return html`
          <div role="status" aria-live="polite" aria-busy="true" style="padding: 32px; text-align: center;">
            <div role="progressbar" class="linear indeterminate">
              <div class="track"><div class="indicator"></div></div>
            </div>
            <p>Loading income statement...</p>
          </div>
        `;
      }

      if (state.detailsState.error instanceof Error) {
        return html`
          <div role="alert" style="padding: 32px; text-align: center; color: var(--md-sys-color-error);">
            <p>${state.detailsState.error.message}</p>
          </div>
        `;
      }

      const lines = state.detailsState.incomeStatementLines;
      if (lines.length === 0) {
        return html`
          <div style="text-align: center; padding: 32px; color: var(--md-sys-color-on-surface-variant);">
            <p>No income statement data available for this fiscal year.</p>
          </div>
        `;
      }

      /** @type {Map<string, Map<string, Array<{account_code: number, account_name: string, amount: number}>>>} */
      const groupedLines = new Map();
      for (const line of lines) {
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

      for (const line of lines) {
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
                <th scope="col" style="width: 100px;">Code</th>
                <th scope="col">Account Name</th>
                <th scope="col" class="numeric" style="width: 160px;">Amount</th>
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

    /**
     * @param {typeof state.detailsState.balanceReportsBeforeClosing} reports
     * @param {string} title
     * @param {string} emptyMessage
     */
    function renderBalanceReportsSection(reports, title, emptyMessage) {
      if (reports.length === 0) {
        return html`
          <div style="padding: 16px; text-align: center; color: var(--md-sys-color-on-surface-variant);">
            <p class="label-medium">${emptyMessage}</p>
          </div>
        `;
      }

      return html`
        <table aria-label="${title}" style="--md-sys-density: -3; min-width: 400px;">
          <thead>
            <tr>
              <th scope="col">${t('financialReport', 'reportNameLabel')}</th>
              <th scope="col" style="width: 140px;">${t('financialReport', 'reportDateLabel')}</th>
              <th scope="col" class="center" style="width: 80px;">${t('financialReport', 'reportTypeLabel')}</th>
              <th scope="col" class="center" style="width: 100px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${reports.map((report) => html`
              <tr>
                <td>${report.name || t('financialReport', 'reportIdFormat', report.id)}</td>
                <td style="white-space: nowrap;">${i18n.date.format(report.report_time)}</td>
                <td class="center">
                  <span
                    class="label-small"
                    style="
                      display: inline-flex;
                      align-items: center;
                      gap: 4px;
                      padding: 4px 8px;
                      border-radius: var(--md-sys-shape-corner-small);
                      background-color: var(--md-sys-color-secondary-container);
                      color: var(--md-sys-color-on-secondary-container);
                    "
                  >${report.report_type}</span>
                </td>
                <td class="center">
                  <div style="display: flex; gap: 4px; justify-content: center;">
                    <a
                      is="router-link"
                      role="button"
                      class="text extra-small"
                      href="/books/reports/trial-balance?reportId=${report.id}"
                      style="--md-sys-density: -4;"
                      aria-label="${t('financialReport', 'reportTypeTrialBalance')}"
                    >
                      TB
                    </a>
                    <a
                      is="router-link"
                      role="button"
                      class="text extra-small"
                      href="/books/reports/balance-sheet?reportId=${report.id}"
                      style="--md-sys-density: -4;"
                      aria-label="${t('financialReport', 'reportTypeBalanceSheet')}"
                    >
                      BS
                    </a>
                  </div>
                </td>
              </tr>
            `)}
          </tbody>
        </table>
      `;
    }

    function renderClosingStatementSection() {
      const lines = state.detailsState.closingEntryLines;
      if (lines.length === 0) return nothing;

      let totalDebit = 0;
      let totalCredit = 0;
      for (const line of lines) {
        totalDebit += line.debit;
        totalCredit += line.credit;
      }

      return html`
        <div style="overflow-x: auto;">
          <h4 class="title-small" style="margin-bottom: 12px;">Closing Entry Details</h4>
          <table aria-label="Closing entry journal entries" style="--md-sys-density: -3; min-width: 500px;">
            <thead>
              <tr>
                <th scope="col" style="width: 80px;">Ref</th>
                <th scope="col" style="width: 100px;">${t('financialReport', 'codeColumnHeader')}</th>
                <th scope="col">${t('financialReport', 'accountNameColumnHeader')}</th>
                <th scope="col" class="numeric" style="width: 120px;">${t('financialReport', 'debitColumnHeader')}</th>
                <th scope="col" class="numeric" style="width: 120px;">${t('financialReport', 'creditColumnHeader')}</th>
              </tr>
            </thead>
            <tbody>
              ${lines.map((line) => html`
                <tr>
                  <td class="label-medium" style="color: var(--md-sys-color-on-surface-variant);">#${line.journal_entry_ref}</td>
                  <td class="label-large" style="color: var(--md-sys-color-primary);">${line.account_code}</td>
                  <td>${line.account_name}</td>
                  <td class="numeric">${line.debit > 0 ? i18n.displayCurrency(line.debit) : '—'}</td>
                  <td class="numeric">${line.credit > 0 ? i18n.displayCurrency(line.credit) : '—'}</td>
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

    function renderFiscalYearDetailsDialog() {
      if (!state.selectedFiscalYearForDetails) return nothing;

      const fiscalYear = state.selectedFiscalYearForDetails;
      const displayName = fiscalYear.name || `Fiscal Year ${new Date(fiscalYear.begin_time).getFullYear()}`;

      return html`
        <dialog ${fiscalYearDetailsDialog} name="${displayName}" aria-labelledby="fiscal-year-details-dialog-title" style="width: min(95vw, 1000px); max-height: 90vh; overflow: auto;">
          <div class="container">
            <header>
              <h2 id="fiscal-year-details-dialog-title">${displayName}</h2>
              <button
                role="button"
                type="button"
                class="text"
                aria-label="Close dialog"
                commandfor="fiscal-year-details-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
            </header>

            <div class="content" style="display: flex; flex-direction: column; gap: 24px;">

              <div>
                <h3 class="title-medium">Period</h3>
                <p class="label-medium" style="color: var(--md-sys-color-on-surface-variant);">
                  From ${i18n.date.format(fiscalYear.begin_time)} to ${i18n.date.format(fiscalYear.end_time)}
                </p>
              </div>

              ${state.detailsState.isLoading ? html`
                <div role="status" aria-live="polite" aria-busy="true" style="padding: 32px; text-align: center;">
                  <div role="progressbar" class="linear indeterminate">
                    <div class="track"><div class="indicator"></div></div>
                  </div>
                  <p>Loading details...</p>
                </div>
              ` : nothing}

              ${state.detailsState.error instanceof Error ? html`
                <div role="alert" style="padding: 16px; color: var(--md-sys-color-error);">
                  <p>${state.detailsState.error.message}</p>
                </div>
              ` : nothing}

              ${!state.detailsState.isLoading && !(state.detailsState.error instanceof Error) ? html`

                ${fiscalYear.closing_journal_entry_ref ? html`
                  <div>
                    <h3 class="title-medium">Closing Entry</h3>
                    <p class="label-medium" style="color: var(--md-sys-color-primary);">
                      ${fiscalYear.closing_journal_entry_ref ? `Journal Entry #${fiscalYear.closing_journal_entry_ref}` : 'No closing entry'}
                    </p>
                    ${renderClosingStatementSection()}
                  </div>
                ` : html`
                  <div style="padding: 24px; text-align: center; color: var(--md-sys-color-on-surface-variant);">
                    <material-symbols name="lock_open" size="32" style="margin-bottom: 8px;"></material-symbols>
                    <p>This fiscal year is open. Close it to view closing statements and income statement.</p>
                  </div>
                `}

                ${state.detailsState.balanceReportsBeforeClosing.length > 0 ? html`
                  <div>
                    <h3 class="title-medium">Balance Reports Before Closing</h3>
                    ${renderBalanceReportsSection(
                      state.detailsState.balanceReportsBeforeClosing,
                      'Balance reports before closing',
                      'No balance reports generated before closing'
                    )}
                  </div>
                ` : nothing}

                ${state.detailsState.balanceReportsAfterClosing.length > 0 ? html`
                  <div>
                    <h3 class="title-medium">Balance Reports After Closing</h3>
                    ${renderBalanceReportsSection(
                      state.detailsState.balanceReportsAfterClosing,
                      'Balance reports after closing',
                      'No balance reports generated after closing'
                    )}
                  </div>
                ` : nothing}

                ${fiscalYear.post_time ? html`
                  <div>
                    <h3 class="title-medium">Income Statement</h3>
                    ${renderIncomeStatementSection()}
                  </div>
                ` : nothing}

              ` : nothing}
            </div>
          </div>
        </dialog>
      `;
    }

    useEffect(host, function renderFiscalYearsView() {
      render(html`
        <div style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 16px 24px 0px;">
          <header style="--md-sys-density: -4; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: row; gap: 12px; align-items: center;">
            </div>
            <div style="display: flex; flex-direction: row; gap: 12px; align-items: center;">
              <button role="button" class="text" @click=${loadFiscalYears} aria-label="${t('fiscalYear', 'refreshActionLabel')}">
                <material-symbols name="refresh"></material-symbols>
                ${t('fiscalYear', 'refreshActionLabel')}
              </button>
              <button role="button" type="button" class="tonal" commandfor="fiscal-year-creation-dialog" command="--open">
                <material-symbols name="add"></material-symbols>
                ${t('fiscalYear', 'newFiscalYearActionLabel')}
              </button>
            </div>
          </header>

          ${state.isLoading ? renderLoadingIndicator() : nothing}
          ${state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
          ${state.isLoading === false && state.error === null ? renderFiscalYearsTable() : nothing}
        </div>

        <fiscal-year-creation-dialog
          id="fiscal-year-creation-dialog"
          @fiscal-year-created=${loadFiscalYears}
        ></fiscal-year-creation-dialog>

        <fiscal-year-closing-dialog
          ${fiscalYearClosingDialog}
          id="fiscal-year-closing-dialog"
          @fiscal-year-closed=${loadFiscalYears}
        ></fiscal-year-closing-dialog>

        <fiscal-year-reversal-dialog
          ${fiscalYearReversalDialog}
          id="fiscal-year-reversal-dialog"
          @fiscal-year-reversed=${loadFiscalYears}
        ></fiscal-year-reversal-dialog>

        ${renderFiscalYearDetailsDialog()}
      `);
    });
  }
}

defineWebComponent('fiscal-years-view', FiscalYearsViewElement);
