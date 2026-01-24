import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { TimeContextElement } from '#web/contexts/time-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';
import { useElement } from '#web/hooks/use-element.js';

/**
 * @typedef {object} FixedAssetDetail
 * @property {number} id
 * @property {string} name
 * @property {string | null} description
 * @property {number} acquisition_time
 * @property {number} acquisition_cost
 * @property {number} useful_life_years
 * @property {number} salvage_value
 * @property {number} accumulated_depreciation
 * @property {number} is_fully_depreciated
 * @property {number} asset_account_code
 * @property {string} asset_account_name
 * @property {number} accumulated_depreciation_account_code
 * @property {string} accumulated_depreciation_account_name
 * @property {number} depreciation_expense_account_code
 * @property {string} depreciation_expense_account_name
 * @property {number} payment_account_code
 * @property {string} payment_account_name
 * @property {number} create_time
 * @property {number} update_time
 */

/**
 * @typedef {object} DepreciationHistoryRow
 * @property {number} ref
 * @property {number} entry_time
 * @property {string | null} note
 * @property {number} amount
 */

/**
 * Fixed Asset Details Dialog Component
 * 
 * @fires fixed-asset-updated - Fired when fixed asset is updated
 * @fires fixed-asset-deleted - Fired when fixed asset is deleted
 */
export class FixedAssetDetailsDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const time = useContext(host, TimeContextElement);

    const t = useTranslator(host);
    const errorAlertDialog = useElement(host, HTMLDialogElement);
    const confirmDeleteDialog = useElement(host, HTMLDialogElement);
    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      asset: /** @type {FixedAssetDetail | null} */ (null),
      depreciationHistory: /** @type {DepreciationHistoryRow[]} */ ([]),
      isLoading: false,
      formError: /** @type {Error | null} */ (null),
      isEditing: false,
      formSaving: false,
      isDeleting: false,
    });

    async function loadAssetDetails() {
      try {
        const assetId = parseInt(dialog.context?.dataset.assetId, 10);
        if (isNaN(assetId)) return;

        state.isLoading = true;
        state.formError = null;

        const result = await database.sql`
          SELECT
            fa.id,
            fa.name,
            fa.description,
            fa.acquisition_time,
            fa.acquisition_cost,
            fa.useful_life_years,
            fa.salvage_value,
            fa.accumulated_depreciation,
            fa.is_fully_depreciated,
            fa.asset_account_code,
            a1.name as asset_account_name,
            fa.accumulated_depreciation_account_code,
            a2.name as accumulated_depreciation_account_name,
            fa.depreciation_expense_account_code,
            a3.name as depreciation_expense_account_name,
            fa.payment_account_code,
            a4.name as payment_account_name,
            fa.create_time,
            fa.update_time
          FROM fixed_assets fa
          JOIN accounts a1 ON a1.account_code = fa.asset_account_code
          JOIN accounts a2 ON a2.account_code = fa.accumulated_depreciation_account_code
          JOIN accounts a3 ON a3.account_code = fa.depreciation_expense_account_code
          JOIN accounts a4 ON a4.account_code = fa.payment_account_code
          WHERE fa.id = ${assetId}
        `;

        if (result.rows.length === 0) {
          state.asset = null;
          state.depreciationHistory = [];
        }
        else {
          const row = result.rows[0];
          state.asset = {
            id: Number(row.id),
            name: String(row.name),
            description: row.description ? String(row.description) : null,
            acquisition_time: Number(row.acquisition_time),
            acquisition_cost: Number(row.acquisition_cost),
            useful_life_years: Number(row.useful_life_years),
            salvage_value: Number(row.salvage_value),
            accumulated_depreciation: Number(row.accumulated_depreciation),
            is_fully_depreciated: Number(row.is_fully_depreciated),
            asset_account_code: Number(row.asset_account_code),
            asset_account_name: String(row.asset_account_name),
            accumulated_depreciation_account_code: Number(row.accumulated_depreciation_account_code),
            accumulated_depreciation_account_name: String(row.accumulated_depreciation_account_name),
            depreciation_expense_account_code: Number(row.depreciation_expense_account_code),
            depreciation_expense_account_name: String(row.depreciation_expense_account_name),
            payment_account_code: Number(row.payment_account_code),
            payment_account_name: String(row.payment_account_name),
            create_time: Number(row.create_time),
            update_time: Number(row.update_time),
          };

          // Load depreciation history from journal entries
          const historyResult = await database.sql`
            SELECT
              je.ref,
              je.entry_time,
              je.note,
              jel.credit as amount
            FROM journal_entries je
            JOIN journal_entry_lines jel ON jel.journal_entry_ref = je.ref
            WHERE jel.reference = ${'FixedAsset:' + assetId}
              AND jel.account_code = ${state.asset.accumulated_depreciation_account_code}
              AND jel.credit > 0
              AND je.post_time IS NOT NULL
            ORDER BY je.entry_time DESC
          `;

          state.depreciationHistory = historyResult.rows.map(function rowToDepreciation(row) {
            return /** @type {DepreciationHistoryRow} */ ({
              ref: Number(row.ref),
              entry_time: Number(row.entry_time),
              note: row.note ? String(row.note) : null,
              amount: Number(row.amount),
            });
          });
        }

        state.isLoading = false;
      }
      catch (error) {
        state.formError = error instanceof Error ? error : new Error(String(error));
        state.isLoading = false;
      }
    }

    useEffect(host, function loadOnOpen() {
      const assetId = parseInt(dialog.context?.dataset.assetId, 10);
      if (dialog.open && !isNaN(assetId)) loadAssetDetails();
    });

    /** @param {SubmitEvent} event */
    async function handleUpdateSubmit(event) {
      event.preventDefault();
      assertInstanceOf(HTMLFormElement, event.currentTarget);
      const form = event.currentTarget;

      if (!state.asset) return;

      // Can only edit name and description if asset has accumulated depreciation
      const tx = await database.transaction('write');

      try {
        state.formSaving = true;
        state.formError = null;

        const data = new FormData(form);
        const name = /** @type {string} */ (data.get('name'))?.trim();
        const description = /** @type {string} */ (data.get('description'))?.trim() || null;

        // Validate inputs
        if (!name) throw new Error(t('fixedAsset', 'assetNameRequired'));

        const currentTime = time.currentDate().getTime();

        // Update fixed asset (only name and description)
        await tx.sql`
          UPDATE fixed_assets
          SET name = ${name}, description = ${description}, update_time = ${currentTime}
          WHERE id = ${state.asset.id};
        `;

        await tx.commit();

        state.isEditing = false;
        await loadAssetDetails();

        host.dispatchEvent(new CustomEvent('fixed-asset-updated', {
          detail: { assetId: state.asset.id },
          bubbles: true,
          composed: true,
        }));
      }
      catch (error) {
        await tx.rollback();
        state.formError = error instanceof Error ? error : new Error(String(error));
      }
      finally {
        state.formSaving = false;
      }
    }

    function handleDeleteClick() {
      confirmDeleteDialog.value?.showModal();
    }

    function handleCancelDelete() {
      confirmDeleteDialog.value?.close();
    }

    async function handleConfirmDelete() {
      if (!state.asset) return;

      const tx = await database.transaction('write');

      try {
        state.isDeleting = true;
        state.formError = null;

        // Check if asset can be deleted (no accumulated depreciation)
        if (state.asset.accumulated_depreciation > 0) {
          throw new Error(t('fixedAsset', 'cannotDeleteWithDepreciation'));
        }

        // Delete the fixed asset
        await tx.sql`DELETE FROM fixed_assets WHERE id = ${state.asset.id};`;

        // Delete the acquisition journal entry
        // First get the journal entry ref
        const jeResult = await tx.sql`
          SELECT ref FROM journal_entries WHERE source_reference = ${'FixedAsset:' + state.asset.id};
        `;

        for (const row of jeResult.rows) {
          const jeRef = Number(row.ref);
          // Delete journal entry lines first (foreign key constraint)
          await tx.sql`DELETE FROM journal_entry_lines WHERE journal_entry_ref = ${jeRef};`;
          // Then delete the journal entry
          await tx.sql`DELETE FROM journal_entries WHERE ref = ${jeRef};`;
        }

        await tx.commit();

        confirmDeleteDialog.value?.close();

        host.dispatchEvent(new CustomEvent('fixed-asset-deleted', {
          detail: { assetId: state.asset.id },
          bubbles: true,
          composed: true,
        }));

        dialog.open = false;
      }
      catch (error) {
        await tx.rollback();
        state.formError = error instanceof Error ? error : new Error(String(error));
        confirmDeleteDialog.value?.close();
      }
      finally {
        state.isDeleting = false;
      }
    }

    function handleDismissErrorDialog() { state.formError = null; }

    function toggleEditMode() {
      state.isEditing = !state.isEditing;
    }

    useEffect(host, function syncErrorAlertDialogState() {
      if (state.formError instanceof Error) errorAlertDialog.value?.showModal();
      else errorAlertDialog.value?.close();
    });

    function renderLoadingState() {
      return html`
        <div
          role="status"
          aria-label="${t('fixedAsset', 'loadingDetailsLabel')}"
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
          <p>${t('fixedAsset', 'loadingDetailsLabel')}</p>
        </div>
      `;
    }

    function renderNotFoundState() {
      return html`
        <div
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
          <material-symbols name="real_estate_agent" size="48"></material-symbols>
          <h3 class="title-large">${t('fixedAsset', 'assetNotFoundTitle')}</h3>
          <p style="color: var(--md-sys-color-on-surface-variant);">${t('fixedAsset', 'assetNotFoundMessage')}</p>
        </div>
      `;
    }

    function renderViewMode() {
      if (!state.asset) return nothing;
      const asset = state.asset;
      const bookValue = asset.acquisition_cost - asset.accumulated_depreciation;
      const depreciableAmount = asset.acquisition_cost - asset.salvage_value;
      const annualDepreciation = Math.floor(depreciableAmount / asset.useful_life_years);
      const depreciationPercentage = depreciableAmount > 0
        ? Math.round((asset.accumulated_depreciation / depreciableAmount) * 100)
        : 100;

      return html`
        <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0;">
          <!-- Basic Info -->
          <section>
            <h3 class="title-medium" style="margin-bottom: 16px;">${t('fixedAsset', 'basicInfoSectionTitle')}</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('fixedAsset', 'nameLabel')}</p>
                <p class="body-large">${asset.name}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('fixedAsset', 'statusLabel')}</p>
                <p class="body-large">
                  <span
                    class="label-small"
                    style="
                      display: inline-flex;
                      padding: 4px 8px;
                      border-radius: var(--md-sys-shape-corner-small);
                      ${asset.is_fully_depreciated === 1
                        ? 'background-color: var(--md-sys-color-surface-container-highest); color: var(--md-sys-color-on-surface-variant);'
                        : 'background-color: #E8F5E9; color: #1B5E20;'}
                    "
                  >${asset.is_fully_depreciated === 1 ? t('fixedAsset', 'statusFullyDepreciated') : t('fixedAsset', 'statusActive')}</span>
                </p>
              </div>
              ${asset.description ? html`
                <div style="grid-column: span 2;">
                  <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('fixedAsset', 'descriptionInfoLabel')}</p>
                  <p class="body-large">${asset.description}</p>
                </div>
              ` : nothing}
            </div>
          </section>

          <!-- Financial Info -->
          <section>
            <h3 class="title-medium" style="margin-bottom: 16px;">${t('fixedAsset', 'financialInfoSectionTitle')}</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('fixedAsset', 'acquisitionDateInfoLabel')}</p>
                <p class="body-large">${i18n.date.format(new Date(asset.acquisition_time))}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('fixedAsset', 'acquisitionCostInfoLabel')}</p>
                <p class="body-large">${i18n.displayCurrency(asset.acquisition_cost)}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('fixedAsset', 'usefulLifeInfoLabel')}</p>
                <p class="body-large">${t('fixedAsset', 'usefulLifeYearsFormat', asset.useful_life_years)}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('fixedAsset', 'salvageValueInfoLabel')}</p>
                <p class="body-large">${i18n.displayCurrency(asset.salvage_value)}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('fixedAsset', 'annualDepreciationLabel')}</p>
                <p class="body-large">${i18n.displayCurrency(annualDepreciation)}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('fixedAsset', 'depreciableAmountLabel')}</p>
                <p class="body-large">${i18n.displayCurrency(depreciableAmount)}</p>
              </div>
            </div>
          </section>

          <!-- Depreciation Progress -->
          <section>
            <h3 class="title-medium" style="margin-bottom: 16px;">${t('fixedAsset', 'depreciationProgressSectionTitle')}</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px;">
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('fixedAsset', 'accumulatedDepreciationLabel')}</p>
                <p class="body-large">${i18n.displayCurrency(asset.accumulated_depreciation)}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('fixedAsset', 'bookValueLabel')}</p>
                <p class="body-large" style="font-weight: 500;">${i18n.displayCurrency(bookValue)}</p>
              </div>
            </div>
            <div style="margin-top: 8px;">
              <div
                style="
                  display: flex;
                  align-items: center;
                  gap: 12px;
                "
              >
                <div
                  style="
                    flex: 1;
                    height: 12px;
                    background-color: var(--md-sys-color-surface-container-highest);
                    border-radius: 6px;
                    overflow: hidden;
                  "
                >
                  <div
                    style="
                      width: ${depreciationPercentage}%;
                      height: 100%;
                      background-color: ${asset.is_fully_depreciated === 1
                        ? 'var(--md-sys-color-outline)'
                        : 'var(--md-sys-color-primary)'};
                      transition: width 0.3s ease;
                    "
                  ></div>
                </div>
                <span class="body-medium" style="min-width: 50px; text-align: right;">${depreciationPercentage}%</span>
              </div>
            </div>
          </section>

          <!-- Account Assignment -->
          <section>
            <h3 class="title-medium" style="margin-bottom: 16px;">${t('fixedAsset', 'accountAssignmentSectionTitle')}</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('fixedAsset', 'assetAccountLabel')}</p>
                <p class="body-large">${asset.asset_account_code} - ${asset.asset_account_name}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('fixedAsset', 'accumulatedDepreciationAccountInfoLabel')}</p>
                <p class="body-large">${asset.accumulated_depreciation_account_code} - ${asset.accumulated_depreciation_account_name}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('fixedAsset', 'depreciationExpenseAccountInfoLabel')}</p>
                <p class="body-large">${asset.depreciation_expense_account_code} - ${asset.depreciation_expense_account_name}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('fixedAsset', 'paymentAccountInfoLabel')}</p>
                <p class="body-large">${asset.payment_account_code} - ${asset.payment_account_name}</p>
              </div>
            </div>
          </section>

          <!-- Depreciation History -->
          ${state.depreciationHistory.length > 0 ? html`
            <section>
              <h3 class="title-medium" style="margin-bottom: 16px;">${t('fixedAsset', 'depreciationHistorySectionTitle')}</h3>
              <table aria-label="${t('fixedAsset', 'depreciationHistorySectionTitle')}" style="--md-sys-density: -3;">
                <thead>
                  <tr>
                    <th scope="col">${t('fixedAsset', 'dateColumnInfo')}</th>
                    <th scope="col">${t('fixedAsset', 'noteColumnInfo')}</th>
                    <th scope="col" class="numeric">${t('fixedAsset', 'amountColumnInfo')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${repeat(state.depreciationHistory, (entry) => entry.ref, (entry) => html`
                    <tr>
                      <td>${i18n.date.format(new Date(entry.entry_time))}</td>
                      <td>${entry.note || t('fixedAsset', 'noNoteLabel')}</td>
                      <td class="numeric">${i18n.displayCurrency(entry.amount)}</td>
                    </tr>
                  `)}
                </tbody>
              </table>
            </section>
          ` : nothing}

          <!-- Delete Button (only if no depreciation) -->
          ${asset.accumulated_depreciation === 0 ? html`
            <section style="border-top: 1px solid var(--md-sys-color-outline-variant); padding-top: 24px; margin-top: 8px;">
              <h3 class="title-medium" style="margin-bottom: 8px; color: var(--md-sys-color-error);">${t('fixedAsset', 'dangerZoneSectionTitle')}</h3>
              <p class="body-medium" style="color: var(--md-sys-color-on-surface-variant); margin-bottom: 16px;">
                ${t('fixedAsset', 'dangerZoneWarning')}
              </p>
              <button
                role="button"
                class="tonal"
                style="--md-sys-color-secondary-container: var(--md-sys-color-error-container); --md-sys-color-on-secondary-container: var(--md-sys-color-on-error-container);"
                @click=${handleDeleteClick}
              >
                <material-symbols name="delete"></material-symbols>
                ${t('fixedAsset', 'deleteAssetActionLabel')}
              </button>
            </section>
          ` : nothing}
        </div>
      `;
    }

    function renderEditMode() {
      if (!state.asset) return nothing;
      const asset = state.asset;

      return html`
        <form @submit=${handleUpdateSubmit} style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0;">
          ${state.formSaving ? html`
            <div role="status" aria-live="polite" aria-busy="true">
              <div role="progressbar" class="linear indeterminate">
                <div class="track"><div class="indicator"></div></div>
              </div>
              <p>${t('fixedAsset', 'savingChangesLabel')}</p>
            </div>
          ` : nothing}

          <!-- Asset Name -->
          <div class="outlined-text-field">
            <div class="container">
              <label for="edit-name-input">${t('fixedAsset', 'assetNameLabel')}</label>
              <input
                id="edit-name-input"
                name="name"
                type="text"
                placeholder=" "
                required
                value="${asset.name}"
              />
            </div>
          </div>

          <!-- Description -->
          <div class="outlined-text-field">
            <div class="container">
              <label for="edit-description-input">${t('fixedAsset', 'descriptionLabel')}</label>
              <input
                id="edit-description-input"
                name="description"
                placeholder=" "
                value="${asset.description || ''}"
              >
            </div>
          </div>

          ${asset.accumulated_depreciation > 0 ? html`
            <div style="padding: 12px 16px; background-color: var(--md-sys-color-surface-container); border-radius: var(--md-sys-shape-corner-medium);">
              <p class="body-medium" style="color: var(--md-sys-color-on-surface-variant);">
                <material-symbols name="info" size="18" style="vertical-align: middle; margin-right: 4px;"></material-symbols>
                ${t('fixedAsset', 'editInfoMessage')}
              </p>
            </div>
          ` : nothing}

          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button role="button" type="button" class="text" @click=${toggleEditMode}>${t('fixedAsset', 'cancelActionLabel')}</button>
            <button role="button" type="submit" class="tonal">${t('fixedAsset', 'saveChangesActionLabel')}</button>
          </div>
        </form>
      `;
    }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="fixed-asset-details-dialog"
          class="full-screen"
          aria-labelledby="fixed-asset-details-dialog-title"
        >
          <div class="container">
            <header>
              <h2 id="fixed-asset-details-dialog-title">
                ${state.asset ? state.asset.name : t('fixedAsset', 'detailsTitle')}
              </h2>
              <button
                role="button"
                type="button"
                class="text"
                commandfor="fixed-asset-details-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              ${state.asset && !state.isEditing ? html`
                <button role="button" type="button" @click=${toggleEditMode}>
                  <material-symbols name="edit"></material-symbols>
                  ${t('fixedAsset', 'editActionLabel')}
                </button>
              ` : nothing}
            </header>

            <div class="content" style="max-width: 600px; margin: 0 auto;">
              ${state.isLoading ? renderLoadingState() : nothing}
              ${!state.isLoading && !state.asset ? renderNotFoundState() : nothing}
              ${!state.isLoading && state.asset && !state.isEditing ? renderViewMode() : nothing}
              ${!state.isLoading && state.asset && state.isEditing ? renderEditMode() : nothing}
            </div>
          </div>
        </dialog>

        <dialog ${errorAlertDialog} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>${t('fixedAsset', 'errorDialogTitle')}</h3>
            </header>
            <div class="content">
              <p>${state.formError?.message}</p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  @click=${handleDismissErrorDialog}
                >${t('fixedAsset', 'dismissLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>

        <dialog ${confirmDeleteDialog} role="alertdialog">
          <div class="container">
            <material-symbols name="warning"></material-symbols>
            <header>
              <h3>${t('fixedAsset', 'confirmDeleteTitle')}</h3>
            </header>
            <div class="content">
              <p>${t('fixedAsset', 'confirmDeleteMessage', state.asset?.name)}</p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  @click=${handleCancelDelete}
                >${t('fixedAsset', 'cancelActionLabel')}</button>
              </li>
              <li>
                <button
                  role="button"
                  type="button"
                  class="tonal"
                  style="--md-sys-color-secondary-container: var(--md-sys-color-error-container); --md-sys-color-on-secondary-container: var(--md-sys-color-on-error-container);"
                  @click=${handleConfirmDelete}
                  ?disabled=${state.isDeleting}
                >${state.isDeleting ? t('fixedAsset', 'deletingLabel') : t('fixedAsset', 'deleteConfirmActionLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('fixed-asset-details-dialog', FixedAssetDetailsDialogElement);
