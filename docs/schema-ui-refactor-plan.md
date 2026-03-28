# Schema Refactor UI Rollout Plan

## Goal

Apply the schema refactor described in `docs/schema-git-diff-major-changes.md` to the UI layer so that every screen, dialog, query, mutation, and test uses the new database contract correctly.

This is not a rename-only migration. The schema now expects the UI to participate in workflow orchestration in several places, especially around explicit journal entry references, workflow-owned journal entries, stricter immutability, and the reconciliation redesign.

## Success Criteria

- No UI code reads or writes removed schema columns or tables.
- All UI write flows that can cause journal entries to be created provide explicit journal entry refs before the triggering update or insert.
- The UI no longer assumes posted records are editable or discardable after posting.
- Manual journal entry UI supports the new cash flow classification rules.
- Reconciliation UI is rebuilt around reconciliation checkpoints and physical cash count is no longer treated as a separate persistence model.
- UI tests and supporting fixtures reflect the new schema contract.

## Shared Migration Rules

These rules cut across all domains and should be implemented first.

### 1. Introduce a shared journal entry ref allocator

Why:
- `journal_entries.ref` is no longer auto-generated.
- Fiscal year close/reversal, manual journals, purchase posting, sale posting, stock taking, fixed asset acquisition, and reconciliation checkpoints all now depend on app-supplied refs.

Plan:
- Add a small shared utility in the UI data layer to reserve the next journal entry ref inside the same write transaction that uses it.
- Standardize all workflow code to call this allocator before any insert or update that triggers journal entry creation.
- Keep the allocator deterministic and transaction-safe. Do not generate refs in detached UI state.
- Prefer one utility entrypoint instead of repeating `SELECT MAX(ref)` logic across dialogs.

Acceptance:
- No UI component inserts into `journal_entries` without providing `ref`.
- No workflow still relies on `RETURNING ref` from SQLite-generated journal entries.

### 2. Standardize workflow-owned journal entry patterns

Why:
- Journal entries now belong to concrete workflows through foreign keys such as `purchase_id`, `sale_id`, `stock_taking_id`, `fixed_asset_id`, and `reconciliation_id`.
- The old `source_type`, `source_reference`, and `created_by` metadata path is removed.

Plan:
- Replace any source metadata assumptions in UI queries with owner-aware queries.
- Where the UI needs a label like “Manual”, “Purchase”, or “Reconciliation”, derive it from workflow link columns instead of reading a removed source field.
- Create one reusable mapping function for journal entry ownership display.

Acceptance:
- Journal entry list and details screens can explain provenance without depending on removed columns.

### 3. Normalize UI naming around `note`

Why:
- The schema is converging on `note` instead of mixed `description` and `reference` fields.

Plan:
- Audit form fields, labels, query projections, and tests for `description` or `reference` on journal entry lines, fixed assets, config, and reconciliation.
- Rename UI copy and state fields where they are still representing the old contract.
- Keep visible wording semantically appropriate, but map to the new schema field names.

Acceptance:
- No UI write query still targets removed `description` or `reference` columns on `journal_entry_lines`.

### 4. Treat posted records as read-only facts in the UI

Why:
- The schema increasingly rejects mutation after posting.

Plan:
- Remove or disable any edit, discard, or patch path that still appears valid after posting.
- Update dialogs to show immutable status clearly and stop offering actions the database will reject.
- Map trigger errors to user-facing messages only as a fallback. The UI should prevent invalid operations before the trigger fires.

Acceptance:
- Draft-only actions are only visible for draft records.
- Posted screens do not present stale affordances.

### 5. Add a schema-aware error translation layer

Why:
- More validation now happens in SQLite triggers.

Plan:
- Centralize common trigger error handling so dialogs can convert raw database errors into stable user-facing messages.
- Prioritize errors for missing journal entry refs, missing reconciliation accounts, invalid cash flow classification, and posted-record mutation.

Acceptance:
- High-frequency trigger failures are shown with clear UI messages instead of raw SQL text.

## Workstream Inventory

### Manual Journal Entries

Current gaps:
- `web/components/journal-entry-creation-dialog.js` still inserts `source_type` and `created_by`, and still depends on `RETURNING ref`.
- `web/components/journal-entry-details-dialog.js` still reads `source_type`, `description`, and `reference`, and reversal creation still inserts removed columns.
- `web/views/journal-entries-view.js` still filters and renders by `source_type`.

Plan:
- Rebuild manual journal entry creation around explicit `ref` allocation.
- Add optional line `note` input instead of old description/reference semantics.
- Add cash flow classification inputs for lines that use cash-equivalent accounts.
- Load allowed `cashflow_categories` into the dialog and validate the UI shape before submission.
- Enforce the new pairing rule: `cashflow_activity` and `cashflow_category` must either both exist or both be absent.
- Prevent cash flow classification on non-cash accounts at the UI level.
- Update reversal flow to allocate a new `ref`, clone `note` and cash flow fields, and stop referencing removed provenance columns.
- Replace source-type filtering in the journal entry list with either:
  - owner/workflow filtering, or
  - a simplified status/search-only list if ownership labels are enough for now.
- Add owner labels for manual entries versus workflow-generated entries using owner FK presence.

Acceptance:
- Manual journal creation, posting, reversal, and display all work without `source_type`, `created_by`, `description`, or `reference`.
- Cash-equivalent lines can be created with valid classification from the UI.

### Fiscal Year Close and Reversal

Current gaps:
- `web/components/fiscal-year-closing-dialog.js` only sets `post_time` and assumes the trigger can create what it needs without pre-supplied refs.
- `web/components/fiscal-year-reversal-dialog.js` only sets `reversal_time` and likewise does not provide reversal refs.
- The fixed asset extension means fiscal year close/reversal can also require depreciation refs.

Plan:
- Before closing a fiscal year, allocate:
  - `closing_journal_entry_ref`
  - `depreciation_journal_entry_ref`
- Before reversing a fiscal year, allocate:
  - `reversal_journal_entry_ref`
  - `depreciation_reversal_journal_entry_ref`
- Perform the ref assignment and the close/reversal timestamp update in the same transaction.
- Keep the UI tolerant of no-op cases where the schema nulls out an unused ref because no journal entry was actually needed.
- Update the preview state in the dialog so users can see whether the close is blocked by unposted entries and whether linked journal refs exist after completion.

Acceptance:
- Fiscal year close/reversal flows satisfy the new required-ref triggers.
- Result screens correctly show closing, reversal, and depreciation-generated refs.

### Purchases

Current gaps:
- `web/views/purchase-creation-view.js` already writes supplier-facing line fields directly, which aligns with the schema direction, but it does not yet account for supplier document ingestion.
- `web/components/purchase-details-dialog.js` posts by setting only `post_time`; it does not assign `purchases.journal_entry_ref` first.

Plan:
- Update draft purchase posting to allocate a journal entry ref and set both `journal_entry_ref` and `post_time` together.
- Keep purchase creation focused on draft creation first; posting remains the transition to immutable accounting fact.
- Confirm that draft discard is only allowed pre-posting.
- Add a follow-up phase for supplier document ingestion:
  - collected document selection
  - capture metadata display
  - optional attachment from purchase draft to `documents.collect_time`
- Verify purchase detail screens show supplier-facing quantity and unit semantics consistently with the refactor.

Acceptance:
- Purchase posting works against the new trigger contract.
- UI no longer implies that posted purchase rows are mutable.

### Sales

Current gaps:
- `web/components/sale-details-dialog.js` posts by setting only `post_time`; it does not assign `sales.journal_entry_ref` first.
- Sales list/detail screens still mostly reflect pre-hardening behavior.

Plan:
- Update sale posting to allocate and persist `sales.journal_entry_ref` before setting `post_time`.
- Audit sale draft flows to ensure no post-posting mutation path remains on lines, discounts, or payments.
- Tighten UI validation for totals so it matches the schema’s stricter expectations before submission.
- Review whether the POS screen allows update shapes that the schema now forbids, especially around sale lines and payment totals.

Acceptance:
- Sale posting uses explicit journal entry refs.
- Draft-only operations are not offered after posting.

### Stock Taking

Current gaps:
- `web/components/stock-taking-dialog.js` inserts `stock_takings` without `journal_entry_ref`.
- The schema now expects stock-taking posting/inventory adjustment flows to be explicit and more tightly controlled.

Plan:
- Update stock-taking creation to allocate `journal_entry_ref` before insert when the schema requires it.
- Re-check whether stock taking should still be a single-step create-and-post flow in the UI, or whether it should surface more clearly as an irreversible adjustment workflow.
- Ensure list/details screens explain that stock taking is an inventory-accounting event, not a freely editable audit draft.

Acceptance:
- Stock-taking creation succeeds against the new schema.
- The UI communicates its irreversible accounting effect more clearly.

### Fixed Assets

Current gaps:
- `web/components/fixed-asset-creation-dialog.js` still writes `description` instead of `note` and does not provide `journal_entry_ref`.
- `web/components/fixed-asset-details-dialog.js` still relies on old provenance patterns such as `source_reference` and journal line `reference`.

Plan:
- Update fixed asset creation to:
  - map UI free text to `note`
  - allocate and submit `journal_entry_ref`
  - keep the asset insert and required journal entry reservation in one transaction
- Confirm the creation UI explains that acquisition immediately becomes an accounting-owned fact.
- Rebuild fixed asset detail queries around current relational ownership:
  - acquisition journal through `fixed_assets.journal_entry_ref`
  - linked journal entry through `journal_entries.fixed_asset_id`
  - depreciation history through fixed-asset-owned journal entries rather than removed line reference markers
- Remove deletion logic that tries to find acquisition entries through removed `source_reference` columns.
- Revisit edit/delete affordances so they reflect the schema’s stricter posted-history restrictions.

Acceptance:
- Fixed asset creation and detail views work without old provenance columns.
- Depreciation history is derived from current ownership links.

### Reconciliation and Cash Count Consolidation

Current gaps:
- `web/components/account-reconciliation-creation-dialog.js` still inserts into `reconciliation_sessions` and models statement begin/end balances.
- `web/views/account-reconciliation-list-view.js` still queries removed reconciliation session tables and helper tables.
- `web/components/cash-count-creation-dialog.js` still inserts into removed `cash_counts` and checks removed draft-session rules.
- `web/views/cash-count-list-view.js` still queries removed `cash_count_history`.
- `web/views/reconciliation-view.js` still treats account reconciliation and cash count as separate persistence features.

Plan:
- Redesign reconciliation UI around `reconciliation_checkpoints` and `reconciliation_history`.
- Replace the old account-reconciliation creation form with a checkpoint form that captures:
  - `account_code`
  - `type` (`STATEMENT` or `PHYSICAL`)
  - `checkpoint_time`
  - `external_balance`
  - `note`
  - app-supplied `adjustment_journal_entry_ref` when a discrepancy is expected
- Decide the UI shape for adjustment refs:
  - internal-only and automatically allocated in the submit handler is the preferred path.
- Merge statement reconciliation and physical cash count into one conceptual feature in navigation.
- Keep separate tabs only if they are just filtered views over the same checkpoint model.
- Replace list queries with `reconciliation_history` and expose:
  - type
  - checkpoint time
  - external balance
  - book balance
  - discrepancy
  - discrepancy type
  - linked adjustment journal ref
- Replace the old details dialog with a simpler checkpoint details view.
- Remove assumptions about statement-item matching, draft session completion, or discrepancy subrecords.
- Update account-preparation flows so the UI still helps users create and find accounts tagged:
  - `Reconciliation - Adjustment`
  - `Reconciliation - Cash Over/Short`

Acceptance:
- Reconciliation UI no longer references deleted tables or views.
- Physical cash count is represented as `PHYSICAL` checkpoints, not a separate feature store.

### Journal Entry Read-Only Surfaces and Other Reporting Views

Current gaps:
- Journal entry screens are the largest breakage point, but test fixtures in non-journal screens also still insert old columns.
- Some read-only views and specs still assume old journal line fields.

Plan:
- Audit read-only surfaces that seed or display journal data, including reporting and balance views.
- Update every fixture and direct SQL seed that still inserts:
  - `source_type`
  - `created_by`
  - `description`
  - `reference`
- Update query projections to use `note` and ownership links where needed.

Acceptance:
- No UI view or spec seed depends on removed accounting columns.

## File-by-File Execution Plan

### Phase 1: Shared Infrastructure

Target files:
- `web/database.js` or a nearby shared data helper module
- new utility module for journal entry ref allocation
- shared error mapping utility if needed

Tasks:
- Add transaction-safe journal entry ref allocation.
- Add reusable workflow ownership label helper.
- Add trigger error normalization helper.

### Phase 2: Accounting Core UI

Target files:
- `web/components/journal-entry-creation-dialog.js`
- `web/components/journal-entry-details-dialog.js`
- `web/views/journal-entries-view.js`
- `web/lang/en/journal-entry.js`
- `web/lang/id/journal-entry.js`

Tasks:
- Remove old provenance assumptions.
- Add cash flow classification controls and copy.
- Rebuild reversal flow with explicit refs.
- Rework list filtering and badges.

### Phase 3: Fiscal Year Workflows

Target files:
- `web/components/fiscal-year-closing-dialog.js`
- `web/components/fiscal-year-reversal-dialog.js`
- `web/lang/en/fiscal-year.js`
- `web/lang/id/fiscal-year.js`

Tasks:
- Allocate required refs before close/reversal updates.
- Improve result and error messaging for generated entries.

### Phase 4: POS Posting Flows

Target files:
- `web/views/purchase-creation-view.js`
- `web/components/purchase-details-dialog.js`
- `web/views/purchases-view.js`
- `web/components/sale-details-dialog.js`
- `web/views/sales-view.js`
- `web/components/stock-taking-dialog.js`

Tasks:
- Allocate journal refs before posting purchases, sales, and stock takings.
- Remove stale edit/discard assumptions after posting.
- Keep supplier inventory behavior aligned with the new informational model.

### Phase 5: Fixed Assets

Target files:
- `web/components/fixed-asset-creation-dialog.js`
- `web/components/fixed-asset-details-dialog.js`
- `web/views/fixed-assets-view.js`
- `web/lang/en/fixed-asset.js`
- `web/lang/id/fixed-asset.js`

Tasks:
- Rename `description` usage to `note` where it maps to schema fields.
- Add required acquisition journal ref allocation.
- Replace old provenance queries with ownership-based queries.

### Phase 6: Reconciliation Redesign

Target files:
- `web/views/reconciliation-view.js`
- `web/views/account-reconciliation-list-view.js`
- `web/views/cash-count-list-view.js`
- `web/components/account-reconciliation-creation-dialog.js`
- `web/components/account-reconciliation-details-dialog.js`
- `web/components/cash-count-creation-dialog.js`
- `web/components/reconciliation-account-creation-dialog.js`
- `web/lang/en/reconciliation.js`
- `web/lang/id/reconciliation.js`

Tasks:
- Replace session-based and cash-count-based persistence with checkpoint-based persistence.
- Merge or reframe navigation to reflect one unified reconciliation feature.
- Rebuild list and detail displays from `reconciliation_history`.

### Phase 7: Test and Fixture Sweep

Target files:
- affected `*.spec.js` and any UI tests that seed old columns directly
- view specs such as `web/views/journal-entries-view.spec.js`, `web/views/trial-balance-view.spec.js`, and reconciliation-related specs

Tasks:
- Replace old accounting seed data with explicit refs and new line fields.
- Add tests for manual cash flow classification UI.
- Add tests for fiscal year close/reversal requiring generated refs.
- Add tests for purchase/sale/stock-taking posting using explicit refs.
- Rewrite reconciliation tests around checkpoints and the unified history list.

## Suggested Delivery Order

1. Shared journal entry ref allocation and error mapping.
2. Manual journal entry screens.
3. Fiscal year close/reversal flows.
4. Purchase, sale, and stock-taking posting flows.
5. Fixed asset creation/details.
6. Reconciliation redesign and cash count consolidation.
7. Translation and UI copy cleanup.
8. Playwright and fixture sweep.

This order minimizes churn because the same ref-allocation infrastructure is reused everywhere, and it removes the highest-risk schema breakages first.

## Testing Plan

### Node and schema alignment checks

- Run the relevant schema tests first when clarifying trigger expectations:
  - `node --test ./web/schemas/001-accounting-basic.test.js`
  - `node --test ./web/schemas/001-accounting-fiscal-year-closing.test.js`
  - `node --test ./web/schemas/001-accounting-fiscal-year-reversal.test.js`
  - `node --test ./web/schemas/002-pos.test.js`
  - `node --test ./web/schemas/005-fixed-assets.test.js`
  - `node --test ./web/schemas/006-account-reconciliation.test.js`

### UI regression checks

- Run focused Playwright specs per workstream as each phase lands.
- Prioritize:
  - journal entry specs
  - purchase and sale specs
  - fixed asset specs
  - reconciliation specs
- Prefer UI assertions over direct database inspection.

### Manual QA checklist

- Create and post a balanced manual journal with and without cash-equivalent lines.
- Reverse a posted manual journal.
- Close a fiscal year that generates closing and depreciation entries.
- Reverse a closed fiscal year with depreciation reversal.
- Post a purchase draft.
- Post a sale draft.
- Create a stock taking that changes inventory value.
- Create a fixed asset and verify linked acquisition journal entry visibility.
- Create both a `STATEMENT` reconciliation checkpoint and a `PHYSICAL` checkpoint.
- Verify balanced checkpoints create no adjustment entry and discrepant checkpoints create one linked entry.

## Risks and Mitigations

### Risk: inconsistent journal ref generation

Impact:
- Multiple flows fail with duplicate or missing refs.

Mitigation:
- Land the shared allocator first and require all workflow mutations to use it.

### Risk: UI still exposes actions that the database forbids

Impact:
- Frequent trigger failures and confusing UX.

Mitigation:
- Audit every posted-record screen and remove invalid actions before broad QA.

### Risk: reconciliation rewrite becomes a partial rename instead of a true redesign

Impact:
- The UI remains coupled to deleted tables and the wrong workflow model.

Mitigation:
- Treat reconciliation as a new feature implementation over `reconciliation_checkpoints` and `reconciliation_history`, not as an incremental patch.

### Risk: old provenance assumptions linger in details pages and tests

Impact:
- Journal entry and fixed asset surfaces silently break.

Mitigation:
- Perform a repo-wide sweep for `source_type`, `source_reference`, `created_by`, `description`, `reference`, `cash_counts`, and `reconciliation_sessions` before calling the migration complete.

## Definition of Done

- All affected UI screens are migrated to the new schema contract.
- No affected Playwright spec or UI seed uses removed accounting or reconciliation columns/tables.
- Manual journal, fiscal year, POS posting, fixed asset, and reconciliation workflows all succeed against the refactored schema.
- Cash count exists only as the `PHYSICAL` branch of reconciliation checkpoints in the UI mental model and persistence path.