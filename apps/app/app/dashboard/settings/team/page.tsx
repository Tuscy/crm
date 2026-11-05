import { currentStaffCan, getStaffUser } from "@/lib/server/guard";
import { listStaffUsers } from "@/lib/server/actions/users";
import { TeamManager } from "./team-manager";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  if (!(await currentStaffCan("user:read"))) {
    return (
      <p className="text-sm text-muted-foreground">
        Only admins can manage team access.
      </p>
    );
  }
  const [users, me] = await Promise.all([listStaffUsers(), getStaffUser()]);
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Team &amp; permissions</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Admins can do everything. Editors can view, add and edit but never
          delete, and can&rsquo;t reach integrations, team or the audit log.
          Viewers are read-only. Role changes take effect immediately.
        </p>
      </div>
      <TeamManager initialUsers={users} currentUserId={me?.id ?? ""} />
    </div>
  );
}
