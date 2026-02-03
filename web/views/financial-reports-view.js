import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';

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
import '#web/views/trial-balance-view.js';
import '#web/views/balance-sheet-view.js';
import '#web/views/income-statement-view.js';

/**
 * @typedef {object} BalanceReportRow
 * @property {number} id
 * @property {number} report_time
 * @property {string} report_type
 * @property {string | null} name
 * @property {number} create_time
 */

export class FinancialReportsViewElement extends HTMLElement {
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
      balanceReports: /** @type {BalanceReportRow[]} */ ([]),
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false;
    });

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
          LIMIT 100
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
        state.isLoading = false;
      }
      catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
        state.isLoading = false;
      }
    }

    async function handleBalanceReportCreated() {
      await loadBalanceReports();
    }

    useEffect(host, loadBalanceReports);

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
          <button role="button" class="tonal" @click=${loadBalanceReports}>
            <material-symbols name="refresh"></material-symbols>
            ${t('financialReport', 'retryActionLabel')}
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
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('financialReport', 'noReportsGeneratedTitle')}</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            ${t('financialReport', 'noReportsGeneratedMessage')}
          </p>
        </div>
      `;
    }

    /**
     * @param {BalanceReportRow} report
     */
    function renderReportRow(report) {
      return html`
        <tr>
          <td style="white-space: nowrap;">${report.name ? report.name : t('financialReport', 'reportIdFormat', report.id)}</td>
          <td style="white-space: nowrap;">${i18n.date.format(report.report_time)}</td>
          <td style="white-space: nowrap;">${i18n.date.format(report.create_time)}</td>
          <td class="center" style="white-space: nowrap;">
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
            <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
              <a
                is="router-link"
                role="button"
                class="text extra-small"
                href="/books/reports/trial-balance?reportId=${report.id}"
                style="--md-sys-density: -4;"
                aria-label="${t('financialReport', 'reportTypeTrialBalance')}"
              >
                ${t('financialReport', 'reportTypeTrialBalance')}
              </a>
              <a
                is="router-link"
                role="button"
                class="text extra-small"
                href="/books/reports/balance-sheet?reportId=${report.id}"
                style="--md-sys-density: -4;"
                aria-label="${t('financialReport', 'reportTypeBalanceSheet')}"
              >
                ${t('financialReport', 'reportTypeBalanceSheet')}
              </a>
            </div>
          </td>
        </tr>
      `;
    }

    function renderReportsTable() {
      if (state.balanceReports.length === 0) {
        return renderEmptyState();
      }

      return html`
        <div style="overflow-x: auto;">
          <table aria-label="Generated balance reports" style="--md-sys-density: -3; min-width: 700px;">
            <thead>
              <tr>
                <th scope="col">${t('financialReport', 'reportNameLabel')}</th>
                <th scope="col" style="width: 140px;">${t('financialReport', 'reportDateLabel')}</th>
                <th scope="col" style="width: 140px;">Snapshot Date</th>
                <th scope="col" class="center" style="width: 120px;">Type</th>
                <th scope="col" class="center" style="width: 200px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${repeat(state.balanceReports, (report) => report.id, (report) => html`
                ${renderReportRow(report)}
              `)}
            </tbody>
          </table>
        </div>
      `;
    }

    function renderReportsList() {
      return html`
        <div style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 16px 24px; height: 100%;">
          <header style="--md-sys-density: -4; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: row; gap: 12px; align-items: center;">
              <h1 class="title-large">Financial Reports</h1>
            </div>
            <div style="display: flex; flex-direction: row; gap: 12px; align-items: center;">
              <button role="button" class="text" @click=${loadBalanceReports} aria-label="Refresh reports">
                <material-symbols name="refresh"></material-symbols>
                ${t('financialReport', 'refreshActionLabel')}
              </button>
              <button
                role="button"
                class="tonal"
                commandfor="balance-report-creation-dialog"
                command="--open"
              >
                <material-symbols name="add"></material-symbols>
                ${t('financialReport', 'generateReportActionLabel')}
              </button>
            </div>
          </header>

          <div class="scrollable" style="flex: 1; overflow-y: auto;">
            ${state.isLoading ? renderLoadingIndicator() : nothing}
            ${state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
            ${state.isLoading === false && state.error === null ? renderReportsTable() : nothing}
          </div>
        </div>

        <balance-report-creation-dialog
          id="balance-report-creation-dialog"
          @balance-report-created=${handleBalanceReportCreated}
        ></balance-report-creation-dialog>
      `;
    }

    useEffect(host, function renderFinancialReportsView() {
      const pathname = router.route.pathname;
      if (pathname.startsWith('/books/reports/trial-balance')) {
        render(html`<trial-balance-view></trial-balance-view>`);
      }
      else if (pathname.startsWith('/books/reports/balance-sheet')) {
        render(html`<balance-sheet-view></balance-sheet-view>`);
      }
      else if (pathname.startsWith('/books/reports/income-statement')) {
        render(html`<income-statement-view></income-statement-view>`);
      }
      else {
        render(renderReportsList());
      }
    });
  }
}

defineWebComponent('financial-reports-view', FinancialReportsViewElement);
