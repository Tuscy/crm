"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import { cn } from "@stky/ui/utils";
import type { MonitorState, UptimeMonitor } from "@/lib/uptime-kuma/types";
import { useUptimeStatus } from "./uptime-status-provider";

const DOT: Record<MonitorState, string> = {
  up: "bg-green-500",
  down: "bg-red-500",
  pending: "bg-amber-500",
  maintenance: "bg-blue-500",
  unknown: "bg-muted-foreground/50",
};

const LABEL: Record<MonitorState, string> = {
  up: "Up",
  down: "Down",
  pending: "Pending",
  maintenance: "Maintenance",
  unknown: "Unknown",
};

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});
const dayTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function fmt(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return (sameDay ? timeFmt : dayTimeFmt).format(d);
}

function Dot({ state, className }: { state: MonitorState; className?: string }) {
  return (
    <span
      role="img"
      aria-label={LABEL[state]}
      className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", DOT[state], className)}
    />
  );
}

function MonitorRow({ monitor }: { monitor: UptimeMonitor }) {
  let note: string | null = null;
  if (monitor.state === "down" && monitor.downSince) {
    note = `Down since ${fmt(monitor.downSince)}`;
  } else if (monitor.recentOutage) {
    note = `Was down ${fmt(monitor.recentOutage.from)} to ${fmt(monitor.recentOutage.to)}`;
  }

  return (
    <li className="flex items-center gap-2 text-sm">
      <Dot state={monitor.state} />
      <span className="min-w-0 flex-1 truncate">{monitor.name}</span>
      {note ? (
        <span
          className={cn(
            "hidden text-xs sm:inline",
            monitor.state === "down" ? "text-destructive" : "text-amber-500"
          )}
        >
          {note}
        </span>
      ) : null}
      <span className="flex shrink-0 items-center gap-0.5" aria-hidden="true">
        {monitor.recentBeats.map((b, i) => (
          <span key={i} className={cn("h-3 w-1 rounded-sm", DOT[b])} />
        ))}
      </span>
    </li>
  );
}

export function UptimeStatusCard() {
  const { snapshot } = useUptimeStatus();

  const body = (() => {
    if (!snapshot) {
      return <p className="text-sm text-muted-foreground">Checking...</p>;
    }
    if (!snapshot.configured) {
      return (
        <p className="text-sm text-muted-foreground">
          Set <code>UPTIME_KUMA_BASE_URL</code> and{" "}
          <code>UPTIME_KUMA_STATUS_SLUG</code> to show monitor status here.
        </p>
      );
    }
    if (!snapshot.reachable) {
      return (
        <p className="text-sm text-destructive" role="alert">
          Can&apos;t reach Uptime Kuma. {snapshot.error}
        </p>
      );
    }
    if (snapshot.monitors.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          No monitors found on the status page.
        </p>
      );
    }
    return (
      <ul className="space-y-2">
        {snapshot.monitors.map((m) => (
          <MonitorRow key={m.id} monitor={m} />
        ))}
      </ul>
    );
  })();

  const overallState: MonitorState =
    snapshot?.configured && snapshot.reachable
      ? snapshot.overall === "up"
        ? "up"
        : snapshot.overall === "unknown"
          ? "unknown"
          : "down"
      : "unknown";

  return (
    <Card id="system-status" className="md:col-span-2 lg:col-span-3">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Dot state={overallState} />
          System status
          {snapshot?.configured ? (
            <a
              href={snapshot.statusPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs font-normal text-primary hover:underline"
            >
              Open Kuma →
            </a>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
