import { useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import type { TeamMember } from '@/config/team-members.config';

export interface UseEmailAssignmentOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export function useEmailAssignment(options?: UseEmailAssignmentOptions) {
  const utils = trpc.useContext();

  // Queries
  const { data: teamMembers = [], isLoading: loadingTeamMembers } = 
    trpc.emailAssignment.getTeamMembers.useQuery();

  const { data: workloadData, isLoading: loadingWorkload } = 
    trpc.emailAssignment.getWorkloadDistribution.useQuery();

  // Mutations
  const assignEmailMutation = trpc.emailAssignment.assignEmail.useMutation({
    onSuccess: (data) => {
      // Invalidate relevant queries
      utils.emails.invalidate();
      utils.emailAssignment.getWorkloadDistribution.invalidate();
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      console.error('Email assignment failed:', error);
      options?.onError?.(error);
    },
    retry: (failureCount, error) => {
      // Only retry for network errors, not for business logic errors
      if (failureCount < 2 && error?.data?.code !== 'BAD_REQUEST' && error?.data?.code !== 'NOT_FOUND') {
        return true;
      }
      return false;
    },
  });

  const bulkAssignMutation = trpc.emailAssignment.bulkAssignEmails.useMutation({
    onSuccess: (data) => {
      utils.emails.invalidate();
      utils.emailAssignment.getWorkloadDistribution.invalidate();
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      console.error('Bulk email assignment failed:', error);
      options?.onError?.(error);
    },
    retry: (failureCount, error) => {
      // Only retry for network errors, not for business logic errors
      if (failureCount < 2 && error?.data?.code !== 'BAD_REQUEST' && error?.data?.code !== 'NOT_FOUND') {
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
    [assignEmailMutation]
  );

  const bulkAssignEmails = useCallback(
    async (emailIds: string[], assignedTo: string | null) => {
      return bulkAssignMutation.mutateAsync({
        emailIds,
        assignedTo,
      });
    },
    [bulkAssignMutation]
  );

  const getAssignmentSuggestions = useCallback(
    async (emailId: string) => {
      return utils.emailAssignment.getAssignmentSuggestions.fetch(emailId);
    },
    [utils]
  );

  // Helper functions
  const getTeamMemberById = useCallback(
    (memberId: string): TeamMember | undefined => {
      return teamMembers.find((member: TeamMember) => member.id === memberId);
    },
    [teamMembers]
  );

  const getAssignedMemberName = useCallback(
    (assignedTo?: string): string => {
      if (!assignedTo) return 'Unassigned';
      const member = getTeamMemberById(assignedTo);
      return member?.name || assignedTo;
    },
    [getTeamMemberById]
  );

  // Subscription for real-time updates
  trpc.emailAssignment.onEmailUpdate.useSubscription(undefined, {
    onData: (data) => {
      // Handle real-time email updates
      console.log('Email update received:', data);
      // You could dispatch to a global state manager here
      // or invalidate queries as needed
      utils.emails.invalidate();
    },
    onError: (error) => {
      console.error('Subscription error:', error);
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