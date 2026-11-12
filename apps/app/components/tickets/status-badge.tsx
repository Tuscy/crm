import { STAFF_STATUS_LABELS } from "@/lib/tickets/status-labels";
import type { TicketStatusName } from "@/lib/tickets/transitions";
import { cn } from "@stky/ui/utils";

const TONE: Record<TicketStatusName, string> = {
  NEW: "bg-blue-100 text-blue-800",
  TRIAGED: "bg-sky-100 text-sky-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  AWAITING_REVIEW: "bg-purple-100 text-purple-800",
  AWAITING_CLIENT: "bg-orange-100 text-orange-800",
  NEEDS_HUMAN: "bg-red-100 text-red-800",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-muted text-muted-foreground",
};

export function TicketStatusBadge({ status }: { status: TicketStatusName }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONE[status]
      )}
    >
      {STAFF_STATUS_LABELS[status]}
    </span>
  );
}
