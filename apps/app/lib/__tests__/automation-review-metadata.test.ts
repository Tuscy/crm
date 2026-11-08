import { describe, it, expect, beforeEach } from "vitest";
import {
  getWorkflowMetadata,
  isWorkflowReviewed,
  setWorkflowMetadata,
  canEnableWorkflow,
} from "../automation-review-metadata";

describe("Automation Review Metadata", () => {
  beforeEach(() => {
    // Note: In-memory store persists across tests in same run
    // For production, this would be a database with proper isolation
  });

  describe("Unknown workflow handling", () => {
    it("should return null for unknown workflow", () => {
      const meta = getWorkflowMetadata("unknown-workflow-id");
      expect(meta).toBeNull();
    });

    it("should report unknown workflow as not reviewed", () => {
      const reviewed = isWorkflowReviewed("unknown-workflow-id");
      expect(reviewed).toBe(false);
    });

    it("should block enabling unknown workflow (fail closed)", () => {
      const auth = canEnableWorkflow("unknown-workflow-id");
      expect(auth.allowed).toBe(false);
      expect(auth.reason).toContain("unknown");
    });
  });

  describe("Unreviewed workflow handling", () => {
    it("should block enabling unreviewed workflow", () => {
      setWorkflowMetadata("workflow-1", {
        workflowId: "workflow-1",
        name: "Test Workflow",
        reviewed: false,
      });

      const auth = canEnableWorkflow("workflow-1");
      expect(auth.allowed).toBe(false);
      expect(auth.reason).toContain("not reviewed");
    });

    it("should report unreviewed workflow correctly", () => {
      setWorkflowMetadata("workflow-2", {
        workflowId: "workflow-2",
        name: "Test Workflow 2",
        reviewed: false,
      });

      const reviewed = isWorkflowReviewed("workflow-2");
      expect(reviewed).toBe(false);
    });
  });

  describe("Reviewed workflow handling", () => {
    it("should allow enabling reviewed workflow", () => {
      setWorkflowMetadata("workflow-3", {
        workflowId: "workflow-3",
        name: "Reviewed Workflow",
        reviewed: true,
        approvedBy: "admin@example.com",
        approvedAt: "2026-11-01T10:00:00Z",
      });

      const auth = canEnableWorkflow("workflow-3");
      expect(auth.allowed).toBe(true);
      expect(auth.reason).toBeUndefined();
    });

    it("should report reviewed workflow correctly", () => {
      setWorkflowMetadata("workflow-4", {
        workflowId: "workflow-4",
        name: "Reviewed Workflow 2",
        reviewed: true,
      });

      const reviewed = isWorkflowReviewed("workflow-4");
      expect(reviewed).toBe(true);
    });

    it("should retrieve full metadata for reviewed workflow", () => {
      setWorkflowMetadata("workflow-5", {
        workflowId: "workflow-5",
        name: "Email Campaign",
        reviewed: true,
        trigger: "Lead status changed to Qualified",
        recipientScope: "Lead owner only",
        actions: ["Send email", "Create task"],
        approvedBy: "manager@example.com",
        approvedAt: "2026-11-05T14:30:00Z",
        notes: "Tested with synthetic data",
      });

      const meta = getWorkflowMetadata("workflow-5");
      expect(meta).toBeTruthy();
      expect(meta?.reviewed).toBe(true);
      expect(meta?.trigger).toBe("Lead status changed to Qualified");
      expect(meta?.recipientScope).toBe("Lead owner only");
      expect(meta?.actions).toEqual(["Send email", "Create task"]);
      expect(meta?.approvedBy).toBe("manager@example.com");
    });
  });

  describe("Metadata update", () => {
    it("should update existing workflow metadata", () => {
      setWorkflowMetadata("workflow-6", {
        workflowId: "workflow-6",
        name: "Initial Name",
        reviewed: false,
      });

      setWorkflowMetadata("workflow-6", {
        reviewed: true,
        approvedBy: "admin@example.com",
      });

      const meta = getWorkflowMetadata("workflow-6");
      expect(meta?.name).toBe("Initial Name");
      expect(meta?.reviewed).toBe(true);
      expect(meta?.approvedBy).toBe("admin@example.com");
    });
  });

  describe("Fail-closed behavior", () => {
    it("should default to blocked for workflows without explicit approval", () => {
      // Workflow with metadata but reviewed=false
      setWorkflowMetadata("workflow-7", {
        workflowId: "workflow-7",
        name: "Pending Review",
        reviewed: false,
        trigger: "Known trigger",
      });

      const auth = canEnableWorkflow("workflow-7");
      expect(auth.allowed).toBe(false);
    });

    it("should not allow enabling based on presence of metadata alone", () => {
      // Workflow with full metadata but reviewed=false
      setWorkflowMetadata("workflow-8", {
        workflowId: "workflow-8",
        name: "Has Metadata",
        reviewed: false,
        trigger: "Known",
        recipientScope: "Known",
        actions: ["Known action"],
      });

      const auth = canEnableWorkflow("workflow-8");
      expect(auth.allowed).toBe(false);
      expect(auth.reason).toContain("not reviewed");
    });

    it("should require explicit reviewed=true flag", () => {
      setWorkflowMetadata("workflow-9", {
        workflowId: "workflow-9",
        name: "Missing Review Flag",
        // reviewed not set (undefined)
      });

      const auth = canEnableWorkflow("workflow-9");
      expect(auth.allowed).toBe(false);
    });
  });
});
