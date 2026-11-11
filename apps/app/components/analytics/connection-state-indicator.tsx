export type ConnectionState =
  | "not_configured"
  | "loading"
  | "connected_no_data"
  | "connected_with_data"
  | "failed";

type ConnectionStatus = {
  state: ConnectionState;
  lastRefresh?: Date | null;
  error?: string | null;
};

const STATE_STYLES: Record<
  ConnectionState,
  { bg: string; text: string; dot: string }
> = {
  not_configured: {
    bg: "bg-gray-100 dark:bg-gray-900/30",
    text: "text-gray-700 dark:text-gray-300",
    dot: "bg-gray-400",
  },
  loading: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-800 dark:text-blue-300",
    dot: "bg-blue-500 animate-pulse",
  },
  connected_no_data: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-800 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  connected_with_data: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-800 dark:text-green-300",
    dot: "bg-green-500",
  },
  failed: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-800 dark:text-red-300",
    dot: "bg-red-500",
  },
};

const STATE_LABELS: Record<ConnectionState, string> = {
  not_configured: "Not configured",
  loading: "Loading",
  connected_no_data: "Connected · No data",
  connected_with_data: "Connected",
  failed: "Connection failed",
};

export function ConnectionStateIndicator({
  service,
  status,
}: {
  service: string;
  status: ConnectionStatus;
}) {
  const style = STATE_STYLES[status.state];
  const label = STATE_LABELS[status.state];

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`flex items-center gap-2 rounded-full px-3 py-1 ${style.bg}`}>
        <span className={`h-2 w-2 rounded-full ${style.dot}`} />
        <span className={`font-medium ${style.text}`}>
          {service}: {label}
        </span>
      </div>
      {status.lastRefresh && status.state === "connected_with_data" && (
        <span className="text-xs text-muted-foreground">
          Last refresh:{" "}
          {status.lastRefresh.toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      )}
      {status.error && (
        <span className="text-xs text-destructive">{status.error}</span>
      )}
    </div>
  );
}

export function deriveConnectionState(
  notConfigured: boolean,
  loading: boolean,
  error: string | null,
  hasData: boolean,
  lastRefresh?: Date | null
): ConnectionStatus {
  if (notConfigured) {
    return { state: "not_configured" };
  }
  if (loading) {
    return { state: "loading" };
  }
  if (error) {
    return { state: "failed", error };
  }
  if (hasData) {
    return { state: "connected_with_data", lastRefresh };
  }
  return { state: "connected_no_data" };
}
