import Link from "next/link";
import { notFound } from "next/navigation";
import { getFlowWithEnrollments } from "@/lib/email-flows/enrollments";
import { EnrollmentsTable } from "@/components/email-flows/enrollments-table";

function contactName(snapshot: unknown, fallback: string): string {
  if (snapshot && typeof snapshot === "object") {
    const s = snapshot as Record<string, unknown>;
    if (typeof s.name === "string" && s.name) return s.name;
    if (typeof s.email === "string" && s.email) return s.email;
  }
  return fallback;
}

export default async function FlowEnrollmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const flow = await getFlowWithEnrollments(id);
  if (!flow) notFound();

  const enrollments = flow.enrollments.map((e) => ({
    id: e.id,
    name: contactName(e.contactSnapshot, e.leadId ?? e.clientId ?? "Unknown"),
    kind: e.leadId ? "Lead" : "Client",
    enrolledAt: e.enrolledAt.toISOString(),
    currentStep: e.currentStep,
    status: e.status,
    sends: e.sends.map((s) => ({
      id: s.id,
      stepIndex: s.stepIndex,
      subject: s.subject,
      sentAt: s.sentAt.toISOString(),
      deliveredAt: s.deliveredAt?.toISOString() ?? null,
      openedAt: s.openedAt?.toISOString() ?? null,
      clickedAt: s.clickedAt?.toISOString() ?? null,
      bouncedAt: s.bouncedAt?.toISOString() ?? null,
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/email-flows"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to flows
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{flow.name}</h1>
          <Link
            href={`/dashboard/email-flows/${flow.id}`}
            className="text-sm underline text-muted-foreground hover:text-foreground"
          >
            Edit flow
          </Link>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Contacts enrolled in this flow and their per-step engagement.
        </p>
      </div>

      <EnrollmentsTable enrollments={enrollments} />
    </div>
  );
}
