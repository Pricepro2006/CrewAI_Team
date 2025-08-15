import { useCallback } from "react";
import { api } from "../../lib/trpc.js";
import type { TeamMember } from "../../config/team-members?.config.js";

export interface UseEmailAssignmentOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

export function useEmailAssignment(options?: UseEmailAssignmentOptions) {
  const utils = api.useUtils();

  // Queries
  const { data: teamMembers = [], isLoading: loadingTeamMembers } = (
    api.emailAssignment as any
  ).getTeamMembers.useQuery();

  const { data: workloadData, isLoading: loadingWorkload } = (
    api.emailAssignment as any
  ).getWorkloadDistribution.useQuery();

  // Mutations
  const assignEmailMutation = (
    api.emailAssignment as any
  ).assignEmail.useMutation({
    onSuccess: (data: any) => {
      // Invalidate relevant queries
      utils?.emails?.invalidate();
      (utils.emailAssignment as any).getWorkloadDistribution.invalidate();
      options?.onSuccess?.(data);
    },
    onError: (error: any) => {
      console.error("Email assignment failed:", error);
      options?.onError?.(error);
    },
    retry: (failureCount: number, error: any) => {
      // Only retry for network errors, not for business logic errors
      if (
        failureCount < 2 &&
        error?.data?.code !== "BAD_REQUEST" &&
        error?.data?.code !== "NOT_FOUND"
      ) {
        return true;
      }
      return false;
    },
  });

  const bulkAssignMutation = (
    api.emailAssignment as any
  ).bulkAssignEmails.useMutation({
    onSuccess: (data: any) => {
      utils?.emails?.invalidate();
      (utils.emailAssignment as any).getWorkloadDistribution.invalidate();
      options?.onSuccess?.(data);
    },
    onError: (error: any) => {
      console.error("Bulk email assignment failed:", error);
      options?.onError?.(error);
    },
    retry: (failureCount: number, error: any) => {
      // Only retry for network errors, not for business logic errors
      if (
        failureCount < 2 &&
        error?.data?.code !== "BAD_REQUEST" &&
        error?.data?.code !== "NOT_FOUND"
      ) {
        return true;
      }
      return false;
    },
  });

  // Assignment functions
  const assignEmail = useCallback(
    async (emailId: string, assignedTo: string | null) => {
      return assignEmailMutation.mutateAsync({
        emailId,
        assignedTo,
      });
    },
    [assignEmailMutation],
  );

  const bulkAssignEmails = useCallback(
    async (emailIds: string[], assignedTo: string | null) => {
      return bulkAssignMutation.mutateAsync({
        emailIds,
        assignedTo,
      });
    },
    [bulkAssignMutation],
  );

  const getAssignmentSuggestions = useCallback(
    async (emailId: string) => {
      return (utils.emailAssignment as any).getAssignmentSuggestions.fetch({
        emailId,
      });
    },
    [utils],
  );

  // Helper functions
  const getTeamMemberById = useCallback(
    (memberId: string): TeamMember | undefined => {
      return teamMembers.find((member: TeamMember) => member.id === memberId);
    },
    [teamMembers],
  );

  const getAssignedMemberName = useCallback(
    (assignedTo?: string): string => {
      if (!assignedTo) return "Unassigned";
      const member = getTeamMemberById(assignedTo);
      return member?.name || assignedTo;
    },
    [getTeamMemberById],
  );

  // Subscription for real-time updates
  (api.emailAssignment as any).onEmailUpdate.useSubscription(undefined, {
    onData: (data: any) => {
      // Handle real-time email updates
      console.log("Email update received:", data);
      // You could dispatch to a global state manager here
      // or invalidate queries as needed
      utils?.emails?.invalidate();
    },
    onError: (error: any) => {
      console.error("Subscription error:", error);
    },
  });

  return {
    // Data
    teamMembers,
    workloadData,

    // Loading states
    isLoading: loadingTeamMembers || loadingWorkload,
    isAssigning: assignEmailMutation.isLoading || bulkAssignMutation.isLoading,

    // Functions
    assignEmail,
    bulkAssignEmails,
    getAssignmentSuggestions,
    getTeamMemberById,
    getAssignedMemberName,

    // Errors
    error: assignEmailMutation.error || bulkAssignMutation.error,
  };
}
