# Phase 2 Rollback: Lead Owner, Next Action, Follow-Up Date

## Migration: 20261108105942_lead_owner_next_action_followup

### Rollback SQL (if needed)

**Warning**: Only run this if rolling back the feature. This will remove the columns but preserve existing data in other columns.

```sql
-- Remove foreign key constraint
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_ownerId_fkey";

-- Drop index
DROP INDEX IF EXISTS "Lead_ownerId_idx";

-- Remove columns (data will be lost)
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "followUpDate";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "nextAction";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "ownerId";
```

### Notes

- Migration is additive with nullable columns, safe to leave in place even if feature is disabled
- Rollback is destructive and will lose data in these columns
- Existing lead data (name, email, status, etc) is preserved
- Consider soft rollback by ignoring fields in application code instead of dropping columns
