import { useCallback } from "react";
import { api, handleTrpcError } from "../lib/api.js";
import type { TeamMember } from "../../config/team-members?.config.js";

export interface UseEmailAssignmentOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

export function useEmailAssignment(options?: UseEmailAssignmentOptions) {
  const utils = api.useUtils();

  // Queries with proper error handling
  const {
    data: teamMembers = [],
    isLoading: loadingTeamMembers,
    error: teamMembersError,
    refetch: refetchTeamMembers
  } = api.emailAssignment.getTeamMembers.useQuery(undefined, {
    retry: (failureCount, error) => {
      // Only retry for network errors, not auth/business logic errors
      if (failureCount < 2 && !error?.data?.code) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const {
    data: workloadData,
    isLoading: loadingWorkload,
    error: workloadError,
    refetch: refetchWorkload
  } = api.emailAssignment.getWorkloadDistribution.useQuery(undefined, {
    retry: (failureCount, error) => {
      if (failureCount < 2 && !error?.data?.code) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Mutations with enhanced error handling
  const assignEmailMutation = api.emailAssignment.assignEmail.useMutation({
    onSuccess: async (data) => {
      try {
        // Invalidate relevant queries
        await Promise.all([
          utils.emails.invalidate(),
          utils.emailAssignment.getWorkloadDistribution.invalidate(),
        ]);
        options?.onSuccess?.(data);
      } catch (error) {
        console.warn('Failed to invalidate queries after assignment:', error);
        // Still call success callback even if invalidation fails
        options?.onSuccess?.(data);
      }
    },
    onError: (error) => {
      const errorMessage = handleTrpcError(error);
      console.error("Email assignment failed:", errorMessage, error);
      options?.onError?.(error);
    },
    retry: (failureCount, error) => {
      // Only retry for network errors, not for business logic errors
      if (
        failureCount < 2 &&
        error?.data?.code !== "BAD_REQUEST" &&
        error?.data?.code !== "NOT_FOUND" &&
        error?.data?.code !== "UNAUTHORIZED"
      ) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const bulkAssignMutation = api.emailAssignment.bulkAssignEmails.useMutation({
    onSuccess: async (data) => {
      try {
        await Promise.all([
          utils.emails.invalidate(),
          utils.emailAssignment.getWorkloadDistribution.invalidate(),
        ]);
        options?.onSuccess?.(data);
      } catch (error) {
        console.warn('Failed to invalidate queries after bulk assignment:', error);
        options?.onSuccess?.(data);
      }
    },
    onError: (error) => {
      const errorMessage = handleTrpcError(error);
      console.error("Bulk email assignment failed:", errorMessage, error);
      options?.onError?.(error);
    },
    retry: (failureCount, error) => {
      if (
        failureCount < 2 &&
        error?.data?.code !== "BAD_REQUEST" &&
        error?.data?.code !== "NOT_FOUND" &&
        error?.data?.code !== "UNAUTHORIZED"
      ) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Assignment functions with proper error handling
  const assignEmail = useCallback(
    async (emailId: string, assignedTo: string | null): Promise<void> => {
      try {
        await assignEmailMutation.mutateAsync({
          emailId,
          assignedTo,
        });
      } catch (error) {
        const errorMessage = handleTrpcError(error);
        console.error('Failed to assign email:', errorMessage);
        throw new Error(errorMessage);
      }
    },
    [assignEmailMutation],
  );

  const bulkAssignEmails = useCallback(
    async (emailIds: string[], assignedTo: string | null): Promise<void> => {
      if (!emailIds.length) {
        throw new Error('No email IDs provided for bulk assignment');
      }
      
      try {
        await bulkAssignMutation.mutateAsync({
          emailIds,
          assignedTo,
        });
      } catch (error) {
        const errorMessage = handleTrpcError(error);
        console.error('Failed to bulk assign emails:', errorMessage);
        throw new Error(errorMessage);
      }
    },
    [bulkAssignMutation],
  );

  const getAssignmentSuggestions = useCallback(
    async (emailId: string) => {
      if (!emailId) {
        throw new Error('Email ID is required for assignment suggestions');
      }
      
      try {
        return await utils.emailAssignment.getAssignmentSuggestions.fetch({
          emailId,
        });
      } catch (error) {
        const errorMessage = handleTrpcError(error);
        console.error('Failed to get assignment suggestions:', errorMessage);
        throw new Error(errorMessage);
      }
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

  // Subscription for real-time updates with error handling
  api.emailAssignment.onEmailUpdate.useSubscription(undefined, {
    onData: async (data) => {
      console.log("Email update received:", data);
      try {
        // Invalidate relevant queries to refresh data
        await Promise.all([
          utils.emails.invalidate(),
          utils.emailAssignment.getWorkloadDistribution.invalidate(),
        ]);
      } catch (error) {
        console.warn('Failed to invalidate queries after email update:', error);
      }
    },
    onError: (error) => {
      const errorMessage = handleTrpcError(error);
      console.error("Email update subscription error:", errorMessage);
    },
    // Automatically retry subscription on failure
    retry: true,
  });

  return {
    // Data
    teamMembers,
    workloadData,

    // Loading states
    isLoading: loadingTeamMembers || loadingWorkload,
    isAssigning: assignEmailMutation.isPending || bulkAssignMutation.isPending,

    // Functions
    assignEmail,
    bulkAssignEmails,
    getAssignmentSuggestions,
    getTeamMemberById,
    getAssignedMemberName,

    // Errors with user-friendly messages
    error: teamMembersError || workloadError || assignEmailMutation.error || bulkAssignMutation.error,
    errorMessage: handleTrpcError(
      teamMembersError || workloadError || assignEmailMutation.error || bulkAssignMutation.error
    ),
    
    // Refetch functions
    refetchTeamMembers,
    refetchWorkload,
  };
}
