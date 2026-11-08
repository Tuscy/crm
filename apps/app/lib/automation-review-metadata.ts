/**
 * Automation workflow review metadata
 * 
 * This config stores explicit review/approval state for workflows.
 * Workflows without metadata are treated as UNKNOWN/UNREVIEWED and cannot be enabled.
 * This is a fail-closed safety gate.
 */

export type WorkflowMetadata = {
  workflowId: string;
  name: string;
  reviewed: boolean;
  approvedBy?: string;
  approvedAt?: string;
  trigger?: string;
  recipientScope?: string;
  actions?: string[];
  notes?: string;
};

type MetadataStore = {
  workflows: Record<string, WorkflowMetadata>;
};

// In-memory store (in production, this would be a database table)
const metadata: MetadataStore = {
  workflows: {},
};

export function getWorkflowMetadata(
  workflowId: string
): WorkflowMetadata | null {
  return metadata.workflows[workflowId] ?? null;
}

export function isWorkflowReviewed(workflowId: string): boolean {
  const meta = getWorkflowMetadata(workflowId);
  return meta?.reviewed === true;
}

export function setWorkflowMetadata(
  workflowId: string,
  data: Partial<WorkflowMetadata>
): void {
  const existing = metadata.workflows[workflowId] ?? {
    workflowId,
    name: data.name ?? "Unknown",
    reviewed: false,
  };
  metadata.workflows[workflowId] = { ...existing, ...data };
}

export function getAllWorkflowMetadata(): WorkflowMetadata[] {
  return Object.values(metadata.workflows);
}

/**
 * Authorization check for enabling workflows
 * FAIL CLOSED: Returns false for unknown/unreviewed workflows
 */
export function canEnableWorkflow(workflowId: string): {
  allowed: boolean;
  reason?: string;
} {
  const meta = getWorkflowMetadata(workflowId);

  if (!meta) {
    return {
      allowed: false,
      reason: "Workflow metadata unknown. Review required before enabling.",
    };
  }

  if (!meta.reviewed) {
    return {
      allowed: false,
      reason: "Workflow not reviewed. Approval required before enabling.",
    };
  }

  return { allowed: true };
}
