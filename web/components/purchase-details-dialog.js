import { html, nothing } from 'lit-html';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { TimeContextElement } from '#web/contexts/time-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useAttribute } from '#web/hooks/use-attribute.js';
import { useContext } from '#web/hooks/use-context.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { useExposed } from '#web/hooks/use-exposed.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { sleep } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';

/**
 * @typedef {object} PurchaseRow
 * @property {number} id
 * @property {number} supplier_id
 * @property {string} supplier_name
 * @property {string | null} supplier_phone
 * @property {number} purchase_time
 * @property {number | null} post_time
 * @property {number} total_amount
 */

/**
 * @typedef {object} PurchaseLine
 * @property {number} line_number
 * @property {number} inventory_id
 * @property {string} inventory_name
 * @property {string | null} unit_of_measurement
 * @property {number} supplier_quantity
 * @property {number} quantity
 * @property {number} price
 */

export class PurchaseDetailsDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const time = useContext(host, TimeContextElement);
    const t = useTranslator(host);

    const dialog = useDialog(host);
    const confirmationDialogElement = useElement(host, HTMLDialogElement);
    const confirmationDialogOpen = reactive({ value: false });
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    this.open = useExposed(host, function readPopoverState() {
      return dialog.open;
    });

    const state = reactive({
      purchase: /** @type {PurchaseRow | null} */ (null),
      purchaseLines: /** @type {PurchaseLine[]} */ ([]),
      isLoading: false,
      error: /** @type {Error | null} */ (null),
      actionState: /** @type {'idle' | 'confirming-post' | 'confirming-discard' | 'processing' | 'success' | 'error'} */ ('idle'),
      actionError: /** @type {Error | null} */ (null),
    });

    async function loadPurchase() {
      const purchaseId = dialog.context?.dataset.purchaseId;
      if (typeof purchaseId === 'string' && purchaseId.trim()) {
        try {
          state.isLoading = true;
          state.error = null;

          const purchaseResult = await database.sql`
            SELECT
              p.id,
              p.supplier_id,
              s.name as supplier_name,
              s.phone_number as supplier_phone,
              p.purchase_time,
              p.post_time,
              COALESCE(SUM(pl.price), 0) as total_amount
            FROM purchases p
            JOIN suppliers s ON s.id = p.supplier_id
            LEFT JOIN purchase_lines pl ON pl.purchase_id = p.id
            WHERE p.id = ${purchaseId}
            GROUP BY p.id
          `;

          if (purchaseResult.rows.length === 0) {
            throw new Error(t('purchase', 'purchaseNotFoundMessage', purchaseId));
          }

          const purchaseRow = purchaseResult.rows[0];
          state.purchase = {
            id: Number(purchaseRow.id),
            supplier_id: Number(purchaseRow.supplier_id),
            supplier_name: String(purchaseRow.supplier_name),
            supplier_phone: purchaseRow.supplier_phone ? String(purchaseRow.supplier_phone) : null,
            purchase_time: Number(purchaseRow.purchase_time),
            post_time: purchaseRow.post_time ? Number(purchaseRow.post_time) : null,
            total_amount: Number(purchaseRow.total_amount),
          };

          const purchaseLinesResult = await database.sql`
            SELECT
              pl.line_number,
              pl.inventory_id,
              i.name as inventory_name,
              i.unit_of_measurement,
              pl.supplier_quantity,
              pl.quantity,
              pl.price
            FROM purchase_lines pl
            JOIN inventories i ON i.id = pl.inventory_id
            WHERE pl.purchase_id = ${purchaseId}
            ORDER BY pl.line_number ASC
          `;

          state.purchaseLines = purchaseLinesResult.rows.map(function rowToPurchaseLine(row) {
            return /** @type {PurchaseLine} */ ({
              line_number: Number(row.line_number),
              inventory_id: Number(row.inventory_id),
              inventory_name: String(row.inventory_name),
              unit_of_measurement: row.unit_of_measurement ? String(row.unit_of_measurement) : null,
              supplier_quantity: Number(row.supplier_quantity),
              quantity: Number(row.quantity),
              price: Number(row.price),
            });
          });
        }
        catch (error) {
          console.error('Failed to load purchase details:', error);
          state.error = error instanceof Error ? error : new Error(String(error));
        }
        finally {
          state.isLoading = false;
        }
      }
      else {
        state.purchase = null;
        state.purchaseLines = [];
        state.error = null;
      }
    }

    useEffect(host, loadPurchase);

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
          UPDATE purchases
          SET post_time = ${postTime}
          WHERE id = ${state.purchase.id}
        `;

        await tx.commit();
        state.actionState = 'success';
        await sleep(1000);

        host.dispatchEvent(new CustomEvent('purchase-posted', {
          detail: { id: state.purchase.id },
          bubbles: true,
          composed: true,
        }));

        await loadPurchase();
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
          DELETE FROM purchase_lines
          WHERE purchase_id = ${state.purchase.id}
        `;

        await tx.sql`
          DELETE FROM purchases
          WHERE id = ${state.purchase.id}
        `;

        await tx.commit();
        state.actionState = 'success';
        await sleep(1000);

        host.dispatchEvent(new CustomEvent('purchase-discarded', {
          detail: { id: state.purchase.id },
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
      confirmationDialogOpen.value = shouldBeOpen;
    });

    useEffect(host, function syncConfirmationDialogElement() {
      const dialogElement = confirmationDialogElement.value;
      if (dialogElement instanceof HTMLDialogElement) {
        if (confirmationDialogOpen.value) dialogElement.showModal();
        else dialogElement.close();
      }
    });

    function renderErrorNotice() {
      return html`
        <div role="alert">
          <material-symbols name="error" size="48"></material-symbols>
          <h3>${t('purchase', 'unableToLoadPurchaseDetailsTitle')}</h3>
          <p>${state.error.message}</p>
        </div>
      `;
    }

    function renderLoadingIndicator() {
      return html`
        <div role="status" aria-label=${t('purchase', 'loadingPurchaseDetailsAriaLabel')}>
          <div role="progressbar" class="linear indeterminate">
            <div class="track">
              <div class="indicator"></div>
            </div>
          </div>
          <p>${t('purchase', 'loadingPurchaseDetailsMessage')}</p>
        </div>
      `;
    }

    function renderStatusBadge() {
      const isPosted = state.purchase.post_time !== null;

      if (isPosted) {
        return html`<span style="
          display: inline-flex;
          padding: 0px 8px;
          border-radius: var(--md-sys-shape-corner-small);
          background-color: #E8F5E9;
          color: #1B5E20;
          font-size: 0.8em;
        ">${t('purchase', 'statusPosted')}</span>`;
      }

      return html`<span style="
        display: inline-flex;
        padding: 0px 8px;
        border-radius: var(--md-sys-shape-corner-small);
        background-color: #FFF3E0;
        color: #E65100;
        font-size: 0.8em;
      ">${t('purchase', 'statusDraft')}</span>`;
    }

    function renderDialogContent() {
      const isPosted = state.purchase.post_time !== null;

      return html`
        <section>
          <dl style="display: grid; grid-template-columns: max-content 1fr; gap: 8px 24px; margin: 0;">
            <dt style="color: var(--md-sys-color-on-surface-variant);">${t('purchase', 'purchaseDetailsDateLabel')}</dt>
            <dd style="margin: 0; color: var(--md-sys-color-on-surface);">${i18n.date.format(state.purchase.purchase_time)}</dd>

            <dt style="color: var(--md-sys-color-on-surface-variant);">${t('purchase', 'statusLabel')}</dt>
            <dd style="margin: 0; color: var(--md-sys-color-on-surface);">${renderStatusBadge()}</dd>

            <dt style="color: var(--md-sys-color-on-surface-variant);">${t('purchase', 'supplierLabel')}</dt>
            <dd style="margin: 0; color: var(--md-sys-color-on-surface);">
              <span style="font-weight: 500;">${state.purchase.supplier_name}</span>
              ${state.purchase.supplier_phone ? html`
                <span style="color: var(--md-sys-color-on-surface-variant);"> (${state.purchase.supplier_phone})</span>
              ` : nothing}
            </dd>

            ${isPosted ? html`
              <dt style="color: var(--md-sys-color-on-surface-variant);">${t('purchase', 'postedDateLabel')}</dt>
              <dd style="margin: 0; color: var(--md-sys-color-on-surface);">${i18n.date.format(state.purchase.post_time)}</dd>
            ` : nothing}
          </dl>
        </section>
        <div class="container" style="height: min(max(200px, 40vh), 400px); margin-top: 16px;">
          <table role="table" aria-label=${t('purchase', 'purchaseLinesTableAriaLabel')} style="--md-sys-density: -3;">
            <thead>
              <tr>
                <th scope="col">${t('purchase', 'tableHeaderItem')}</th>
                <th scope="col" class="numeric">${t('purchase', 'tableHeaderSupplierQty')}</th>
                <th scope="col" class="numeric">${t('purchase', 'tableHeaderInternalQty')}</th>
                <th scope="col" class="numeric">${t('purchase', 'tableHeaderLineTotal')}</th>
              </tr>
            </thead>
            <tbody>
              ${state.purchaseLines.map((line) => html`
                <tr>
                  <td>
                    <div style="display: flex; flex-direction: column;">
                      <span style="font-weight: 500;">${line.inventory_name}</span>
                      ${line.unit_of_measurement ? html`
                        <span style="font-size: 0.8em; color: var(--md-sys-color-on-surface-variant);">${t('purchase', 'tableHeaderItemPerUnit', line.unit_of_measurement)}</span>
                      ` : nothing}
                    </div>
                  </td>
                  <td class="numeric">${line.supplier_quantity}</td>
                  <td class="numeric">${line.quantity}</td>
                  <td class="numeric">${i18n.displayCurrency(line.price)}</td>
                </tr>
              `)}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold; background-color: var(--md-sys-color-surface-container-low);">
                <td colspan="3">${t('purchase', 'totalLabel')}</td>
                <td class="numeric">${i18n.displayCurrency(state.purchase.total_amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        ${isPosted ? html`
          <div style="margin-top: 16px; padding: 12px; background-color: var(--md-sys-color-surface-container); border-radius: var(--md-sys-shape-corner-medium);">
            <p class="body-small" style="margin: 0; color: var(--md-sys-color-on-surface-variant);">
              <material-symbols name="info" size="16" style="vertical-align: middle;"></material-symbols>
              ${t('purchase', 'postedPurchaseInfoMessage')}
            </p>
          </div>
        ` : nothing}
      `;
    }

    function renderActionButtons() {
      const isPosted = state.purchase.post_time !== null;

      if (!isPosted) {
        // Draft actions: Post and Discard
        return html`
          <button
            role="button"
            type="button"
            class="tonal"
            @click=${handlePostClick}
            aria-label=${t('purchase', 'postButtonAriaLabel')}
          >
            <material-symbols name="check_circle"></material-symbols>
            ${t('purchase', 'postButtonLabel')}
          </button>
          <button
            role="button"
            type="button"
            class="text"
            style="color: var(--md-sys-color-error);"
            @click=${handleDiscardClick}
            aria-label=${t('purchase', 'discardButtonAriaLabel')}
          >
            <material-symbols name="delete"></material-symbols>
            ${t('purchase', 'discardButtonLabel')}
          </button>
        `;
      }

      // Posted purchase - no actions available
      return nothing;
    }

    function renderConfirmationDialogContent() {
      if (state.actionState === 'confirming-post') {
        return html`
          <material-symbols name="check_circle" style="color: var(--md-sys-color-primary);"></material-symbols>
          <header>
            <h3>${t('purchase', 'postPurchaseConfirmTitle')}</h3>
          </header>
          <div class="content">
            <p>${t('purchase', 'postPurchaseConfirmMessage', state.purchase?.id)}</p>
            <p style="color: var(--md-sys-color-on-surface-variant); font-size: 0.9em;">
              ${t('purchase', 'postPurchaseWarningMessage')}
            </p>
          </div>
          <menu>
            <button role="button" type="button" class="text" @click=${handleCancelAction}>${t('purchase', 'cancelActionButtonLabel')}</button>
            <button role="button" type="button" class="tonal" @click=${handleConfirmPost}>${t('purchase', 'postPurchaseButtonLabel')}</button>
          </menu>
        `;
      }

      if (state.actionState === 'confirming-discard') {
        return html`
          <material-symbols name="delete" style="color: var(--md-sys-color-error);"></material-symbols>
          <header>
            <h3>${t('purchase', 'discardPurchaseConfirmTitle')}</h3>
          </header>
          <div class="content">
            <p>${t('purchase', 'discardPurchaseConfirmMessage', state.purchase?.id)}</p>
            <p style="color: var(--md-sys-color-error); font-size: 0.9em;">
              ${t('purchase', 'discardPurchaseWarningMessage')}
            </p>
          </div>
          <menu>
            <button role="button" type="button" class="text" @click=${handleCancelAction}>${t('purchase', 'cancelActionButtonLabel')}</button>
            <button role="button" type="button" class="tonal" style="background-color: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container);" @click=${handleConfirmDiscard}>${t('purchase', 'discardPurchaseButtonLabel')}</button>
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
            <h3>${t('purchase', 'processingMessage')}</h3>
          </header>
          <div class="content">
            <p>${t('purchase', 'processingWaitMessage')}</p>
          </div>
        `;
      }

      if (state.actionState === 'error') {
        return html`
          <material-symbols name="error" style="color: var(--md-sys-color-error);"></material-symbols>
          <header>
            <h3>${t('purchase', 'errorDialogTitle')}</h3>
          </header>
          <div class="content">
            <p>${state.actionError?.message}</p>
          </div>
          <menu>
            <button role="button" type="button" class="text" @click=${handleDismissError}>${t('purchase', 'dismissButtonLabel')}</button>
          </menu>
        `;
      }

      return nothing;
    }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="purchase-details-dialog"
          aria-labelledby="purchase-details-dialog-title"
          style="--md-sys-density: -2; width: min(max(96%, 700px), 90vw);"
        >
          <div class="container">
            <header>
              <h2 id="purchase-details-dialog-title">${state.purchase ? t('purchase', 'detailsDialogTitle', state.purchase.id) : t('purchase', 'detailsDialogTitleDefault')}</h2>
            </header>
            <div class="content">
              ${state.isLoading ? renderLoadingIndicator() : nothing}
              ${state.error instanceof Error ? renderErrorNotice() : nothing}
              ${!state.isLoading && state.purchase ? renderDialogContent() : nothing}
            </div>
            <menu>
              ${!state.isLoading && state.purchase ? renderActionButtons() : nothing}
              <button
                role="button"
                type="button"
                class="text"
                commandfor="purchase-details-dialog"
                command="close"
              >${t('purchase', 'closeButtonLabel')}</button>
            </menu>
          </div>
        </dialog>

        <dialog ${confirmationDialogElement} role="alertdialog" aria-labelledby="confirmation-dialog-title">
          <div class="container">
            ${renderConfirmationDialogContent()}
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('purchase-details-dialog', PurchaseDetailsDialogElement);
