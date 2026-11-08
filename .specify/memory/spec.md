# Feature Specification: CRM User Experience and Data Integrity Improvements

**Feature Branch**: `cursor/crm-improvements-sdd-4c84`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User-approved CRM improvements focusing on agency package naming clarity, lead lifecycle management, task visibility, client workspace cohesion, GBP posting workflow, integration state transparency, and automation safety visibility.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Staff View Accurate Agency Package Names (Priority: P1)

When staff view lead conversion details or client package assignments, they see the correct tier names (Minimum Stick, Extra Sticky, Totally Stuck) instead of internal codes or incorrect labels, ensuring consistent communication with clients and accurate service delivery expectations.

**Why this priority**: Package naming directly impacts client communication and billing accuracy. Incorrect names cause confusion in proposals and invoices. This is visible in every lead conversion form, client detail page, and package selection dropdown.

**Independent Test**: Can be fully tested by viewing LeadConversionForm, EditClientPackageForm, CreateDealForm, and client/lead detail pages with test data covering all three packages plus None, and verifying display labels match intended names while database values remain VOLTAGE/CHARGE/GRID.

**Acceptance Scenarios**:

1. **Given** a lead with conversion package set to VOLTAGE, **When** staff view the lead detail page, **Then** the conversion package displays as "Minimum Stick"
2. **Given** staff editing a client's package, **When** the dropdown shows package options, **Then** options read "None", "Minimum Stick", "Extra Sticky", "Totally Stuck"
3. **Given** a client with package CHARGE, **When** staff view the client detail page, **Then** the package badge shows "Extra Sticky"
4. **Given** a deal with packageType GRID, **When** staff create/edit the deal, **Then** the form shows "Totally Stuck" as the selected value
5. **Given** legacy data with package None, **When** staff view or edit, **Then** "None" remains a valid selectable option without data corruption

---

### User Story 2 - Manage Lead Follow-Up and Ownership (Priority: P1)

Staff assign leads to team members, set next actions, and schedule follow-up dates to ensure no lead falls through the cracks. Lead owner, next action, and follow-up date are visible on lead list and detail views, editable with sensible validation (e.g. past dates flagged, required fields enforced for certain statuses).

**Why this priority**: Follow-up tracking is core CRM functionality. Without owner assignment and due dates, leads are lost and revenue opportunities missed. This addresses immediate pain points from user's observation of "lead owner, next action and follow-up date" missing visibility.

**Independent Test**: Can be fully tested by creating a lead, assigning owner/next-action/follow-up, viewing in list and detail, editing values, and verifying validation (e.g. cannot leave next-action blank when marking lead as Qualified, warning when follow-up date is in past).

**Acceptance Scenarios**:

1. **Given** a new lead in NEW status, **When** staff view the lead detail page, **Then** fields for Owner (staff dropdown), Next Action (text input), and Follow-Up Date (date picker) are visible and editable
2. **Given** a lead with no owner assigned, **When** staff filter lead list by "Unassigned", **Then** the lead appears in results
3. **Given** a lead with follow-up date of yesterday, **When** staff view the lead, **Then** a visual indicator (e.g. red highlight or icon) flags overdue follow-up
4. **Given** staff changing lead status to Qualified, **When** Next Action is blank, **Then** validation warns "Next Action recommended for Qualified leads" (soft validation, not blocking)
5. **Given** a lead with Owner set to Alice, **When** Alice views "My Leads" filter, **Then** the lead appears in her list

---

### User Story 3 - Explicit Lead Lifecycle Management (Priority: P1)

Staff convert leads through an explicit lifecycle: lead → opportunity/deal → client. Each stage preserves history and links. Converting a lead to a client creates a Client record without duplicating if one already exists (e.g. re-engagement). Pipeline clearly shows deals in each stage (New Lead, Qualified, Discovery Call, Proposal Sent, Negotiation, Won, Lost). Won deals optionally create or link to Client records.

**Why this priority**: Current pipeline shows "14 leads all NEW and 0 deals in every stage", indicating confusion about deal creation or lifecycle. Explicit conversion prevents duplicate clients and ensures deal history is preserved even when client relationship pre-exists.

**Independent Test**: Can be fully tested by: (1) creating a lead, (2) converting to deal at Qualified stage, (3) moving deal through stages, (4) marking Won and verifying Client creation or linking, (5) checking no duplicate clients created on re-conversion, (6) verifying lead history linked to client.

**Acceptance Scenarios**:

1. **Given** a lead in Qualified status, **When** staff click "Convert to Deal", **Then** a deal is created linked to the lead, and lead status updates to reflect conversion
2. **Given** a deal in Won stage, **When** staff complete the win (e.g. "Create Client" button), **Then** a Client record is created (or linked if client already exists) with lead/deal history preserved
3. **Given** an existing client "Acme Corp" with a past deal, **When** a new lead for Acme Corp is converted to deal and won, **Then** the new deal links to the existing Acme Corp client without creating a duplicate
4. **Given** staff viewing the pipeline page, **When** deals exist in various stages, **Then** each stage column shows accurate deal counts and cards
5. **Given** a lead with multiple deals (e.g. initial loss, re-engagement), **When** staff view lead detail, **Then** all linked deals are visible with history

---

### User Story 4 - Actionable Today View for Overdue and Due Items (Priority: P2)

Staff start their day with a Today view showing: overdue tasks, tasks due today, upcoming tasks this week, and opportunities/deals missing next actions. This surfaces work requiring immediate attention without manually checking each lead or task list.

**Why this priority**: "Actionable Today view for overdue/due/upcoming tasks and opportunities missing next actions" directly requested by user. Prevents missed deadlines and ensures proactive deal management. Not a weekly scoreboard (user explicitly doesn't want that), just a focused work queue.

**Independent Test**: Can be fully tested by creating tasks with various due dates (overdue, today, upcoming), creating deals without next actions, and verifying Today view displays them correctly categorized.

**Acceptance Scenarios**:

1. **Given** tasks with due dates yesterday, today, and next week, **When** staff navigate to Today view, **Then** overdue tasks appear in "Overdue" section, today's tasks in "Due Today", and upcoming in "This Week"
2. **Given** a deal in Proposal Sent stage with no next action set, **When** staff view Today view, **Then** the deal appears in "Needs Next Action" section
3. **Given** all tasks completed and all deals have next actions, **When** staff view Today view, **Then** a friendly empty state says "All caught up! No overdue items."
4. **Given** a task due today linked to Lead "Acme", **When** staff view Today view, **Then** the task shows linked lead name as a clickable link to lead detail
5. **Given** Today view items, **When** staff mark a task complete or update a deal's next action, **Then** the item disappears from Today view immediately

---

### User Story 5 - Comprehensive Task Details and Linking (Priority: P2)

Tasks display owner, due date, linked client/lead, status (pending/completed), and notes. Tasks can be created from lead or client pages and appear in relevant contexts (lead detail, client detail, owner's task list, Today view). Optional: subtasks and recurrence only if cohesive and feasible (not forced expansion).

**Why this priority**: Current task implementation shows basic title and completion, but lacks owner visibility, linked context on task list, and notes. User requested "task details with owner, due date, linked client/lead, status, notes" and "surface linked tasks from lead/client".

**Independent Test**: Can be fully tested by creating a task from a lead page with owner/due date/notes, viewing it in lead detail, client detail (if linked), assignee's task list, and Today view, and verifying all fields display correctly in each context.

**Acceptance Scenarios**:

1. **Given** staff viewing a lead detail page, **When** they create a task "Follow up on pricing" assigned to Bob with due date tomorrow and notes "Mention bulk discount", **Then** the task appears on lead detail, Bob's task list, and Tomorrow section of Today view, with all fields visible
2. **Given** a task linked to a client, **When** staff view the client's Overview tab, **Then** the task appears in a "Linked Tasks" section
3. **Given** staff viewing their personal task list, **When** tasks are linked to leads or clients, **Then** each task shows the linked entity name as a clickable link
4. **Given** staff editing a task, **When** they add notes "Client prefers email contact", **Then** the notes persist and display in task detail/list views
5. **Given** a completed task, **When** staff view task list, **Then** completed tasks show strikethrough or moved to a "Completed" section with completion date

---

### User Story 6 - Client Workspace Cohesion and SharePoint Metadata (Priority: P2)

Client detail page integrates: linked tasks (from Story 5), package/services (existing), recent activity (existing), and SharePoint document links with normal URL metadata (display URL, label, icon). Existing tabs (Site Builds, Package & Services, Details, Leads, Portal Users, Analytics, Business Profile, Google Ads, Invoices, Activity) remain. Extension adds task visibility and improves document link presentation.

**Why this priority**: User requested "improve existing client workspace cohesion: linked tasks, package/services, recent activity, normal SharePoint document URL metadata". This consolidates scattered information into one client view, reducing context switching.

**Independent Test**: Can be fully tested by viewing a client with linked tasks, documents, and existing tabs, verifying tasks display in overview, and document links show proper metadata (no live SharePoint connection required, uses mock URL data).

**Acceptance Scenarios**:

1. **Given** a client with 3 linked tasks, **When** staff view client Overview tab, **Then** tasks appear in a "Tasks" card with task title, assignee, due date, and link to lead if applicable
2. **Given** a client with SharePoint document links stored (e.g. proposal URL, brand guide URL), **When** staff view client Details tab, **Then** document links display with readable labels and icons (e.g. "Brand Guide" with document icon)
3. **Given** staff viewing client Activity tab, **When** recent activity includes task completion, **Then** activity log shows "Task completed: [task title]" entry
4. **Given** a client with no linked tasks, **When** staff view Overview, **Then** Tasks card shows empty state "No tasks yet" with "Create Task" button
5. **Given** existing client tabs (Analytics, Google Ads, Invoices), **When** staff navigate between tabs, **Then** all existing functionality remains unchanged (no regression)

---

### User Story 7 - Google Business Profile Draft and Review Workflow (Priority: P3)

Staff draft GBP posts with copy, intended date, CTA/link, and note image provenance/licence/permission. Posts require explicit approval before posting (not auto-sent). Editing approved content invalidates approval, requiring re-review. Text-only allowed (no image upload). No live connection during development (use mocks). Retain explicit review and side-effect safeguards.

**Why this priority**: User requested "add/complete safe draft/review workflow for post copy/intended date/CTA/link, image provenance/licence/permission and approval of exact version. Editing approved content invalidates approval." GBP posting has reputational risk; approval prevents accidental public mistakes.

**Independent Test**: Can be fully tested with mock GBP data by: (1) drafting a post, (2) submitting for approval, (3) approving, (4) editing post and verifying approval clears, (5) confirming no live API calls made during draft/approval flow.

**Acceptance Scenarios**:

1. **Given** staff viewing a client's Business Profile tab, **When** they click "Draft Post", **Then** a form appears for post copy (text), intended date, CTA type (Call/Learn More/Order/etc), CTA URL, and notes for image provenance
2. **Given** a draft post with all fields filled, **When** staff click "Submit for Approval", **Then** post status changes to "Pending Approval" and appears in approvers' queue
3. **Given** an approved post, **When** staff edit the post copy, **Then** post status reverts to "Draft" and approval is cleared
4. **Given** an approved post, **When** staff click "Schedule Post", **Then** the action is blocked with message "Live posting not implemented in development" (safe mock)
5. **Given** a draft post, **When** staff attempt to include an image upload, **Then** the UI blocks image upload with message "Text-only posts supported. Note image provenance in comments field instead."

---

### User Story 8 - Integration State Clarity (Priority: P3)

Dashboard and reporting pages distinguish: (1) not configured/not connected, (2) loading/fetching, (3) connected with no data, (4) error with diagnostic details, (5) last successful refresh timestamp where trustworthy. Replace raw env warning "UPTIME_KUMA_BASE_URL and STATUS_SLUG missing" with friendly setup UI while retaining admin diagnostics.

**Why this priority**: User observed "selected-client reporting said no Ads link/GSC credentials/GA4 credentials, not proven broken integration" and "dashboard exposed missing UPTIME_KUMA_BASE_URL raw warning". Clear state prevents staff chasing phantom errors and surfaces genuine setup needs.

**Independent Test**: Can be fully tested by: (1) viewing dashboard with missing UPTIME_KUMA env (shows setup UI, not raw error), (2) viewing client reporting with no GA4 connected (shows "Not configured" vs "Loading"), (3) simulating API error and verifying error message with details.

**Acceptance Scenarios**:

1. **Given** UPTIME_KUMA_BASE_URL is not set, **When** staff view Dashboard, **Then** System Status card shows "Configure Uptime Kuma monitoring" with link to setup guide (no raw env variable error)
2. **Given** a client with no GA4 credential, **When** staff view client reporting, **Then** status shows "Not configured" with "Connect GA4" button (not "Loading" or "Error")
3. **Given** a client with GA4 connected but API returns error, **When** staff view reporting, **Then** status shows "Error fetching data" with error detail (e.g. "Invalid refresh token") and "Last successful fetch: 2 days ago"
4. **Given** a client with GSC connected and data present, **When** staff view reporting, **Then** status shows "Connected" with green indicator and "Last updated: 5 minutes ago"
5. **Given** staff viewing Integrations page, **When** hovering over status icons, **Then** tooltips explain each state ("Connected", "Not configured", "Error: API key expired")

---

### User Story 9 - Automation Safety Visibility (Priority: P3)

Automations page shows known pre-enable details: trigger (e.g. "Lead Created", "Deal Stage Changed to Proposal Sent"), recipient scope (e.g. "All new leads", "Specific client: Acme Corp"), known actions (e.g. "Send email to lead", "Create task for Alice"), and approval/review state. Unknown or unreviewed workflows display warning "Review required before enabling". No live n8n API calls during development.

**Why this priority**: User observed "landing list has five inactive workflows and only toggles/names/Open n8n, no visible trigger/recipient/action/approval/run history" and requested "show known pre-enable triggers/recipient scope/side effects/review behaviour, don't fabricate metadata". Prevents accidental mass emails or data changes.

**Independent Test**: Can be fully tested with mock n8n workflow data by: (1) viewing automations list, (2) verifying known workflows show trigger/recipient/action, (3) confirming unknown workflows show "Review required" warning, (4) confirming enable toggle is disabled for unreviewed workflows.

**Acceptance Scenarios**:

1. **Given** a reviewed workflow "BNI Cold Sourcing", **When** staff view Automations page, **Then** workflow card shows trigger ("Manual"), recipient scope ("BNI leads tagged 'cold'"), known actions ("Send intro email template"), and review status ("Reviewed 2024-10-15 by Alice")
2. **Given** an unreviewed workflow "LinkedIn Buffer", **When** staff view Automations page, **Then** workflow card shows warning icon and "Review required before enabling" with details unavailable
3. **Given** staff viewing a reviewed workflow, **When** they hover over the enable toggle, **Then** tooltip shows "Enabling will trigger on: Lead Created. Recipients: All new leads. Actions: Send welcome email, create follow-up task."
4. **Given** an enabled automation, **When** staff view run history (future enhancement), **Then** history shows last run timestamp, trigger event, and outcome (success/failure)
5. **Given** staff attempting to enable an unreviewed workflow, **When** they click the toggle, **Then** action is blocked with modal "This workflow must be reviewed and approved before enabling. Open in n8n to review."

---

### Edge Cases

- What happens when a lead is converted to a deal but the client already exists with a different email? (Prompt staff to merge or confirm separate client)
- How does system handle follow-up date set to a past date? (Warning indicator, still allows save, surfaces in Today view as overdue)
- What if a client has multiple GBP locations? (Scope to single location per client in v1, multi-location as future enhancement)
- How are subtasks and recurrence handled if not feasible? (Document as deferred feature, implement only if cohesive with existing task model)
- What if SharePoint document URL is invalid or broken? (Display URL as-is, show broken link icon if fetch metadata fails, no auto-validation during save)
- How are package migrations handled if mapping changes? (Defer to explicit user-approved migration script, no automatic data reinterpretation)
- What happens when integration last-refresh timestamp is untrustworthy? (Omit timestamp, show "Status unknown, refresh to verify")

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST map PackageType enum values (VOLTAGE, CHARGE, GRID) to display labels (Minimum Stick, Extra Sticky, Totally Stuck) in all user-facing contexts (lead conversion form, client package form, deal form, detail pages, list views) while preserving stored enum values without alteration
- **FR-002**: System MUST support None/empty as a valid package selection alongside the three named tiers, without corrupting or reinterpreting existing None values
- **FR-003**: Lead model MUST include fields for owner (staff User reference), nextAction (text), and followUpDate (date), all optional to preserve backwards compatibility
- **FR-004**: Lead list and detail views MUST display owner, nextAction, and followUpDate with edit capability and visual indicators for overdue/missing values
- **FR-005**: System MUST validate nextAction presence when transitioning lead to certain statuses (soft validation, not blocking) and warn when followUpDate is in the past
- **FR-006**: System MUST provide explicit lead-to-deal conversion flow that creates Deal record linked to Lead without duplicating Client if client already exists (match by email or company identifier)
- **FR-007**: Pipeline view MUST accurately display deal counts per stage and support deal stage transitions via UI (existing PipelineKanban component extended as needed)
- **FR-008**: System MUST provide Today view page aggregating: overdue tasks, tasks due today, tasks due this week, and deals/opportunities missing next actions, with linked lead/client context
- **FR-009**: Task model MUST support notes field (text, optional) and display owner, due date, linked lead/client, status (completed boolean), and notes in all task contexts (lead detail, client detail, task list, Today view)
- **FR-010**: Client detail page MUST display linked tasks in Overview tab with create/edit capability and proper empty state messaging
- **FR-011**: SharePoint document links (if stored in client record) MUST display with readable labels and URL metadata (title, icon) without requiring live SharePoint API access (uses stored metadata or graceful fallback)
- **FR-012**: System MUST provide GBP post draft form with fields: copy (text), intendedDate (date), ctaType (dropdown), ctaUrl (URL), and imageProvenance (text notes), with status (Draft/Pending Approval/Approved/Posted)
- **FR-013**: GBP post approval MUST be explicit (button action) and invalidate when post is edited after approval (status reverts to Draft)
- **FR-014**: System MUST block image upload for GBP posts with clear message (text-only supported) and prevent live posting during development (mock/placeholder action with safety message)
- **FR-015**: Integration status displays (Dashboard System Status card, client Analytics/Ads/GSC cards, reporting pages) MUST distinguish: not configured, loading, connected (with last refresh timestamp), error (with diagnostic message)
- **FR-016**: Raw environment variable warnings (e.g. UPTIME_KUMA_BASE_URL missing) MUST be replaced with friendly setup UI ("Configure monitoring" with link to docs) while admin diagnostic mode retains raw details
- **FR-017**: Automations page MUST display workflow metadata: trigger event, recipient scope, known actions, review/approval status, and enable toggle disabled for unreviewed workflows
- **FR-018**: System MUST show warning "Review required before enabling" for workflows with unknown or unreviewed metadata and provide "Open in n8n" link for review
- **FR-019**: All new user-facing text MUST use British English spelling (e.g. "organisation", "colour", "summarise") and avoid em dashes
- **FR-020**: All date displays MUST use unambiguous UK formats (DD/MM/YYYY or "8 November 2026") and currency displays MUST respect configured currency without arbitrary dollar symbol relabelling
- **FR-021**: System MUST preserve all existing data (lead source legacy values like "Internet", client package assignments, task data, client records) without modification or silent conversion during implementation
- **FR-022**: All schema changes (if any) MUST be additive and backwards-compatible with documented rollback procedures, never executed on production database during development
- **FR-023**: All server actions handling CRM mutations MUST retain existing tenant/auth checks and scoped permission validation (no permission bypasses introduced)
- **FR-024**: System MUST use isolated test database for any database-dependent tests, never production DATABASE_URL, and verify isolation before test execution

### Key Entities

- **Lead**: Existing entity extended with owner (User FK), nextAction (string, nullable), followUpDate (DateTime, nullable). Relationships: deals (Deal[]), tasks (Task[]), client (Client, nullable)
- **Deal**: Existing entity with stage (enum), packageType (PackageType, nullable), lead (Lead FK). Display labels for packageType mapped per FR-001. No structural changes to Deal model itself.
- **Task**: Existing entity extended with notes (string, nullable). Relationships: lead (Lead FK, nullable), assignee (User FK, nullable), dueDate (DateTime, nullable), completed (boolean)
- **Client**: Existing entity. Relationships: leads (Lead[]), tasks (Task[], via lead linkage), siteBuilds, activityLogs. SharePoint document links modeled as JSON field or separate Document model if needed (to be determined in planning phase)
- **GBPPost** (new or extended): Fields: clientId (FK), copy (text), intendedDate (date), ctaType (enum or string), ctaUrl (string, nullable), imageProvenance (text, nullable), status (enum: Draft, PendingApproval, Approved, Posted), approvedAt (DateTime, nullable), approvedBy (User FK, nullable)
- **WorkflowMetadata** (new or virtual): Represents n8n workflow metadata for display. Fields: workflowId (n8n ID), name, trigger (string), recipientScope (string), actions (string[]), reviewStatus (enum: Unreviewed, Reviewed, Approved), reviewedAt, reviewedBy. Source: stored in DB or fetched from n8n API and cached (to be determined in planning phase)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Staff viewing any lead conversion form, client package form, or deal form see correct tier names (Minimum Stick, Extra Sticky, Totally Stuck) instead of VOLTAGE/CHARGE/GRID, verified by manual UI inspection across all forms
- **SC-002**: Staff can assign lead owner, set next action, and schedule follow-up date for any lead, with overdue/missing indicators visible on lead list and detail pages within 2 clicks
- **SC-003**: Staff can convert a lead to a deal and subsequently to a client without creating duplicate client records when client already exists, verified by database query showing single Client record for repeat conversions
- **SC-004**: Today view accurately displays all overdue tasks, tasks due today, upcoming tasks this week, and deals missing next actions, refreshed on every page load with correct linked lead/client context
- **SC-005**: Tasks created from lead or client pages display owner, due date, linked entity, status, and notes in all relevant views (lead detail, client detail, task list, Today view) without data loss
- **SC-006**: Client Overview tab shows linked tasks, package/services, and recent activity in a cohesive layout, with existing tabs (Site Builds, Details, Analytics, etc) unchanged and fully functional
- **SC-007**: GBP post draft form prevents image upload, requires explicit approval before posting, and invalidates approval when post is edited, verified by status transitions and blocked live posting action
- **SC-008**: Dashboard and reporting pages show clear integration states (not configured, loading, connected, error) with last-refresh timestamps where applicable, replacing raw env variable errors with friendly setup prompts
- **SC-009**: Automations page displays trigger/recipient/action metadata for reviewed workflows and shows "Review required" warning with disabled enable toggle for unreviewed workflows
- **SC-010**: All new user-facing text uses British English, dates display in UK format, and no em dashes appear in UI labels or messages, verified by manual inspection of modified UI components

## Assumptions

- VOLTAGE/CHARGE/GRID → Minimum Stick/Extra Sticky/Totally Stuck mapping is the intended display mapping confirmed by user and verified against existing code/types/history before implementation begins
- Lead owner field allows null (unassigned leads supported) and dropdown shows all staff users where isStaff is true
- Next action is free text (not enum) to allow flexibility, with optional validation prompts at certain status transitions
- Follow-up date in past is allowed (for historical tracking) but flagged with visual warning
- Client duplication check matches on primaryContactEmail (case-insensitive) or companiesHouseNumber if present; manual merge UI is future enhancement
- Today view is a new dashboard route (e.g. /dashboard/today) accessible from main navigation
- Task notes field is optional and does not require approval workflow (unlike GBP posts)
- Subtasks and recurrence are deferred to future enhancement unless discovered to be trivial during planning phase
- SharePoint document links are stored as JSON array in Client model or separate ClientDocument table (to be determined in planning phase based on existing patterns)
- GBP post status transitions (Draft → Pending → Approved → Posted) managed in DB, no external GBP API calls during development
- Workflow metadata for automations page sourced from n8n REST API `/api/v1/workflows` (mocked during development) or pre-seeded in DB for known workflows
- Integration state "last refresh" timestamps stored per-credential (AnalyticsCredential, GoogleAdsConnection, XeroCredential) and updated on successful API fetch
- UK date format preference configured per-user or globally in app settings (use browser locale with UK fallback if no preference stored)
- Currency display respects Client.billingCurrency field without hardcoded dollar symbols; new currency displays infer from package or client settings
- No production credentials (DATABASE_URL, N8N_API_KEY, GOOGLE_ADS_REFRESH_TOKEN, etc) used in development environment; test env uses isolated secrets
- Existing lead source legacy values (e.g. "Internet") must remain valid and editable via LeadSourceFields component without silent conversion to OTHER or empty
- Package field in Lead model (if it exists) is separate from LeadConversion.package and Client.package; all three may coexist independently (to be verified in planning phase)
- Lint (turbo lint), typecheck (turbo build with TS strict mode), and test commands (if present) are run before PR and results documented with exact output
- PR created against `main` branch using ManagePullRequest tool with summary, acceptance criteria, testing notes, and manual review checklist
- No merge, deploy, or auto-merge actions taken; user will review and merge manually after approval
