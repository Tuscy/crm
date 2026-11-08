# Implementation Plan: CRM User Experience and Data Integrity Improvements

**Spec Reference**: `.specify/memory/spec.md`

**Feature Branch**: `cursor/crm-improvements-sdd-4c84`

**Created**: 2026-11-08

**Architecture**: Next.js 14 App Router, Prisma ORM, TypeScript, shadcn/ui

## Architecture Overview

This implementation extends the existing StickySites CRM without architectural rewrites. We follow established patterns:

- **Data layer**: Prisma schema extensions (additive, backwards-compatible)
- **Server actions**: `/lib/server/actions/*.ts` for mutations with auth/scope checks
- **UI components**: `/components/crm/*.tsx` and `/components/dashboard/*.tsx` using shadcn primitives
- **Pages**: `/app/dashboard/*/page.tsx` for new routes (Today view) and extensions to existing pages
- **Validation**: Zod schemas in server actions, Prisma client types for type safety

Key architectural decisions:

1. **Package mapping**: Display labels resolved client-side via constant mapping object, database enum values unchanged
2. **Lead extensions**: Additive schema changes (owner/nextAction/followUpDate columns) with nullable constraints
3. **GBP posts**: New GBPPost model (already exists per schema review) extended with draft/approval workflow
4. **Workflow metadata**: Stored in new WorkflowReview table or fetched from n8n API and cached (decision point)
5. **Integration state**: Enhanced status enum and lastFetchedAt timestamps on existing credential models
6. **Today view**: New dashboard route aggregating queries across tasks and deals with overdue/missing-action logic

## Implementation Phases

### Phase 1: Package Label Mapping (P1, User Story 1)

**Objective**: Display correct tier names (Minimum Stick, Extra Sticky, Totally Stuck) instead of VOLTAGE/CHARGE/GRID

**Approach**:
- Create mapping constant `PACKAGE_DISPLAY_LABELS` in `/packages/crm/src/index.ts` or `/apps/app/lib/constants.ts`
- Update existing components: `EditClientPackageForm`, `LeadConversionForm`, `CreateDealForm`, client/lead detail pages
- Replace hardcoded labels with mapped values
- Verify database enum values unchanged (VOLTAGE, CHARGE, GRID remain in DB)

**Files**:
- `/packages/crm/src/index.ts` (or `/apps/app/lib/constants.ts`): Add `PACKAGE_DISPLAY_LABELS`
- `/apps/app/components/crm/edit-client-package-form.tsx`: Update `PACKAGE_OPTIONS` labels
- `/apps/app/components/crm/lead-conversion-form.tsx`: Update `PACKAGE_OPTIONS` labels
- `/apps/app/components/crm/create-deal-form.tsx`: Update package dropdown options
- `/apps/app/app/dashboard/leads/[id]/page.tsx`: Update `PACKAGE_LABELS` constant
- `/apps/app/app/dashboard/clients/[id]/page.tsx`: Update `PACKAGE_LABELS` constant

**Tests**:
- Unit test: Verify mapping function returns correct labels for each enum value and handles null/undefined
- Manual UI: Open each form/page with test data (VOLTAGE, CHARGE, GRID, null) and verify labels

**Acceptance**: All forms and detail pages display "Minimum Stick", "Extra Sticky", "Totally Stuck", and "None" correctly

---

### Phase 2: Lead Owner, Next Action, Follow-Up Date (P1, User Story 2)

**Objective**: Add owner assignment, next action text, and follow-up date to leads with visibility and validation

**Approach**:
- Extend Prisma Lead model with `ownerId`, `nextAction`, `followUpDate` (all nullable)
- Create migration (additive, backwards-compatible)
- Update `CreateLeadForm` and `UpdateLeadForm` to include new fields
- Add owner dropdown (staff users), next action textarea, follow-up date picker
- Extend lead list view to show owner and follow-up columns (optional filter)
- Add visual indicator for overdue follow-ups (e.g. red badge if followUpDate < today)
- Soft validation: warn if transitioning to Qualified without next action

**Files**:
- `/packages/db/prisma/schema.prisma`: Add `ownerId`, `nextAction`, `followUpDate` to Lead model
- `/packages/db/prisma/migrations/`: New migration file (generated, not executed on prod)
- `/apps/app/components/crm/create-lead-form.tsx`: Add owner dropdown, nextAction textarea, followUpDate input
- `/apps/app/components/crm/update-lead-form.tsx`: Add new fields with existing lead defaults
- `/apps/app/app/dashboard/leads/page.tsx`: Extend lead list table to show owner and follow-up columns
- `/apps/app/app/dashboard/leads/[id]/page.tsx`: Display owner, next action, follow-up in lead detail header or info card
- `/apps/app/lib/server/actions/leads.ts`: Update `createLead` and `updateLead` actions to handle new fields
- `/apps/app/lib/validation/lead.ts` (or inline in action): Add Zod schema validation for new fields

**Tests**:
- Unit test: Validation accepts null values, valid staff IDs, text, and dates
- Integration test: Create/update lead with new fields, verify persisted in DB
- Manual UI: Create lead with owner/next-action/follow-up, verify display and edit

**Acceptance**: Lead forms include new fields, lead list shows owner/follow-up, detail page displays all fields with overdue indicator

---

### Phase 3: Explicit Lead Lifecycle and Duplicate Prevention (P1, User Story 3)

**Objective**: Formalize lead → deal → client conversion with duplicate client detection

**Approach**:
- Review existing `Deal` creation flow in `CreateDealForm` and `createDeal` action
- Verify pipeline stage display and counts (existing `PipelineKanban` component)
- Add explicit "Convert to Client" action for Won deals (or auto-create with confirmation)
- Implement client duplicate check: query Client by `primaryContactEmail` (case-insensitive) or `companiesHouseNumber`
- If match found, link deal to existing client; else create new client
- Ensure lead.clientId and deal relationships preserved
- Document lead-deal-client relationship chain in code comments

**Files**:
- `/apps/app/components/crm/create-deal-form.tsx`: Verify deal creation links to lead correctly
- `/apps/app/lib/server/actions/deals.ts`: Review `createDeal` and `updateDealStage` actions
- `/apps/app/components/crm/deal-to-client-conversion.tsx` (new): UI for Won deal → client conversion with duplicate check
- `/apps/app/lib/server/actions/clients.ts`: Add `findOrCreateClientFromDeal` helper with duplicate detection logic
- `/apps/app/app/dashboard/pipeline/page.tsx`: Verify pipeline displays accurate counts and stages
- `/apps/app/components/crm/pipeline-kanban.tsx`: Verify deal card display and stage transitions

**Tests**:
- Unit test: `findOrCreateClientFromDeal` returns existing client when email matches, creates new when no match
- Integration test: Create lead → deal → win → convert to client, verify no duplicates created on repeat
- Manual UI: Create lead, convert to deal, move through stages, win, convert to client, verify client detail shows linked lead/deal

**Acceptance**: Won deals convert to clients without duplicates, pipeline shows accurate counts, lead-deal-client relationships intact

---

### Phase 4: Today View (P2, User Story 4)

**Objective**: Aggregate overdue/due tasks and opportunities needing next actions into actionable dashboard

**Approach**:
- Create new route `/app/dashboard/today/page.tsx`
- Query tasks: `dueDate < today` (overdue), `dueDate == today` (due today), `dueDate between today and +7 days` (upcoming)
- Query deals: `stage NOT IN ['WON', 'LOST'] AND nextAction IS NULL` (if deal model extended with nextAction, else use lead.nextAction)
- Display sections: Overdue Tasks, Due Today, This Week, Needs Next Action
- Each item links to lead/client/deal detail
- Add navigation link in dashboard shell (e.g. sidebar or top nav)

**Files**:
- `/apps/app/app/dashboard/today/page.tsx` (new): Today view page component
- `/apps/app/lib/server/actions/today.ts` (new): `getTodayItems` query function aggregating tasks and deals
- `/apps/app/components/dashboard/today-view.tsx` (new): UI component rendering sections
- `/apps/app/components/dashboard/mobile-dashboard-shell.tsx` or `/apps/app/app/dashboard/layout.tsx`: Add "Today" nav link

**Tests**:
- Unit test: Query functions return correct items for each date range
- Integration test: Create tasks with various due dates, verify Today view displays correctly
- Manual UI: Create overdue/due/upcoming tasks, deals without next actions, verify all appear in Today view

**Acceptance**: Today view displays 4 sections (overdue, due today, this week, needs next action) with linked context, accessible from dashboard nav

---

### Phase 5: Task Details and Linking (P2, User Story 5)

**Objective**: Add notes field to tasks, surface linked tasks in lead/client views

**Approach**:
- Extend Prisma Task model with `notes` (string, nullable)
- Create migration (additive)
- Update `CreateTaskForm` and task edit UI to include notes textarea
- Extend task display in `PersonalTaskList`, lead detail, and new client task card to show notes
- Add "Linked Tasks" card to client detail overview tab

**Files**:
- `/packages/db/prisma/schema.prisma`: Add `notes` to Task model
- `/packages/db/prisma/migrations/`: New migration file
- `/apps/app/components/crm/create-task-form.tsx`: Add notes textarea
- `/apps/app/components/dashboard/personal-task-list.tsx`: Display notes in task list
- `/apps/app/app/dashboard/leads/[id]/page.tsx`: Show task notes in lead detail task section
- `/apps/app/components/crm/client-tasks-card.tsx` (new): Card component for client detail showing linked tasks
- `/apps/app/app/dashboard/clients/[id]/page.tsx`: Add `<ClientTasksCard>` to overview tab
- `/apps/app/lib/server/actions/clients.ts`: Extend `getClientById` to include `tasks` relation via `leads`

**Tests**:
- Unit test: Task creation/update with notes persists correctly
- Integration test: Create task with notes on lead, verify appears in client view via lead linkage
- Manual UI: Create task with notes, verify display in task list, lead detail, client detail

**Acceptance**: Tasks include notes field, visible in all task contexts, client detail shows linked tasks from associated leads

---

### Phase 6: Client Workspace Cohesion (P2, User Story 6)

**Objective**: Integrate linked tasks and SharePoint document metadata into client detail page

**Approach**:
- Leverage Phase 5 task linking (already adds `ClientTasksCard`)
- For SharePoint documents, check if Client model has `documents` JSON field or separate `ClientDocument` model
- If JSON field exists, parse and display with labels; else add `ClientDocument` model with `url`, `label`, `type` fields
- Display documents in client Details tab as link list with icons
- No live SharePoint API integration (use stored metadata or mock data for testing)

**Files**:
- `/apps/app/components/crm/client-tasks-card.tsx`: Already created in Phase 5
- `/packages/db/prisma/schema.prisma`: Add `ClientDocument` model if needed (decision point)
- `/apps/app/components/crm/client-documents-card.tsx` (new): Display document links with metadata
- `/apps/app/app/dashboard/clients/[id]/page.tsx`: Add `<ClientDocumentsCard>` to Details tab if documents present
- `/apps/app/lib/server/actions/clients.ts`: Include `documents` relation in `getClientById` if separate model

**Tests**:
- Manual UI: View client with mock documents JSON or seeded ClientDocument records, verify display with labels/icons
- No automated tests for SharePoint integration (out of scope, mock data only)

**Acceptance**: Client Overview shows linked tasks, Details tab shows SharePoint documents with readable labels, no live API calls

---

### Phase 7: GBP Draft and Review Workflow (P3, User Story 7)

**Objective**: Add draft/approval workflow for GBP posts with text-only, no live posting

**Approach**:
- Verify GBPPost model exists (schema review shows it does)
- Extend with fields if missing: `status` (Draft, PendingApproval, Approved, Posted), `approvedAt`, `approvedBy`
- Create `GBPPostDraftForm` component with copy, intendedDate, ctaType, ctaUrl, imageProvenance fields
- Add "Submit for Approval" button (sets status to PendingApproval)
- Create approval UI (simple approve button for staff with permission, or separate approval queue page)
- On edit of approved post, clear `approvedAt` and `approvedBy`, set status back to Draft
- Block image upload with UI message
- Mock "Schedule Post" action with safety message

**Files**:
- `/packages/db/prisma/schema.prisma`: Verify/extend GBPPost model with status, approvedAt, approvedBy
- `/apps/app/components/gbp/gbp-post-draft-form.tsx` (new): Draft form component
- `/apps/app/components/gbp/gbp-post-approval-card.tsx` (new): Approval UI
- `/apps/app/lib/server/actions/gbp-posts.ts` (new): `createDraft`, `submitForApproval`, `approveDraft`, `editPost` actions with approval invalidation logic
- `/apps/app/app/dashboard/business-profile/page.tsx`: Extend to show draft/approval UI, verify existing post listing
- `/apps/app/app/dashboard/clients/[id]/page.tsx`: Add GBP draft link in Business Profile card

**Tests**:
- Unit test: Editing approved post clears approval fields
- Integration test: Draft → submit → approve → edit → verify status reverts to Draft
- Manual UI: Draft post, submit, approve, edit, verify approval cleared, attempt image upload blocked

**Acceptance**: GBP draft form prevents image upload, requires approval, invalidates approval on edit, no live posting occurs

---

### Phase 8: Integration State Clarity (P3, User Story 8)

**Objective**: Distinguish not-configured vs loading vs connected vs error states for integrations

**Approach**:
- Extend AnalyticsCredential, GoogleAdsConnection, XeroCredential with `lastFetchedAt` and `lastError` fields
- Update integration fetch actions to set `lastFetchedAt` on success, `lastError` on failure
- Replace raw env variable errors (UPTIME_KUMA_BASE_URL) with friendly UI in `UptimeStatusCard`
- Create helper functions: `getIntegrationStatus(credential)` returns { state, message, lastFetch }
- Update client reporting and dashboard cards to use helper

**Files**:
- `/packages/db/prisma/schema.prisma`: Add `lastFetchedAt`, `lastError` to AnalyticsCredential, GoogleAdsConnection, XeroCredential
- `/apps/app/lib/integrations/status.ts` (new): `getIntegrationStatus` helper function
- `/apps/app/components/dashboard/uptime-status-card.tsx`: Replace raw error with friendly setup prompt
- `/apps/app/app/dashboard/clients/[id]/page.tsx`: Update Analytics, Google Ads cards to show state via helper
- `/apps/app/lib/server/actions/analytics.ts`: Update fetch actions to set lastFetchedAt/lastError

**Tests**:
- Unit test: `getIntegrationStatus` returns correct state for each scenario (not configured, loading, connected, error)
- Manual UI: View dashboard with missing env, view client with no GA4, with GA4 error, with GA4 success, verify states

**Acceptance**: Dashboard shows friendly setup prompts instead of raw errors, client reporting shows clear integration states with last-fetch timestamps

---

### Phase 9: Automation Safety Visibility (P3, User Story 9)

**Objective**: Display workflow metadata (trigger, recipient, actions) and review state before enabling

**Approach**:
- Create WorkflowReview model or extend EmailFlow model with `trigger`, `recipientScope`, `knownActions`, `reviewStatus`, `reviewedBy`, `reviewedAt`
- Seed known workflows (BNI Cold Sourcing, etc) with metadata
- Update AutomationsWorkflowTable to display metadata
- Disable enable toggle for unreviewed workflows with warning message
- Show "Review required" indicator for workflows without reviewStatus=Reviewed

**Files**:
- `/packages/db/prisma/schema.prisma`: Extend EmailFlow or create WorkflowReview model
- `/apps/app/lib/server/actions/n8n-workflows.ts`: Extend `getAutomationsWorkflows` to include review metadata
- `/apps/app/components/automations/automations-workflow-table.tsx`: Display trigger, recipient, actions, review status
- `/apps/app/components/automations/workflow-review-card.tsx` (new): Review UI for admin to mark workflow as reviewed
- `/apps/app/app/dashboard/automations/page.tsx`: Add review flow UI if needed

**Tests**:
- Unit test: Enable toggle disabled when reviewStatus is null or Unreviewed
- Manual UI: View automations page with reviewed and unreviewed workflows, verify metadata display and toggle behavior

**Acceptance**: Automations page shows trigger/recipient/actions for reviewed workflows, "Review required" warning for unreviewed, enable toggle disabled for unreviewed

---

### Phase 10: British English, UK Dates, Currency Respect (Cross-cutting, P1-P3)

**Objective**: Ensure all new text uses British English, dates in UK format, currency without arbitrary dollars

**Approach**:
- Review all new UI text in forms, labels, messages, buttons
- Replace any US spellings (e.g. "organization" → "organisation")
- Use date display helper: `formatDateUK(date)` returning "DD/MM/YYYY" or "8 November 2026"
- Replace hardcoded "$" with `client.billingCurrency` or "£" as default
- No em dashes in new content (use commas, colons, or parentheses)

**Files**:
- All new/modified components from Phases 1-9
- `/apps/app/lib/utils.ts` or `/apps/app/lib/format.ts`: Add `formatDateUK` helper
- Review: forms, detail pages, error messages, empty states

**Tests**:
- Manual review: Inspect all new UI for British English spelling, UK date format, no em dashes
- Automated: Linter rule for em-dash detection (optional)

**Acceptance**: All new text uses British English, dates in UK format (DD/MM/YYYY or text), currency displays respect client settings, no em dashes

---

## Testing Strategy

### Unit Tests
- Package label mapping function
- Lead validation (owner, next action, follow-up)
- Client duplicate detection logic
- Task query filters (overdue, due today, upcoming)
- Integration status helper function
- GBP post approval invalidation logic

**Tools**: Vitest, run via `npx pnpm test` (if test script exists)

**Location**: `*.test.ts` files co-located with implementation or in `/apps/app/__tests__/`

### Integration Tests
- Create lead → deal → client flow with duplicate check
- Task creation linked to lead, visibility in client via lead relation
- GBP post draft → submit → approve → edit → status revert

**Tools**: Vitest with test database (isolated from production)

**Setup**: `TEST_DATABASE_URL` environment variable, seed test data

### Manual UI Testing
- Open each modified form/page with test data
- Verify labels, display formats, validation messages
- Test responsive layout (desktop + mobile viewport)
- Verify accessibility (keyboard navigation, screen reader labels)

**Browser**: Chrome/Firefox, localhost:3000

**Test data**: Seed script or manual creation via UI

## Rollout and Rollback

### Deployment Steps
1. Run migrations (after review and approval): `npx pnpm --filter @stky/db exec prisma migrate deploy`
2. Verify migration applied: Check Prisma migrations table
3. Deploy app to staging (Vercel preview or similar)
4. Manual smoke test on staging
5. Deploy to production (merge PR, auto-deploy via Vercel)
6. Monitor error logs and user feedback

### Rollback Procedure
- **Code rollback**: Revert PR merge, redeploy previous commit
- **Database rollback**: Migrations are additive with nullable fields, safe to leave in place; if necessary, manually remove columns (document SQL commands)
- **Data preservation**: No data deleted or modified by this implementation; rollback does not cause data loss

### Migration Rollback Commands (if needed)
```sql
-- Remove added columns (only if rollback required, not recommended)
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "ownerId";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "nextAction";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "followUpDate";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "notes";
-- Repeat for other additive columns if rolled back
```

**Note**: Rollback removes new functionality but preserves all existing data. Rolled-back columns' data remains in database unless explicitly dropped.

## Dependencies and Risks

### Dependencies
- Prisma CLI for migrations (already installed)
- Next.js App Router patterns (already in use)
- shadcn/ui components (already in use)
- Existing auth/permission system (reused, not modified)

### Risks
1. **Package mapping incorrect**: Mitigation: Verify mapping with user before implementation, add tests
2. **Client duplicate logic misses edge cases**: Mitigation: Test with various email formats, company names; document manual merge process for edge cases
3. **Migration breaks production**: Mitigation: Migrations are additive/nullable, no destructive changes; review SQL before execution
4. **Integration state logic complex**: Mitigation: Use simple enum states, thorough testing, fallback to "unknown" state
5. **Scope creep (subtasks, recurrence)**: Mitigation: Defer unless trivial; document as future enhancement

### Assumptions Needing Validation Before Implementation
- VOLTAGE/CHARGE/GRID → Minimum Stick/Extra Sticky/Totally Stuck mapping is correct (confirm with user)
- Client duplicate detection via email is sufficient (consider companiesHouseNumber as secondary key)
- Task notes field is sufficient (no rich text, attachments, or formatting needed)
- GBP post workflow does not require multi-step approval chain (single approve action sufficient)
- Workflow metadata can be seeded manually or fetched from n8n API (choose approach during implementation)

## Implementation Order

1. **Phase 1**: Package label mapping (quick win, high visibility)
2. **Phase 2**: Lead owner/next-action/follow-up (foundational for lifecycle management)
3. **Phase 3**: Lead lifecycle and duplicate prevention (depends on Phase 2 fields)
4. **Phase 4**: Today view (depends on Phase 2 tasks with due dates)
5. **Phase 5**: Task details and linking (independent, can run parallel with Phase 4)
6. **Phase 6**: Client workspace cohesion (depends on Phase 5 task linking)
7. **Phase 7**: GBP draft/review workflow (independent, lower priority)
8. **Phase 8**: Integration state clarity (independent, can run parallel with Phases 1-6)
9. **Phase 9**: Automation safety visibility (independent, lower priority)
10. **Phase 10**: British English/UK dates/currency (cross-cutting, review throughout)

**Estimated Phases**: 10 phases, ~2-3 phases per implementation iteration, convergence after each iteration

**Done Criteria**: All phases implemented, tests passing, PR created with acceptance checklist, manual review completed
