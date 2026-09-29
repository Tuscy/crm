"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { UptimeMonitor, UptimeSnapshot } from "@/lib/uptime-kuma/types";

const POLL_MS = 60_000;

type UptimeContextValue = {
  /** null until the first response arrives. */
  snapshot: UptimeSnapshot | null;
  /** Monitors currently down. Empty when unconfigured or unreachable. */
  down: UptimeMonitor[];
  refresh: () => void;
};

const UptimeContext = createContext<UptimeContextValue>({
  snapshot: null,
  down: [],
  refresh: () => {},
});

export function UptimeStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<UptimeSnapshot | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/uptime", { cache: "no-store" });
      if (!res.ok) return;
      setSnapshot((await res.json()) as UptimeSnapshot);
    } catch {
      // Keep the last known snapshot; the next poll will retry.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const value = useMemo<UptimeContextValue>(() => {
    const down =
      snapshot && snapshot.configured
        ? snapshot.monitors.filter((m) => m.state === "down")
        : [];
    return { snapshot, down, refresh: () => void refresh() };
  }, [snapshot, refresh]);

  return (
    <UptimeContext.Provider value={value}>{children}</UptimeContext.Provider>
  );
}

export function useUptimeStatus(): UptimeContextValue {
  return useContext(UptimeContext);
}
