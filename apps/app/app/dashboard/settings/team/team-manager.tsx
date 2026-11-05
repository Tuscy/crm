"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import { ROLE_LABELS, STAFF_ROLES, type StaffRole } from "@/lib/permissions";
import {
  createStaffUser,
  listStaffUsers,
  resetStaffPassword,
  revokeStaffAccess,
  updateStaffRole,
  type StaffUserRow,
} from "@/lib/server/actions/users";

export function TeamManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: StaffUserRow[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<unknown>, success?: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        await fn();
        setUsers(await listStaffUsers());
        if (success) setNotice(success);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function onCreate(formData: FormData) {
    run(
      () =>
        createStaffUser({
          name: String(formData.get("name") ?? ""),
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
          role: String(formData.get("role") ?? "VIEWER"),
        }),
      "Account created. Share the password securely; it isn't shown again."
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="text-sm text-green-600">{notice}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add account</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={onCreate} className="grid gap-3 sm:grid-cols-2">
            <input name="name" placeholder="Name" className="border rounded-md px-3 py-2 text-sm bg-background" />
            <input name="email" type="email" required placeholder="Email" className="border rounded-md px-3 py-2 text-sm bg-background" />
            <input name="password" type="password" required minLength={12} placeholder="Temporary password (12+ chars)" autoComplete="new-password" className="border rounded-md px-3 py-2 text-sm bg-background" />
            <select name="role" defaultValue="EDITOR" className="border rounded-md px-3 py-2 text-sm bg-background">
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Working…" : "Create account"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff accounts</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {users.map((u) => (
            <div key={u.id} className="py-3 flex flex-wrap items-center gap-3 justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {u.name || u.email}
                  {u.id === currentUserId && (
                    <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={u.staffRole}
                  disabled={pending}
                  onChange={(e) =>
                    run(() => updateStaffRole(u.id, e.target.value as StaffRole), "Role updated.")
                  }
                  className="border rounded-md px-2 py-1 text-sm bg-background"
                  aria-label={`Role for ${u.email}`}
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    const pw = window.prompt(`New password for ${u.email} (12+ characters)`);
                    if (pw) run(() => resetStaffPassword(u.id, pw), "Password reset.");
                  }}
                >
                  Reset password
                </Button>
                {u.id !== currentUserId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm(`Revoke ${u.email}'s access? They will no longer be able to sign in.`)) {
                        run(() => revokeStaffAccess(u.id), "Access revoked.");
                      }
                    }}
                  >
                    Revoke access
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
