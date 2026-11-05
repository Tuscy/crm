"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useUptimeStatus } from "./uptime-status-provider";

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function UptimeBanner() {
  const { snapshot, down } = useUptimeStatus();

  const kumaUnreachable =
    snapshot?.configured === true && !snapshot.reachable;

  if (down.length === 0 && !kumaUnreachable) return null;

  const message =
    down.length > 0
      ? `${joinNames(down.map((m) => m.name))} ${down.length === 1 ? "is" : "are"} down.`
      : "Can't reach Uptime Kuma, so system status is unknown.";

  return (
    <div
      role="alert"
      className="mb-4 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{message}</span>
      <Link
        href="/dashboard#system-status"
        className="shrink-0 font-medium underline underline-offset-2"
      >
        Details
      </Link>
    </div>
  );
}
