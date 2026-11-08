# Implementation Tasks: CRM User Experience and Data Integrity Improvements

**Plan Reference**: `.specify/memory/plan.md`

**Feature Branch**: `cursor/crm-improvements-sdd-4c84`

**Status**: Ready for Implementation

## Task Checklist

### Phase 1: Package Label Mapping ✅ PRIORITY

**Objective**: Display correct tier names in all UI contexts

- [ ] **Task 1.1**: Create package display mapping constant
  - **File**: `/packages/crm/src/index.ts`
  - **Action**: Add `PACKAGE_DISPLAY_LABELS` constant mapping VOLTAGE→"Minimum Stick", CHARGE→"Extra Sticky", GRID→"Totally Stuck", null→"None"
  - **Acceptance**: Constant exported and typed correctly
  
- [ ] **Task 1.2**: Update EditClientPackageForm labels
  - **File**: `/apps/app/components/crm/edit-client-package-form.tsx`
  - **Action**: Replace `PACKAGE_OPTIONS` labels (lines 10-13) with display labels from mapping, keep values unchanged
  - **Acceptance**: Dropdown shows "Minimum Stick", "Extra Sticky", "Totally Stuck", "None"
  
- [ ] **Task 1.3**: Update LeadConversionForm labels
  - **File**: `/apps/app/components/crm/lead-conversion-form.tsx`
  - **Action**: Replace `PACKAGE_OPTIONS` labels (lines 10-14) with display labels, keep values unchanged
  - **Acceptance**: Package dropdown shows correct tier names
  
- [ ] **Task 1.4**: Update CreateDealForm labels
  - **File**: `/apps/app/components/crm/create-deal-form.tsx`
  - **Action**: Replace hardcoded package option labels (lines 101-105) with mapped values
  - **Acceptance**: Deal package dropdown shows correct tier names
  
- [ ] **Task 1.5**: Update lead detail page package display
  - **File**: `/apps/app/app/dashboard/leads/[id]/page.tsx`
  - **Action**: Replace `PACKAGE_LABELS` constant (lines 13-17) with imported mapping
  - **Acceptance**: Conversion package displays as "Minimum Stick" etc
  
- [ ] **Task 1.6**: Update client detail page package display
  - **File**: `/apps/app/app/dashboard/clients/[id]/page.tsx`
  - **Action**: Replace `PACKAGE_LABELS` constant (lines 10-13) with imported mapping
  - **Acceptance**: Client package badge shows correct tier name
  
- [ ] **Task 1.7**: Write unit tests for mapping
  - **File**: `/packages/crm/src/__tests__/package-labels.test.ts` (new)
  - **Action**: Test mapping function returns correct labels for each enum value plus null/undefined
  - **Acceptance**: Tests pass, coverage for all package values
  
- [ ] **Task 1.8**: Manual UI verification
  - **Action**: Open each form/page with test data (VOLTAGE, CHARGE, GRID, null), verify labels
  - **Acceptance**: All forms display "Minimum Stick", "Extra Sticky", "Totally Stuck", "None" correctly, database values unchanged

---

### Phase 2: Lead Owner, Next Action, Follow-Up Date ✅ PRIORITY

**Objective**: Add assignment and follow-up tracking to leads

- [ ] **Task 2.1**: Extend Lead model schema
  - **File**: `/packages/db/prisma/schema.prisma`
  - **Action**: Add to Lead model: `ownerId String?`, `owner User? @relation(...)`, `nextAction String?`, `followUpDate DateTime?`, add index on ownerId
  - **Acceptance**: Schema compiles, migration generated (not executed)
  
- [ ] **Task 2.2**: Generate and document migration
  - **Command**: `npx pnpm --filter @stky/db exec prisma migrate dev --name lead_owner_next_action_followup --create-only`
  - **Action**: Review generated SQL, document rollback command, commit migration file
  - **Acceptance**: Migration file present in `/packages/db/prisma/migrations/`, rollback documented in plan
  
- [ ] **Task 2.3**: Update CreateLeadForm with new fields
  - **File**: `/apps/app/components/crm/create-lead-form.tsx`
  - **Action**: Add owner dropdown (fetch staff users), nextAction textarea, followUpDate date input after existing fields
  - **Acceptance**: Form includes 3 new fields, all optional
  
- [ ] **Task 2.4**: Update UpdateLeadForm with new fields
  - **File**: `/apps/app/components/crm/update-lead-form.tsx`
  - **Action**: Add owner dropdown, nextAction textarea, followUpDate date input with lead defaults
  - **Acceptance**: Existing lead data populates new fields, editable
  
- [ ] **Task 2.5**: Update createLead server action
  - **File**: `/apps/app/lib/server/actions/leads.ts`
  - **Action**: Extend `createLead` to accept ownerId, nextAction, followUpDate, add Zod validation
  - **Acceptance**: Action persists new fields, validates types
  
- [ ] **Task 2.6**: Update updateLead server action
  - **File**: `/apps/app/lib/server/actions/leads.ts`
  - **Action**: Extend `updateLead` to accept new fields, preserve existing if not provided
  - **Acceptance**: Partial updates work, new fields optional
  
- [ ] **Task 2.7**: Add fields to lead detail page
  - **File**: `/apps/app/app/dashboard/leads/[id]/page.tsx`
  - **Action**: Display owner (name), nextAction, followUpDate in lead header or info card, add overdue badge if followUpDate < today
  - **Acceptance**: Fields visible on lead detail, overdue indicator shows when applicable
  
- [ ] **Task 2.8**: Extend lead list view columns
  - **File**: `/apps/app/app/dashboard/leads/page.tsx`
  - **Action**: Add Owner and Follow-Up columns to lead list table, optionally add filter for unassigned/overdue
  - **Acceptance**: List shows owner and follow-up date, sortable/filterable
  
- [ ] **Task 2.9**: Add soft validation for next action
  - **File**: `/apps/app/components/crm/update-lead-form.tsx` or validation helper
  - **Action**: When status changes to Qualified, show warning if nextAction blank (not blocking)
  - **Acceptance**: Warning appears but form submits successfully
  
- [ ] **Task 2.10**: Write validation tests
  - **File**: `/apps/app/lib/server/actions/__tests__/leads.test.ts`
  - **Action**: Test createLead and updateLead with new fields, null handling, valid staff IDs
  - **Acceptance**: Tests pass, coverage for success and null cases
  
- [ ] **Task 2.11**: Manual UI test
  - **Action**: Create lead with owner/next-action/follow-up, update values, verify display and persistence
  - **Acceptance**: Fields work end-to-end, overdue indicator correct

---

### Phase 3: Lead Lifecycle and Duplicate Prevention ✅ PRIORITY

**Objective**: Formalize conversion flow with duplicate check

- [ ] **Task 3.1**: Review existing deal creation flow
  - **Files**: `/apps/app/components/crm/create-deal-form.tsx`, `/apps/app/lib/server/actions/deals.ts`
  - **Action**: Verify deal links to lead correctly, stage assignment works
  - **Acceptance**: Existing flow documented, no regressions
  
- [ ] **Task 3.2**: Implement client duplicate detection helper
  - **File**: `/apps/app/lib/server/actions/clients.ts`
  - **Action**: Add `findOrCreateClientFromDeal(dealId)` function: query Client by email (case-insensitive) or companiesHouseNumber, return existing or create new
  - **Acceptance**: Helper returns correct client, no duplicates created
  
- [ ] **Task 3.3**: Create deal-to-client conversion component
  - **File**: `/apps/app/components/crm/deal-to-client-conversion.tsx` (new)
  - **Action**: Button "Convert to Client" on Won deal card/detail, calls findOrCreateClientFromDeal, updates deal.clientId
  - **Acceptance**: Conversion UI works, links deal to client
  
- [ ] **Task 3.4**: Update pipeline view to show accurate counts
  - **File**: `/apps/app/app/dashboard/pipeline/page.tsx`
  - **Action**: Verify getDealsByStage returns correct counts per stage, display in PipelineKanban
  - **Acceptance**: Each stage shows accurate deal count
  
- [ ] **Task 3.5**: Enhance lead detail to show linked deals
  - **File**: `/apps/app/app/dashboard/leads/[id]/page.tsx`
  - **Action**: Add "Deals" section showing all lead.deals with stage and value
  - **Acceptance**: Multiple deals for one lead are visible with history
  
- [ ] **Task 3.6**: Write duplicate detection tests
  - **File**: `/apps/app/lib/server/actions/__tests__/clients.test.ts`
  - **Action**: Test findOrCreateClientFromDeal with matching email returns existing, no match creates new
  - **Acceptance**: Tests pass, no duplicates in test DB
  
- [ ] **Task 3.7**: Integration test for full lifecycle
  - **File**: `/apps/app/__tests__/integration/lead-lifecycle.test.ts` (new)
  - **Action**: Create lead → deal → win → convert to client → repeat with same email → verify single client
  - **Acceptance**: Test passes, single client record in DB
  
- [ ] **Task 3.8**: Manual UI test
  - **Action**: Create lead, convert to deal, move through stages, win, convert to client, check no duplicates
  - **Acceptance**: Client detail shows linked lead/deal, no duplicate clients created

---

### Phase 4: Today View ✅ PRIORITY (High Value)

**Objective**: Actionable dashboard for overdue and due items

- [ ] **Task 4.1**: Create getTodayItems server action
  - **File**: `/apps/app/lib/server/actions/today.ts` (new)
  - **Action**: Query tasks where dueDate < today (overdue), == today (due), between today and +7 days (upcoming), include lead/assignee
  - **Acceptance**: Function returns categorized tasks
  
- [ ] **Task 4.2**: Add deals needing next action to getTodayItems
  - **File**: `/apps/app/lib/server/actions/today.ts`
  - **Action**: Query deals where stage NOT IN ['WON', 'LOST'] AND lead.nextAction IS NULL, include lead/client info
  - **Acceptance**: Function returns deals missing next actions
  
- [ ] **Task 4.3**: Create Today view page
  - **File**: `/apps/app/app/dashboard/today/page.tsx` (new)
  - **Action**: Fetch getTodayItems, render sections: Overdue, Due Today, This Week, Needs Next Action with links
  - **Acceptance**: Page displays 4 sections with items
  
- [ ] **Task 4.4**: Create TodayView component
  - **File**: `/apps/app/components/dashboard/today-view.tsx` (new)
  - **Action**: Render task/deal items grouped by section, link to lead/client/deal detail, show empty state
  - **Acceptance**: Component displays items with links, empty state when no items
  
- [ ] **Task 4.5**: Add Today nav link
  - **File**: `/apps/app/components/dashboard/mobile-dashboard-shell.tsx` or layout
  - **Action**: Add "Today" link to dashboard navigation
  - **Acceptance**: Today link visible and navigates correctly
  
- [ ] **Task 4.6**: Write query tests
  - **File**: `/apps/app/lib/server/actions/__tests__/today.test.ts`
  - **Action**: Test getTodayItems returns correct items for each date range, empty when no items
  - **Acceptance**: Tests pass, coverage for all sections
  
- [ ] **Task 4.7**: Manual UI test
  - **Action**: Create tasks with overdue/due/upcoming dates, create deal without next action, verify Today view displays all
  - **Acceptance**: All sections populated correctly, links work

---

### Phase 5: Task Details and Linking

**Objective**: Add notes and improve task visibility

- [ ] **Task 5.1**: Extend Task model with notes
  - **File**: `/packages/db/prisma/schema.prisma`
  - **Action**: Add `notes String?` to Task model
  - **Acceptance**: Schema compiles, migration generated
  
- [ ] **Task 5.2**: Generate migration for task notes
  - **Command**: `npx pnpm --filter @stky/db exec prisma migrate dev --name task_notes --create-only`
  - **Action**: Review SQL, document rollback
  - **Acceptance**: Migration file created
  
- [ ] **Task 5.3**: Update CreateTaskForm with notes
  - **File**: `/apps/app/components/crm/create-task-form.tsx`
  - **Action**: Add notes textarea field after title/due date
  - **Acceptance**: Form includes notes field
  
- [ ] **Task 5.4**: Update task server actions
  - **File**: `/apps/app/lib/server/actions/tasks.ts`
  - **Action**: Extend createTask to accept notes, persist in DB
  - **Acceptance**: Notes saved and retrieved
  
- [ ] **Task 5.5**: Display notes in PersonalTaskList
  - **File**: `/apps/app/components/dashboard/personal-task-list.tsx`
  - **Action**: Show task.notes below title if present
  - **Acceptance**: Notes visible in task list
  
- [ ] **Task 5.6**: Display notes in lead detail tasks
  - **File**: `/apps/app/app/dashboard/leads/[id]/page.tsx`
  - **Action**: Include notes in task display
  - **Acceptance**: Task notes visible on lead detail
  
- [ ] **Task 5.7**: Create ClientTasksCard component
  - **File**: `/apps/app/components/crm/client-tasks-card.tsx` (new)
  - **Action**: Query tasks linked to client via leads, display in card with owner/due/notes
  - **Acceptance**: Component shows client's linked tasks
  
- [ ] **Task 5.8**: Add ClientTasksCard to client overview
  - **File**: `/apps/app/app/dashboard/clients/[id]/page.tsx`
  - **Action**: Insert <ClientTasksCard> in overview tab
  - **Acceptance**: Client overview shows linked tasks
  
- [ ] **Task 5.9**: Update getClientById to include tasks
  - **File**: `/apps/app/lib/server/actions/clients.ts`
  - **Action**: Include leads.tasks relation in query
  - **Acceptance**: Client data includes tasks via leads
  
- [ ] **Task 5.10**: Write task tests
  - **File**: `/apps/app/lib/server/actions/__tests__/tasks.test.ts`
  - **Action**: Test createTask with notes, verify persistence
  - **Acceptance**: Tests pass
  
- [ ] **Task 5.11**: Manual UI test
  - **Action**: Create task with notes on lead, verify appears in client detail
  - **Acceptance**: Notes visible in all contexts

---

### Phase 6: Client Workspace Cohesion

**Objective**: Integrate tasks and documents in client detail

- [ ] **Task 6.1**: Assess SharePoint document storage
  - **Files**: Client model in schema, existing client detail page
  - **Action**: Check if documents JSON field exists or needs ClientDocument model
  - **Acceptance**: Decision documented: use JSON field or new model
  
- [ ] **Task 6.2**: Create ClientDocumentsCard component (if needed)
  - **File**: `/apps/app/components/crm/client-documents-card.tsx` (new)
  - **Action**: Parse client.documents JSON or query ClientDocument, display links with labels/icons
  - **Acceptance**: Component renders document links
  
- [ ] **Task 6.3**: Add ClientDocumentsCard to client Details tab
  - **File**: `/apps/app/app/dashboard/clients/[id]/page.tsx`
  - **Action**: Insert <ClientDocumentsCard> if documents present
  - **Acceptance**: Documents visible on Details tab
  
- [ ] **Task 6.4**: Manual UI test with mock documents
  - **Action**: Seed client with mock document JSON, verify display
  - **Acceptance**: Documents show with labels, no live API calls

---

### Phase 7: GBP Draft and Review Workflow

**Objective**: Safe post approval flow

- [ ] **Task 7.1**: Verify GBPPost model schema
  - **File**: `/packages/db/prisma/schema.prisma`
  - **Action**: Check if status, approvedAt, approvedBy fields exist, add if missing
  - **Acceptance**: Schema includes approval fields
  
- [ ] **Task 7.2**: Create GBPPostDraftForm component
  - **File**: `/apps/app/components/gbp/gbp-post-draft-form.tsx` (new)
  - **Action**: Form with copy, intendedDate, ctaType, ctaUrl, imageProvenance, submit for approval button
  - **Acceptance**: Draft form works, blocks image upload
  
- [ ] **Task 7.3**: Create GBP post server actions
  - **File**: `/apps/app/lib/server/actions/gbp-posts.ts` (new)
  - **Action**: createDraft, submitForApproval, approveDraft, editPost (clears approval)
  - **Acceptance**: Actions handle status transitions
  
- [ ] **Task 7.4**: Create approval UI component
  - **File**: `/apps/app/components/gbp/gbp-post-approval-card.tsx` (new)
  - **Action**: Display pending posts, approve button for staff
  - **Acceptance**: Approval flow works
  
- [ ] **Task 7.5**: Integrate GBP UI into Business Profile page
  - **File**: `/apps/app/app/dashboard/business-profile/page.tsx`
  - **Action**: Add draft form and approval card
  - **Acceptance**: GBP workflow accessible from dashboard
  
- [ ] **Task 7.6**: Write approval invalidation tests
  - **File**: `/apps/app/lib/server/actions/__tests__/gbp-posts.test.ts`
  - **Action**: Test editPost clears approvedAt/approvedBy
  - **Acceptance**: Tests pass
  
- [ ] **Task 7.7**: Manual UI test
  - **Action**: Draft → submit → approve → edit → verify approval cleared
  - **Acceptance**: Approval invalidated on edit, no live posting

---

### Phase 8: Integration State Clarity

**Objective**: Clear status for integrations

- [ ] **Task 8.1**: Extend credential models with status fields
  - **File**: `/packages/db/prisma/schema.prisma`
  - **Action**: Add lastFetchedAt, lastError to AnalyticsCredential, GoogleAdsConnection, XeroCredential
  - **Acceptance**: Schema updated
  
- [ ] **Task 8.2**: Create getIntegrationStatus helper
  - **File**: `/apps/app/lib/integrations/status.ts` (new)
  - **Action**: Function returns { state, message, lastFetch } for given credential
  - **Acceptance**: Helper returns correct states
  
- [ ] **Task 8.3**: Update UptimeStatusCard for friendly error
  - **File**: `/apps/app/components/dashboard/uptime-status-card.tsx`
  - **Action**: Replace raw env error with "Configure Uptime Kuma" setup prompt
  - **Acceptance**: Friendly UI shown when env missing
  
- [ ] **Task 8.4**: Update client Analytics card status
  - **File**: `/apps/app/app/dashboard/clients/[id]/page.tsx`
  - **Action**: Use getIntegrationStatus for GA4/GSC, display state and last fetch
  - **Acceptance**: Clear status with timestamp
  
- [ ] **Task 8.5**: Update client Google Ads card status
  - **File**: `/apps/app/app/dashboard/clients/[id]/page.tsx`
  - **Action**: Use getIntegrationStatus for Ads connection
  - **Acceptance**: Clear status displayed
  
- [ ] **Task 8.6**: Update analytics fetch actions
  - **File**: `/apps/app/lib/server/actions/analytics.ts`
  - **Action**: Set lastFetchedAt on success, lastError on failure
  - **Acceptance**: Timestamps updated after fetch
  
- [ ] **Task 8.7**: Write status helper tests
  - **File**: `/apps/app/lib/integrations/__tests__/status.test.ts`
  - **Action**: Test all state scenarios (not configured, connected, error)
  - **Acceptance**: Tests pass
  
- [ ] **Task 8.8**: Manual UI test
  - **Action**: View dashboard with missing env, client with no GA4, client with GA4 error
  - **Acceptance**: States clear and distinct

---

### Phase 9: Automation Safety Visibility

**Objective**: Show workflow metadata and review state

- [ ] **Task 9.1**: Extend EmailFlow model or create WorkflowReview
  - **File**: `/packages/db/prisma/schema.prisma`
  - **Action**: Add trigger, recipientScope, knownActions, reviewStatus, reviewedBy, reviewedAt to EmailFlow
  - **Acceptance**: Schema supports review metadata
  
- [ ] **Task 9.2**: Seed known workflows with metadata
  - **File**: `/packages/db/seed.ts` or manual SQL
  - **Action**: Populate metadata for BNI Cold Sourcing, LinkedIn Buffer, etc
  - **Acceptance**: Known workflows have metadata
  
- [ ] **Task 9.3**: Update getAutomationsWorkflows action
  - **File**: `/apps/app/lib/server/actions/n8n-workflows.ts`
  - **Action**: Include review metadata in returned workflows
  - **Acceptance**: Action returns trigger/recipient/actions/review status
  
- [ ] **Task 9.4**: Update AutomationsWorkflowTable component
  - **File**: `/apps/app/components/automations/automations-workflow-table.tsx`
  - **Action**: Display trigger, recipient, actions, review status, disable toggle for unreviewed
  - **Acceptance**: Metadata visible, toggle disabled for unreviewed
  
- [ ] **Task 9.5**: Create workflow review UI (optional)
  - **File**: `/apps/app/components/automations/workflow-review-card.tsx` (new)
  - **Action**: Admin UI to mark workflow as reviewed
  - **Acceptance**: Review flow works
  
- [ ] **Task 9.6**: Write enable toggle tests
  - **File**: `/apps/app/components/automations/__tests__/workflow-table.test.ts`
  - **Action**: Test toggle disabled when reviewStatus unreviewed
  - **Acceptance**: Tests pass
  
- [ ] **Task 9.7**: Manual UI test
  - **Action**: View automations page with reviewed and unreviewed workflows
  - **Acceptance**: Metadata displays, toggle behavior correct

---

### Phase 10: British English, UK Dates, Currency

**Objective**: Language and format consistency

- [ ] **Task 10.1**: Create formatDateUK helper
  - **File**: `/apps/app/lib/format.ts` or utils
  - **Action**: Function returns "DD/MM/YYYY" or "8 November 2026" for date
  - **Acceptance**: Helper formats dates correctly
  
- [ ] **Task 10.2**: Review all new UI text for British English
  - **Files**: All modified components
  - **Action**: Replace US spellings, remove em dashes
  - **Acceptance**: All text uses British English
  
- [ ] **Task 10.3**: Replace hardcoded dollar symbols
  - **Files**: Deal forms, client detail, package displays
  - **Action**: Use client.billingCurrency or £ default instead of $
  - **Acceptance**: Currency displays respect settings
  
- [ ] **Task 10.4**: Apply formatDateUK to all date displays
  - **Files**: Task lists, lead detail, client detail, Today view
  - **Action**: Replace toLocaleDateString() with formatDateUK
  - **Acceptance**: Dates in UK format
  
- [ ] **Task 10.5**: Manual review of all new text
  - **Action**: Check forms, labels, messages, empty states
  - **Acceptance**: No US spellings, no em dashes, UK dates, correct currency

---

### Final Tasks: Testing and PR

- [ ] **Task F.1**: Run lint check
  - **Command**: `npx pnpm lint`
  - **Acceptance**: No lint errors in modified files
  
- [ ] **Task F.2**: Run typecheck
  - **Command**: `npx pnpm build` (or `npx tsc --noEmit`)
  - **Acceptance**: No TypeScript errors
  
- [ ] **Task F.3**: Run unit/integration tests
  - **Command**: `npx pnpm test` (if test script exists)
  - **Acceptance**: All tests pass
  
- [ ] **Task F.4**: Manual smoke test desktop
  - **Action**: Test each modified page/form on desktop viewport
  - **Acceptance**: All features work, no visual regressions
  
- [ ] **Task F.5**: Manual smoke test mobile
  - **Action**: Test key pages on mobile viewport (Today view, lead list, client detail)
  - **Acceptance**: Responsive layout works
  
- [ ] **Task F.6**: Document test results
  - **File**: `/workspace/.specify/memory/test-results.md` (new)
  - **Action**: Record lint/typecheck/test output, manual test findings
  - **Acceptance**: Evidence documented
  
- [ ] **Task F.7**: Commit all changes
  - **Command**: `git add -A && git commit -m "feat: CRM improvements per Spec Kit workflow"`
  - **Acceptance**: All files committed to branch
  
- [ ] **Task F.8**: Push branch
  - **Command**: `git push -u origin cursor/crm-improvements-sdd-4c84`
  - **Acceptance**: Branch pushed to remote
  
- [ ] **Task F.9**: Create pull request
  - **Tool**: ManagePullRequest
  - **Action**: Create PR with title, body from spec, acceptance checklist
  - **Acceptance**: PR created, URL returned
  
- [ ] **Task F.10**: Document rollback procedures
  - **File**: `/workspace/.specify/memory/rollback.md` (new)
  - **Action**: Document migration rollback commands, feature flags if any
  - **Acceptance**: Rollback steps clear

---

## Implementation Notes

**Order**: Execute tasks sequentially within each phase, phases can be partially parallelized (1-2-3 sequential, 4-5-6 parallel after 2, 7-8-9 anytime, 10 cross-cutting)

**Testing**: Run task tests after each task, integration tests after each phase, final tests before PR

**Safety**: No production DB writes during development, verify TEST_DATABASE_URL set before any migrations/tests

**Done Criteria**: All tasks checked, all tests passing, PR created with acceptance checklist, manual review completed

**Convergence**: After implementation, run Spec Kit converge to verify completeness and append remaining work
