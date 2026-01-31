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
 * Trial Balance View
 * 
 * Displays trial balance for a specific balance report.
 * Uses the reportId URL parameter to load the trial balance data.
 */
export class TrialBalanceViewElement extends HTMLElement {
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
      lines: /** @type {Array<{account_code: number, account_name: string, normal_balance: number, debit: number, credit: number}>} */ ([]),
      isLoaded: false,
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false;
    });

    async function loadTrialBalance() {
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
            tbl.account_code,
            a.name AS account_name,
            a.normal_balance,
            tbl.debit,
            tbl.credit
          FROM balance_reports br
          JOIN trial_balance_lines tbl ON tbl.balance_report_id = br.id
          JOIN accounts a ON a.account_code = tbl.account_code
          WHERE br.id = ${state.reportId}
          ORDER BY tbl.account_code ASC
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
            normal_balance: Number(row.normal_balance),
            debit: Number(row.debit),
            credit: Number(row.credit),
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

    useEffect(host, loadTrialBalance);

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
          <button role="button" class="tonal" @click=${loadTrialBalance}>
            <material-symbols name="refresh"></material-symbols>
            ${t('financialReport', 'retryActionLabel')}
          </button>
        </div>
      `;
    }

    function renderTrialBalanceTable() {
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
              No trial balance data available for this report.
            </p>
          </div>
        `;
      }

      let totalDebit = 0;
      let totalCredit = 0;
      for (const line of state.lines) {
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
              ${state.lines.map((line) => html`
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

    useEffect(host, function renderTrialBalanceView() {
      render(html`
        <div style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 16px 24px; height: 100%;">
          <header style="--md-sys-density: -4; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <hgroup>
                <h1 class="title-large">${t('financialReport', 'reportTypeTrialBalance')}</h1>
                <p class="label-medium" style="color: var(--md-sys-color-on-surface-variant);">
                  ${state.reportName ? state.reportName : t('financialReport', 'reportIdFormat', state.reportId || 0)}
                  ${state.reportTime ? ` • ${i18n.date.format(state.reportTime)}` : nothing}
                </p>
              </hgroup>
            </div>
            <div style="display: flex; flex-direction: row; gap: 12px; align-items: center;">
              <button role="button" class="text" @click=${loadTrialBalance} aria-label="Refresh report">
                <material-symbols name="refresh"></material-symbols>
                ${t('financialReport', 'refreshActionLabel')}
              </button>
            </div>
          </header>

          <div class="scrollable" style="flex: 1; overflow-y: auto;">
            ${state.isLoading ? renderLoadingIndicator() : nothing}
            ${state.isLoaded && state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
            ${state.isLoaded && state.error === null ? renderTrialBalanceTable() : nothing}
          </div>
        </div>
      `);
    });
  }
}

defineWebComponent('trial-balance-view', TrialBalanceViewElement);
