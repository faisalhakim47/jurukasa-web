import { html, nothing } from 'lit-html';
import { reactive } from '@vue/reactivity';
import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useRender } from '#web/hooks/use-render.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useContext } from '#web/hooks/use-context.js';
import { webStyleSheets } from '#web/styles.js';

import '#web/components/material-symbols.js';
import '#web/components/router-link.js';

export class DashboardViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);

    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      netRevenue: 0,
      revenueChange: 0,
      revenueSparkline: /** @type {number[]} */ ([]),
      cashBalance: 0,
      bankBalance: 0,
      payableBalance: 0,
      taxReserve: 0,
      stockAlerts: /** @type {Array<{name: string, stock: number, isVeryLow: boolean}>} */ ([]),
      recentSales: /** @type {Array<{id: number, name: string, amount: number}>} */ ([]),
      fiscalYear: /** @type {{name: string, beginTime: number, endTime: number, progress: number} | null} */ (null),
      isLoading: true,
      error: /** @type {Error | null} */ (null),
    });

    async function loadDashboardData() {
      try {
        state.isLoading = true;
        state.error = null;

        // Get current fiscal year
        const fiscalYearResult = await database.sql`
          SELECT begin_time, end_time, name, post_time
          FROM fiscal_years
          WHERE post_time IS NULL
          ORDER BY begin_time DESC
          LIMIT 1
        `;

        if (fiscalYearResult.rows.length > 0) {
          const fy = fiscalYearResult.rows[0];
          const beginTime = /** @type {number} */ (fy.begin_time);
          const endTime = /** @type {number} */ (fy.end_time);
          const now = Date.now();
          const totalDuration = endTime - beginTime;
          const elapsed = Math.min(now - beginTime, totalDuration);
          const progress = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));

          state.fiscalYear = {
            name: /** @type {string} */ (fy.name) || 'FY ' + new Date(beginTime).getFullYear(),
            beginTime,
            endTime,
            progress,
          };
        }

        // Get account balances by tag
        const accountsResult = await database.sql`
          SELECT a.account_code, a.name, a.balance, at.tag
          FROM accounts a
          LEFT JOIN account_tags at ON a.account_code = at.account_code
          WHERE a.is_active = 1
        `;

        let cashBalance = 0;
        let bankBalance = 0;
        let payableBalance = 0;
        let taxReserve = 0;

        for (const row of accountsResult.rows) {
          const balance = /** @type {number} */ (row.balance);
          const tag = /** @type {string} */ (row.tag);
          const name = /** @type {string} */ (row.name);
          if (tag === 'POS - Payment Method' || name.toLowerCase().includes('cash')) {
            if (name.toLowerCase().includes('bank')) bankBalance += balance;
            else cashBalance += balance;
          }
          else if (tag === 'Liability' || name.toLowerCase().includes('payable')) {
            payableBalance += balance;
          }
          else if (name.toLowerCase().includes('tax')) {
            taxReserve += balance;
          }
        }

        state.cashBalance = cashBalance;
        state.bankBalance = bankBalance;
        state.payableBalance = payableBalance;
        state.taxReserve = taxReserve;

        // Get revenue data from fiscal year revenue summary
        const revenueResult = await database.sql`
          SELECT COALESCE(total_net_revenue, 0) as total_net_revenue
          FROM fiscal_year_revenue_summary
          LIMIT 1
        `;

        if (revenueResult.rows.length > 0) {
          state.netRevenue = /** @type {number} */ (revenueResult.rows[0].total_net_revenue) || 0;
        }

        // Get revenue sparkline data (last 7 days)
        const sparklineResult = await database.sql`
          SELECT net_revenue FROM revenue_sparkline ORDER BY date_key ASC
        `;
        state.revenueSparkline = sparklineResult.rows.map(function (row) {
          return /** @type {number} */ (row.net_revenue);
        });

        // Get revenue change percentage (week over week comparison)
        const revenueChangeResult = await database.sql`
          SELECT revenue_change_percent FROM revenue_period_comparison
        `;
        if (revenueChangeResult.rows.length > 0) {
          state.revenueChange = /** @type {number} */ (revenueChangeResult.rows[0].revenue_change_percent) || 0;
        }

        // Get low stock items
        const stockAlertsResult = await database.sql`
          SELECT name, stock
          FROM inventories
          WHERE stock <= 20 AND stock > 0
          ORDER BY stock ASC
          LIMIT 5
        `;

        state.stockAlerts = stockAlertsResult.rows.map(function (row) {
          return {
            name: /** @type {string} */ (row.name),
            stock: /** @type {number} */ (row.stock),
            isVeryLow: /** @type {number} */ (row.stock) <= 5,
          };
        });

        // Get recent sales
        const recentSalesResult = await database.sql`
          SELECT s.id, s.invoice_amount, s.sale_time
          FROM sales s
          WHERE s.post_time IS NOT NULL
          ORDER BY s.sale_time DESC
          LIMIT 5
        `;

        state.recentSales = recentSalesResult.rows.map(function (row, index) {
          return {
            id: /** @type {number} */ (row.id),
            name: 'Sale #' + row.id,
            amount: /** @type {number} */ (row.invoice_amount) || 0,
          };
        });

        state.isLoading = false;
      } catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
        state.isLoading = false;
      }
    }

    useEffect(host, loadDashboardData);

    function renderLoadingState() {
      return html`
        <div
          role="status"
          aria-label="Loading dashboard"
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            min-height: 400px;
            color: var(--md-sys-color-on-surface-variant);
          "
        >
          <div role="progressbar" class="linear indeterminate" style="width: 200px;">
            <div class="track">
              <div class="indicator"></div>
            </div>
          </div>
          <p>Loading dashboard...</p>
        </div>
      `;
    }

    /**
     * @param {Error} error
     */
    function renderErrorState(error) {
      return html`
        <div
          role="alert"
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            min-height: 400px;
            text-align: center;
            padding: 24px;
          "
        >
          <material-symbols name="error" size="48"></material-symbols>
          <h2
            class="title-large"
            style="margin: 0; color: var(--md-sys-color-on-surface);"
          >Unable to load dashboard</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadDashboardData}>
            <material-symbols name="refresh" style="color: var(--md-sys-color-error);"></material-symbols>
            Retry
          </button>
        </div>
      `;
    }

    function renderFiscalYearCard() {
      if (!state.fiscalYear) {
        return html`
          <article class="card outlined" style="flex: 1;">
            <header>
              <material-symbols name="calendar_today"></material-symbols>
              <hgroup>
                <h3>Fiscal Year</h3>
                <p>No active fiscal year</p>
              </hgroup>
            </header>
            <section style="flex: 1;">
              <div
                style="
                  display: flex;
                  flex-direction:
                  column; align-items: center;
                  justify-content: center;
                  gap: 8px;
                  padding: 24px;
                  box-sizing: border-box;
                  height: 100%;
                  text-align: center;
                  color: var(--md-sys-color-on-surface-variant);
                "
              >
                <material-symbols name="calendar_month" size="32"></material-symbols>
                <p>Set up a fiscal year to start tracking your accounting period.</p>
              </div>
            </section>
          </article>
        `;
      }

      const { name, beginTime, endTime, progress } = state.fiscalYear;

      return html`
        <article class="card outlined" style="flex: 1;">
          <header>
            <material-symbols name="calendar_today"></material-symbols>
            <hgroup>
              <h3>Fiscal Year</h3>
              <p>${name}</p>
            </hgroup>
          </header>
          <section>
            <div class="body-medium" style="display: flex; align-items: center; gap: 8px; color: var(--md-sys-color-on-surface-variant); margin-bottom: 12px;">
              <span>${i18n.date.format(beginTime)}</span>
              <span>—</span>
              <span>${i18n.date.format(endTime)}</span>
            </div>
            <div 
              role="progressbar"
              class="linear"
              aria-valuenow="${Math.round(progress)}"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Fiscal year progress"
              style="--progress: ${progress}%"
            >
              <div class="track">
                <div class="indicator"></div>
              </div>
            </div>
            <p class="body-small" style="color: var(--md-sys-color-on-surface-variant); margin-top: 8px;">${Math.round(progress)}% of fiscal year completed</p>
          </section>
        </article>
      `;
    }

    function renderMetricCards() {
      return html`
        <div role="region" aria-label="Financial metrics" style="display: flex; gap: 16px;">
          <article class="card elevated metric" style="flex: 1;">
            <header>
              <material-symbols name="payments"></material-symbols>
              <h3>Net Revenue</h3>
            </header>
            <section>
              <span role="heading" aria-level="4">${i18n.displayCurrency(state.netRevenue)}</span>
            </section>
          </article>

          <article class="card elevated metric" style="flex: 1;">
            <header>
              <material-symbols name="account_balance_wallet"></material-symbols>
              <h3>Cash Balance</h3>
            </header>
            <section>
              <span role="heading" aria-level="4">${i18n.displayCurrency(state.cashBalance)}</span>
            </section>
          </article>

          <article class="card elevated metric" style="flex: 1;">
            <header>
              <material-symbols name="account_balance"></material-symbols>
              <h3>Bank Balance</h3>
            </header>
            <section>
              <span role="heading" aria-level="4">${i18n.displayCurrency(state.bankBalance)}</span>
            </section>
          </article>

          <article class="card elevated metric" style="flex: 1;">
            <header>
              <material-symbols name="receipt_long"></material-symbols>
              <h3>Accounts Payable</h3>
            </header>
            <section>
              <span role="heading" aria-level="4">${i18n.displayCurrency(state.payableBalance)}</span>
            </section>
          </article>
        </div>
      `;
    }

    function renderStockAlerts() {
      if (state.stockAlerts.length === 0) {
        return html`
          <article class="card outlined" style="flex: 1;">
            <header>
              <material-symbols name="inventory_2"></material-symbols>
              <hgroup>
                <h3>Stock Alerts</h3>
                <p>Low stock items</p>
              </hgroup>
            </header>
            <section style="flex: 1;">
              <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 8px;
                height: 100%;
                padding: 24px;
                box-sizing: border-box;
                text-align: center;
                color: var(--md-sys-color-on-surface-variant);"
              >
                <material-symbols name="check_circle" size="32"></material-symbols>
                <p>All items are well stocked</p>
              </div>
            </section>
          </article>
        `;
      }

      return html`
        <article class="card outlined" style="flex: 1;">
          <header>
            <material-symbols name="inventory_2"></material-symbols>
            <hgroup>
              <h3>Stock Alerts</h3>
              <p>${state.stockAlerts.length} item${state.stockAlerts.length !== 1 ? 's' : ''} running low</p>
            </hgroup>
          </header>
          <section style="flex: 1;">
            <ul role="list" aria-label="Low stock items">
              ${state.stockAlerts.map((item) => html`
                <li role="listitem">
                  <div class="content">
                    <p class="headline">${item.name}</p>
                    <p class="supporting-text" data-status="${item.isVeryLow ? 'negative' : 'warning'}">${item.stock} remaining</p>
                  </div>
                  <div class="trailing">
                    <material-symbols
                      name="${item.isVeryLow ? 'error' : 'warning'}"
                      style="color: ${item.isVeryLow ? 'var(--md-sys-color-error)' : '#F57C00'}"
                    ></material-symbols>
                  </div>
                </li>
              `)}
            </ul>
          </section>
          <footer>
            <router-link role="button" href="/stock" class="button text">
              View all stock
              <material-symbols name="arrow_forward"></material-symbols>
            </router-link>
          </footer>
        </article>
      `;
    }

    function renderRecentSales() {
      if (state.recentSales.length === 0) {
        return html`
          <article class="card outlined" style="flex: 1;">
            <header>
              <material-symbols name="point_of_sale"></material-symbols>
              <hgroup>
                <h3>Recent Sales</h3>
                <p>Latest transactions</p>
              </hgroup>
            </header>
            <section>
              <div class="empty-state">
                <material-symbols name="storefront" size="32"></material-symbols>
                <p>No sales recorded yet</p>
              </div>
            </section>
            <footer>
              <router-link role="button" href="/pos" class="button tonal">
                <material-symbols name="add"></material-symbols>
                New Sale
              </router-link>
            </footer>
          </article>
        `;
      }

      return html`
        <article class="card outlined" style="flex: 1;">
          <header>
            <material-symbols name="point_of_sale"></material-symbols>
            <hgroup>
              <h3>Recent Sales</h3>
              <p>Latest transactions</p>
            </hgroup>
          </header>
          <section>
            <ul role="list" aria-label="Recent sales">
              ${state.recentSales.map((sale) => html`
                <li role="listitem">
                  <button
                    type="button"
                    role="listitem"
                    class="text list-item"
                    commandfor="sale-details-dialog"
                    command="--open"
                    data-sale-id="${sale.id}"
                    style="width: 100%; text-align: left;"
                  >
                    <div class="leading">
                      <material-symbols name="receipt"></material-symbols>
                    </div>
                    <div class="content">
                      <p class="headline">${sale.name}</p>
                      <p class="supporting-text">${i18n.displayCurrency(sale.amount)}</p>
                    </div>
                    <div class="trailing">
                      <material-symbols name="chevron_right"></material-symbols>
                    </div>
                  </button>
                </li>
              `)}
            </ul>
          </section>
          <footer>
            <router-link role="button" href="/sale" class="button text">
              View all sales
              <material-symbols name="arrow_forward"></material-symbols>
            </router-link>
          </footer>
        </article>
      `;
    }

    useEffect(host, function renderDashboardView() {
      return render(html`
        <main style="display: flex; flex-direction: column; gap: 24px; max-width: 1280px; margin: 0 auto;">
          ${state.isLoading ? renderLoadingState() : nothing}
          ${!state.isLoading && state.error instanceof Error ? renderErrorState(state.error) : nothing}
          ${!state.isLoading && !(state.error instanceof Error) ? html`
            <header class="app-bar">
              <hgroup>
                <h1>Dashboard</h1>
                <p>Welcome to JuruKasa</p>
              </hgroup>
            </header>
            ${renderMetricCards()}
            <div style="display: flex; gap: 24px;">
              ${renderFiscalYearCard()}
              ${renderStockAlerts()}
              ${renderRecentSales()}
            </div>
          ` : nothing}
        </main>
        <sale-details-dialog
          id="sale-details-dialog"
        ></sale-details-dialog>
      `);
    });
  }
}

defineWebComponent('dashboard-view', DashboardViewElement);
