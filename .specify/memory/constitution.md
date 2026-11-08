# StickySites CRM Constitution

## Core Principles

### I. Data Integrity and Safety (NON-NEGOTIABLE)
Production data is sacred. All CRM content, lead records, task assignments, client information, package selections, and service configurations must be preserved without modification. Schema changes must be backwards-compatible and additive only, with explicit migration paths and rollback procedures documented. No production database writes, migrations, or API calls that affect live data are permitted during development. Testing uses isolated test databases and synthetic fixtures only.

### II. Semantic Preservation
Database enum values (VOLTAGE, CHARGE, GRID) and persisted source strings represent committed data contracts. Display labels may be mapped for UI presentation, but stored values must never be reinterpreted, silently converted, or assigned new meanings without explicit migration. Legacy data (e.g. custom source values like "Internet") must remain valid and editable. If semantic mapping cannot be established safely, implement labelled legacy handling and defer destructive changes to explicit user-approved migration.

### III. Progressive Enhancement
Extend existing functionality rather than replacing it. The CRM has established patterns for tabs, forms, server actions, and validation. New features integrate with existing client/lead workspaces, task systems, and activity logs rather than creating parallel implementations. Empty states provide actionable next steps. UI improvements must work on both desktop and mobile viewports with proper accessibility.

### IV. Side-Effect Visibility
Automations, integrations, and external API calls require explicit review and approval workflows. Show triggers, recipient scope, known actions, and approval state before enabling. Unknown or unreviewed workflows must not become silently safe. No live automation enables, no external sends, no production credentials exposed in UI. Diagnostic information (last successful refresh, connection state, error details) surfaces genuine integration health without fabricating metadata.

### V. British English and UK Standards
All new user-facing text uses British English spelling and terminology. Dates display in unambiguous UK formats (DD/MM/YYYY or day-month-year text). Currency displays respect configured intent rather than arbitrary dollar symbols. Existing financial values are not relabelled or converted without proper currency semantics and user approval. No em dashes in user-facing content.

### VI. Test-First for Business Logic
New validation logic (next-action requirements, lifecycle transitions, duplicate protection, approval invalidation, scope checks) requires unit and integration test coverage. Tests verify both success and failure paths. Manual UI smoke testing uses isolated fixtures where feasible, with documented limitations. Lint, typecheck, and build commands run with exact pass/failure evidence reported.

### VII. Spec Kit Workflow Fidelity
Requirements trace through Spec Kit artefacts (constitution → spec → plan → tasks → implementation). Each artefact links to its predecessor and successor. Tasks reference specific files, functions, and acceptance criteria. Implementation changes include test files and rollback procedures where applicable. Done criteria: artefacts committed, PR created, tests documented, manual review checklist provided.

## Technical Standards

### Technology Stack
- **Framework**: Next.js 14+ App Router with TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **UI**: shadcn/ui components with Tailwind CSS, responsive and accessible
- **Validation**: Prisma client types, server-side validation in server actions
- **Testing**: Vitest for unit/integration tests, isolated test database for DB tests

### Package and Service Enums
PackageType enum (VOLTAGE, CHARGE, GRID) maps to intended display names (Minimum Stick, Extra Sticky, Totally Stuck). Mapping must be verified against code, types, and existing usage before implementation. If mapping is uncertain, implement explicit legacy marker and document decision point.

### Migration Safety
Prisma migrations are authored but never executed on live databases during development. All migrations must be backwards-compatible, additive, and include rollback procedures. Data preservation mapping is documented. No opportunistic cleanup or schema reorganization bundled with feature work.

### Integration and Secrets
No production DATABASE_URL, API keys, or credentials used in dev/test. Environment setup verifies isolation before any writes. Secret config values never exposed in UI diagnostics. Tenant and auth checks preserved in all server actions.

## Development Workflow

### Spec-Driven Development
1. **Constitution**: Establish principles (this document)
2. **Spec**: Define user scenarios, requirements, success criteria, assumptions
3. **Plan**: Map requirements to architecture, identify files and patterns
4. **Tasks**: Generate specific implementation tasks with acceptance criteria
5. **Implement**: Execute tasks, write tests, document edge cases
6. **Converge**: Verify completeness, update tasks with remaining work

### Code Changes
- Read existing implementation before editing
- Preserve established patterns (tabs, forms, server actions, activity logs)
- Extend EditClientPackageForm, LeadConversionForm, and similar components
- Add fields to UpdateLeadForm, CreateDealForm as needed
- Surface linked data (tasks, leads, clients) through existing relationships
- No comments that narrate code; explain non-obvious intent only
- No new files unless absolutely necessary

### Testing and Validation
- Unit tests for validation logic, mapping functions, edge cases
- Integration tests for server actions with auth/scope checks
- Manual smoke testing with isolated fixtures (document what's feasible)
- Run existing lint/typecheck/build with full output captured
- Report exact pass/failure states, not assumed "should work"

### Git and PR Workflow
- New branch: `cursor/crm-improvements-sdd-4c84`
- Commit logical changes separately with descriptive messages
- Push after test completion, not after every commit
- Create PR with template if present, include summary and acceptance criteria
- No merge, no deploy, no auto-merge enabling

## Scope and Boundaries

### In Scope
1. Agency package display mapping (VOLTAGE/CHARGE/GRID → Minimum Stick/Extra Sticky/Totally Stuck)
2. Lead owner, next action, follow-up date visible/editable with validation
3. Explicit lead → opportunity/deal → client lifecycle with duplicate protection
4. Actionable Today view for overdue/due tasks and opportunities needing next actions
5. Task detail improvements (owner, due date, linked client/lead, status, notes)
6. Client workspace cohesion (linked tasks, package/services, activity, SharePoint metadata)
7. Google Business Profile draft/review workflow with approval invalidation and text-only posting
8. Reporting/integration state clarity (not configured vs loading vs connected vs error)
9. Automation safety visibility (trigger/recipient/action/review state)
10. British English, UK dates, currency intent (no arbitrary relabelling)

### Out of Scope
- Production data changes (user will do manually)
- Live database writes or migrations during development
- Production API calls to fetch metrics or enable automations
- External sends, paid advertising, or spending
- Merge, deploy, or auto-merge enabling
- Copying real customer data into repo/tests
- New architectural modules or rewrites
- Unrelated features (weekly scoreboard, arbitrary expansion)
- Image generation, purchases, or sourcing for GBP posts
- Automatic deal creation or status changes

## Governance

This constitution supersedes ad-hoc decisions and assumed best practices. All implementation choices must align with these principles. Complexity and deviations require explicit justification and user approval. Testing is mandatory for business logic. Production data is inviolable.

**Version**: 1.0.0  
**Ratified**: 2026-11-08  
**Last Amended**: 2026-11-08
