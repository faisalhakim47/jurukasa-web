import { html, nothing } from 'lit-html';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { TimeContextElement } from '#web/contexts/time-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useExposed } from '#web/hooks/use-exposed.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { sleep } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';

/**
 * @typedef {object} SaleRow
 * @property {number} id
 * @property {string | null} customer_name
 * @property {number} sale_time
 * @property {number | null} post_time
 * @property {number} gross_amount
 * @property {number} discount_amount
 * @property {number} fee_amount
 * @property {number} invoice_amount
 */

/**
 * @typedef {object} SaleLine
 * @property {number} line_number
 * @property {number} inventory_id
 * @property {string} inventory_name
 * @property {string | null} unit_of_measurement
 * @property {number} quantity
 * @property {number} price
 * @property {number} cost
 */

/**
 * @typedef {object} SaleDiscount
 * @property {number} line_number
 * @property {number} discount_id
 * @property {string} discount_name
 * @property {number} amount
 */

/**
 * @typedef {object} SalePayment
 * @property {number} line_number
 * @property {number} payment_method_id
 * @property {string} payment_method_name
 * @property {number} amount
 * @property {number} payment_fee
 */

export class SaleDetailsDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const time = useContext(host, TimeContextElement);
    const t = useTranslator(host);

    const dialog = useDialog(host);
    const confirmationDialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    this.open = useExposed(host, function readPopoverState() {
      return dialog.open;
    });

    const state = reactive({
      sale: /** @type {SaleRow | null} */ (null),
      saleLines: /** @type {SaleLine[]} */ ([]),
      saleDiscounts: /** @type {SaleDiscount[]} */ ([]),
      salePayments: /** @type {SalePayment[]} */ ([]),
      isLoading: false,
      error: /** @type {Error | null} */ (null),
      actionState: /** @type {'idle' | 'confirming-post' | 'confirming-discard' | 'processing' | 'success' | 'error'} */ ('idle'),
      actionError: /** @type {Error | null} */ (null),
    });

    async function loadSale() {
      const saleId = dialog.context?.dataset.saleId;
      if (typeof saleId === 'string' && saleId.trim()) {
        try {
          state.isLoading = true;
          state.error = null;

          const saleResult = await database.sql`
            SELECT
              s.id,
              s.customer_name,
              s.sale_time,
              s.post_time,
              COALESCE(s.gross_amount, (SELECT COALESCE(SUM(price), 0) FROM sale_lines WHERE sale_id = s.id)) as gross_amount,
              COALESCE(s.discount_amount, (SELECT COALESCE(SUM(amount), 0) FROM sale_discounts WHERE sale_id = s.id)) as discount_amount,
              COALESCE(s.fee_amount, (SELECT COALESCE(SUM(payment_fee), 0) FROM sale_payments WHERE sale_id = s.id)) as fee_amount,
              COALESCE(s.invoice_amount, COALESCE(s.gross_amount, (SELECT COALESCE(SUM(price), 0) FROM sale_lines WHERE sale_id = s.id)) - COALESCE(s.discount_amount, (SELECT COALESCE(SUM(amount), 0) FROM sale_discounts WHERE sale_id = s.id))) as invoice_amount
            FROM sales s
            WHERE s.id = ${saleId}
          `;

          if (saleResult.rows.length === 0) {
            throw new Error(t('sale', 'saleNotFoundMessage', saleId));
          }

          const saleRow = saleResult.rows[0];
          state.sale = {
            id: Number(saleRow.id),
            customer_name: saleRow.customer_name ? String(saleRow.customer_name) : null,
            sale_time: Number(saleRow.sale_time),
            post_time: saleRow.post_time ? Number(saleRow.post_time) : null,
            gross_amount: Number(saleRow.gross_amount),
            discount_amount: Number(saleRow.discount_amount),
            fee_amount: Number(saleRow.fee_amount),
            invoice_amount: Number(saleRow.invoice_amount),
          };

          const saleLinesResult = await database.sql`
            SELECT
              sl.line_number,
              sl.inventory_id,
              i.name as inventory_name,
              i.unit_of_measurement,
              sl.quantity,
              sl.price,
              sl.cost
            FROM sale_lines sl
            JOIN inventories i ON i.id = sl.inventory_id
            WHERE sl.sale_id = ${saleId}
            ORDER BY sl.line_number ASC
          `;

          state.saleLines = saleLinesResult.rows.map(function rowToSaleLine(row) {
            return /** @type {SaleLine} */ ({
              line_number: Number(row.line_number),
              inventory_id: Number(row.inventory_id),
              inventory_name: String(row.inventory_name),
              unit_of_measurement: row.unit_of_measurement ? String(row.unit_of_measurement) : null,
              quantity: Number(row.quantity),
              price: Number(row.price),
              cost: Number(row.cost),
            });
          });

          const saleDiscountsResult = await database.sql`
            SELECT
              sd.line_number,
              sd.discount_id,
              d.name as discount_name,
              sd.amount
            FROM sale_discounts sd
            JOIN discounts d ON d.id = sd.discount_id
            WHERE sd.sale_id = ${saleId}
            ORDER BY sd.line_number ASC
          `;

          state.saleDiscounts = saleDiscountsResult.rows.map(function rowToSaleDiscount(row) {
            return /** @type {SaleDiscount} */ ({
              line_number: Number(row.line_number),
              discount_id: Number(row.discount_id),
              discount_name: String(row.discount_name),
              amount: Number(row.amount),
            });
          });

          const salePaymentsResult = await database.sql`
            SELECT
              sp.line_number,
              sp.payment_method_id,
              pm.name as payment_method_name,
              sp.amount,
              sp.payment_fee
            FROM sale_payments sp
            JOIN payment_methods pm ON pm.id = sp.payment_method_id
            WHERE sp.sale_id = ${saleId}
            ORDER BY sp.line_number ASC
          `;

          state.salePayments = salePaymentsResult.rows.map(function rowToSalePayment(row) {
            return /** @type {SalePayment} */ ({
              line_number: Number(row.line_number),
              payment_method_id: Number(row.payment_method_id),
              payment_method_name: String(row.payment_method_name),
              amount: Number(row.amount),
              payment_fee: Number(row.payment_fee),
            });
          });
        }
        catch (error) {
          console.error('Failed to load sale details:', error);
          state.error = error instanceof Error ? error : new Error(String(error));
        }
        finally {
          state.isLoading = false;
        }
      }
      else {
        state.sale = null;
        state.saleLines = [];
        state.saleDiscounts = [];
        state.salePayments = [];
        state.error = null;
      }
    }

    useEffect(host, loadSale);

    function handlePostClick() {
      state.actionState = 'confirming-post';
    }

    function handleDiscardClick() {
      state.actionState = 'confirming-discard';
    }

    function handleCancelAction() {
      state.actionState = 'idle';
      state.actionError = null;
    }

    async function handleConfirmPost() {
      const tx = await database.transaction('write');
      try {
        state.actionState = 'processing';
        state.actionError = null;

        const postTime = time.currentDate().getTime();

        await tx.sql`
          UPDATE sales
          SET post_time = ${postTime}
          WHERE id = ${state.sale.id}
        `;

        await tx.commit();
        state.actionState = 'success';
        await sleep(1000);

        host.dispatchEvent(new CustomEvent('sale-posted', {
          detail: { id: state.sale.id },
          bubbles: true,
          composed: true,
        }));

        await loadSale();
        state.actionState = 'idle';
      }
      catch (error) {
        await tx.rollback();
        state.actionState = 'error';
        state.actionError = error instanceof Error ? error : new Error(String(error));
      }
    }

    async function handleConfirmDiscard() {
      const tx = await database.transaction('write');
      try {
        state.actionState = 'processing';
        state.actionError = null;

        await tx.sql`
          DELETE FROM sale_payments
          WHERE sale_id = ${state.sale.id}
        `;

        await tx.sql`
          DELETE FROM sale_discounts
          WHERE sale_id = ${state.sale.id}
        `;

        await tx.sql`
          DELETE FROM sale_lines
          WHERE sale_id = ${state.sale.id}
        `;

        await tx.sql`
          DELETE FROM sales
          WHERE id = ${state.sale.id}
        `;

        await tx.commit();
        state.actionState = 'success';
        await sleep(1000);

        host.dispatchEvent(new CustomEvent('sale-discarded', {
          detail: { id: state.sale.id },
          bubbles: true,
          composed: true,
        }));

        dialog.open = false;
        state.actionState = 'idle';
      }
      catch (error) {
        await tx.rollback();
        state.actionState = 'error';
        state.actionError = error instanceof Error ? error : new Error(String(error));
      }
    }

    function handleDismissError() {
      state.actionState = 'idle';
      state.actionError = null;
    }

    useEffect(host, function syncConfirmationDialogState() {
      const shouldBeOpen = ['confirming-post', 'confirming-discard', 'processing', 'error'].includes(state.actionState);
      confirmationDialog.open = shouldBeOpen;
    });

    function renderErrorNotice() {
      return html`
        <div role="alert">
          <material-symbols name="error" size="48"></material-symbols>
          <h3>${t('sale', 'unableToLoadSaleDetailsTitle')}</h3>
          <p>${state.error.message}</p>
        </div>
      `;
    }

    function renderLoadingIndicator() {
      return html`
        <div role="status" aria-label="${t('sale', 'loadingSaleDetailsAriaLabel')}">
          <div role="progressbar" class="linear indeterminate">
            <div class="track">
              <div class="indicator"></div>
            </div>
          </div>
          <p>${t('sale', 'loadingSaleDetailsMessage')}</p>
        </div>
      `;
    }

    function renderStatusBadge() {
      const isPosted = state.sale.post_time !== null;

      if (isPosted) {
        return html`<span style="
          display: inline-flex;
          padding: 0px 8px;
          border-radius: var(--md-sys-shape-corner-small);
          background-color: #E8F5E9;
          color: #1B5E20;
          font-size: 0.8em;
        ">${t('sale', 'statusPosted')}</span>`;
      }

      return html`<span style="
        display: inline-flex;
        padding: 0px 8px;
        border-radius: var(--md-sys-shape-corner-small);
        background-color: #FFF3E0;
        color: #E65100;
        font-size: 0.8em;
      ">${t('sale', 'statusDraft')}</span>`;
    }

    function renderDialogContent() {
      const isPosted = state.sale.post_time !== null;

      return html`
        <section>
          <dl style="display: grid; grid-template-columns: max-content 1fr; gap: 8px 24px; margin: 0;">
            <dt style="color: var(--md-sys-color-on-surface-variant);">${t('sale', 'saleDateLabel')}</dt>
            <dd style="margin: 0; color: var(--md-sys-color-on-surface);">${i18n.date.format(state.sale.sale_time)}</dd>

            <dt style="color: var(--md-sys-color-on-surface-variant);">${t('sale', 'statusLabel')}</dt>
            <dd style="margin: 0; color: var(--md-sys-color-on-surface);">${renderStatusBadge()}</dd>

            ${state.sale.customer_name ? html`
              <dt style="color: var(--md-sys-color-on-surface-variant);">${t('sale', 'customerLabel')}</dt>
              <dd style="margin: 0; color: var(--md-sys-color-on-surface);">
                <span style="font-weight: 500;">${state.sale.customer_name}</span>
              </dd>
            ` : nothing}

            ${isPosted ? html`
              <dt style="color: var(--md-sys-color-on-surface-variant);">${t('sale', 'postedDateLabel')}</dt>
              <dd style="margin: 0; color: var(--md-sys-color-on-surface);">${i18n.date.format(state.sale.post_time)}</dd>
            ` : nothing}
          </dl>
        </section>

        <!-- Sale Lines Table -->
        <div class="container" style="height: min(max(150px, 25vh), 300px); margin-top: 16px;">
          <table role="table" aria-label="${t('sale', 'saleLinesTableAriaLabel')}" style="--md-sys-density: -3;">
            <thead>
              <tr>
                <th scope="col">${t('sale', 'tableHeaderItem')}</th>
                <th scope="col" class="numeric">${t('sale', 'tableHeaderQuantity')}</th>
                <th scope="col" class="numeric">${t('sale', 'tableHeaderPrice')}</th>
              </tr>
            </thead>
            <tbody>
              ${state.saleLines.map((line) => html`
                <tr>
                  <td>
                    <div style="display: flex; flex-direction: column;">
                      <span style="font-weight: 500;">${line.inventory_name}</span>
                      ${line.unit_of_measurement ? html`
                        <span style="font-size: 0.8em; color: var(--md-sys-color-on-surface-variant);">${t('sale', 'itemPerUnit', line.unit_of_measurement)}</span>
                      ` : nothing}
                    </div>
                  </td>
                  <td class="numeric">${line.quantity}</td>
                  <td class="numeric">${i18n.displayCurrency(line.price)}</td>
                </tr>
              `)}
            </tbody>
            <tfoot>
              <tr style="font-weight: 500;">
                <td colspan="2">${t('sale', 'subtotalLabel')}</td>
                <td class="numeric">${i18n.displayCurrency(state.sale.gross_amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Discounts Section -->
        ${state.saleDiscounts.length > 0 ? html`
          <div style="margin-top: 16px;">
            <h4 class="title-small" style="margin: 0 0 8px 0;">${t('sale', 'discountsSectionTitle')}</h4>
            <table role="table" aria-label="${t('sale', 'saleDiscountsAriaLabel')}" style="--md-sys-density: -3;">
              <tbody>
                ${state.saleDiscounts.map((discount) => html`
                  <tr>
                    <td>${discount.discount_name}</td>
                    <td class="numeric" style="color: var(--md-sys-color-tertiary);">-${i18n.displayCurrency(discount.amount)}</td>
                  </tr>
                `)}
              </tbody>
              <tfoot>
                <tr style="font-weight: 500;">
                  <td>${t('sale', 'totalDiscountsLabel')}</td>
                  <td class="numeric" style="color: var(--md-sys-color-tertiary);">-${i18n.displayCurrency(state.sale.discount_amount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ` : nothing}

        <!-- Payments Section -->
        ${state.salePayments.length > 0 ? html`
          <div style="margin-top: 16px;">
            <h4 class="title-small" style="margin: 0 0 8px 0;">${t('sale', 'paymentsSectionTitle')}</h4>
            <table role="table" aria-label="${t('sale', 'salePaymentsAriaLabel')}" style="--md-sys-density: -3;">
              <thead>
                <tr>
                  <th scope="col">${t('sale', 'tableHeaderMethod')}</th>
                  <th scope="col" class="numeric">${t('sale', 'tableHeaderAmount')}</th>
                  <th scope="col" class="numeric">${t('sale', 'tableHeaderFee')}</th>
                </tr>
              </thead>
              <tbody>
                ${state.salePayments.map((payment) => html`
                  <tr>
                    <td>${payment.payment_method_name}</td>
                    <td class="numeric">${i18n.displayCurrency(payment.amount)}</td>
                    <td class="numeric" style="color: var(--md-sys-color-error);">
                      ${payment.payment_fee > 0 ? `-${i18n.displayCurrency(payment.payment_fee)}` : '—'}
                    </td>
                  </tr>
                `)}
              </tbody>
              ${state.sale.fee_amount > 0 ? html`
                <tfoot>
                  <tr style="font-weight: 500;">
                    <td>${t('sale', 'totalFeesLabel')}</td>
                    <td></td>
                    <td class="numeric" style="color: var(--md-sys-color-error);">-${i18n.displayCurrency(state.sale.fee_amount)}</td>
                  </tr>
                </tfoot>
              ` : nothing}
            </table>
          </div>
        ` : nothing}

        <!-- Total Summary -->
        <div style="
          margin-top: 16px;
          padding: 12px;
          background-color: var(--md-sys-color-surface-container);
          border-radius: var(--md-sys-shape-corner-medium);
        ">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="title-medium" style="font-weight: 700;">${t('sale', 'invoiceTotalLabel')}</span>
            <span class="title-medium" style="font-weight: 700; color: var(--md-sys-color-primary);">
              ${i18n.displayCurrency(state.sale.invoice_amount)}
            </span>
          </div>
        </div>

        ${isPosted ? html`
          <div style="margin-top: 16px; padding: 12px; background-color: var(--md-sys-color-surface-container); border-radius: var(--md-sys-shape-corner-medium);">
            <p class="body-small" style="margin: 0; color: var(--md-sys-color-on-surface-variant);">
              <material-symbols name="info" size="16" style="vertical-align: middle;"></material-symbols>
              ${t('sale', 'postedSaleInfoMessage')}
            </p>
          </div>
        ` : nothing}
      `;
    }

    function renderActionButtons() {
      const isPosted = state.sale.post_time !== null;

      if (!isPosted) {
        // Draft actions: Post and Discard
        return html`
          <button
            role="button"
            type="button"
            class="tonal"
            @click=${handlePostClick}
            aria-label="${t('sale', 'postButtonAriaLabel')}"
          >
            <material-symbols name="check_circle"></material-symbols>
            ${t('sale', 'postButtonLabel')}
          </button>
          <button
            role="button"
            type="button"
            class="text"
            style="color: var(--md-sys-color-error);"
            @click=${handleDiscardClick}
            aria-label="${t('sale', 'discardButtonAriaLabel')}"
          >
            <material-symbols name="delete"></material-symbols>
            ${t('sale', 'discardButtonLabel')}
          </button>
        `;
      }

      // Posted sale - no actions available
      return nothing;
    }

    function renderConfirmationDialogContent() {
      if (state.actionState === 'confirming-post') {
        return html`
          <material-symbols name="check_circle" style="color: var(--md-sys-color-primary);"></material-symbols>
          <header>
            <h3>${t('sale', 'postSaleConfirmTitle')}</h3>
          </header>
          <div class="content">
            <p>${t('sale', 'postSaleConfirmMessage', state.sale?.id)}</p>
            <p style="color: var(--md-sys-color-on-surface-variant); font-size: 0.9em;">
              ${t('sale', 'postSaleWarningMessage')}
            </p>
          </div>
          <menu>
            <button role="button" type="button" class="text" @click=${handleCancelAction}>${t('sale', 'cancelActionButtonLabel')}</button>
            <button role="button" type="button" class="tonal" @click=${handleConfirmPost}>${t('sale', 'postSaleButtonLabel')}</button>
          </menu>
        `;
      }

      if (state.actionState === 'confirming-discard') {
        return html`
          <material-symbols name="delete" style="color: var(--md-sys-color-error);"></material-symbols>
          <header>
            <h3>${t('sale', 'discardSaleConfirmTitle')}</h3>
          </header>
          <div class="content">
            <p>${t('sale', 'discardSaleConfirmMessage', state.sale?.id)}</p>
            <p style="color: var(--md-sys-color-error); font-size: 0.9em;">
              ${t('sale', 'discardSaleWarningMessage')}
            </p>
          </div>
          <menu>
            <button role="button" type="button" class="text" @click=${handleCancelAction}>${t('sale', 'cancelActionButtonLabel')}</button>
            <button role="button" type="button" class="tonal" style="background-color: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container);" @click=${handleConfirmDiscard}>${t('sale', 'discardSaleButtonLabel')}</button>
          </menu>
        `;
      }

      if (state.actionState === 'processing') {
        return html`
          <div role="status" aria-label="Processing">
            <div role="progressbar" class="linear indeterminate">
              <div class="track">
                <div class="indicator"></div>
              </div>
            </div>
          </div>
          <header>
            <h3>${t('sale', 'processingTitle')}</h3>
          </header>
          <div class="content">
            <p>${t('sale', 'processingMessage')}</p>
          </div>
        `;
      }

      if (state.actionState === 'error') {
        return html`
          <material-symbols name="error" style="color: var(--md-sys-color-error);"></material-symbols>
          <header>
            <h3>${t('sale', 'errorTitle')}</h3>
          </header>
          <div class="content">
            <p>${state.actionError?.message}</p>
          </div>
          <menu>
            <button role="button" type="button" class="text" @click=${handleDismissError}>${t('sale', 'dismissButtonLabel')}</button>
          </menu>
        `;
      }

      return nothing;
    }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="sale-details-dialog"
          aria-labelledby="sale-details-dialog-title"
          style="--md-sys-density: -2; width: min(max(96%, 700px), 90vw);"
        >
          <div class="container">
            <header>
              <h2 id="sale-details-dialog-title">${state.sale ? t('sale', 'detailsDialogTitle', state.sale.id) : t('sale', 'detailsDialogTitleDefault')}</h2>
            </header>
            <div class="content">
              ${state.isLoading ? renderLoadingIndicator() : nothing}
              ${state.error instanceof Error ? renderErrorNotice() : nothing}
              ${!state.isLoading && state.sale ? renderDialogContent() : nothing}
            </div>
            <menu>
              ${!state.isLoading && state.sale ? renderActionButtons() : nothing}
              <button
                role="button"
                type="button"
                class="text"
                commandfor="sale-details-dialog"
                command="close"
              >${t('sale', 'closeButtonLabel')}</button>
            </menu>
          </div>
        </dialog>

        <dialog ${confirmationDialog.element} role="alertdialog" aria-labelledby="confirmation-dialog-title">
          <div class="container">
            ${renderConfirmationDialogContent()}
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('sale-details-dialog', SaleDetailsDialogElement);
