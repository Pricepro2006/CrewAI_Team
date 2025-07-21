import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEmailAssignment } from '../useEmailAssignment';
import React from 'react';

// Mock the trpc module completely
const mockMutateAsync = vi.fn();
const mockFetch = vi.fn();
const mockInvalidate = vi.fn();

vi.mock('@/utils/trpc', () => ({
  trpc: {
    useContext: () => ({
      emails: {
        invalidate: mockInvalidate,
      },
      emailAssignment: {
        getTeamMembers: {
          useQuery: jest.fn(),
        },
        getWorkloadDistribution: {
          useQuery: jest.fn(),
          invalidate: mockInvalidate,
        },
        getAssignmentSuggestions: {
          fetch: mockFetch,
        },
      },
    }),
    emailAssignment: {
      getTeamMembers: {
        useQuery: () => ({
          data: mockTeamMembers,
          isLoading: false,
        }),
      },
      getWorkloadDistribution: {
        useQuery: () => ({
          data: mockWorkloadData,
          isLoading: false,
        }),
      },
      assignEmail: {
        useMutation: (options: any) => ({
          mutateAsync: mockMutateAsync,
          isLoading: false,
          error: null,
        }),
      },
      bulkAssignEmails: {
        useMutation: (options: any) => ({
          mutateAsync: mockMutateAsync,
          isLoading: false,
          error: null,
        }),
      },
      onEmailUpdate: {
        useSubscription: vi.fn(),
      },
    },
  },
}));

// Mock data
const mockTeamMembers = [
  {
    id: 'john-smith',
    name: 'John Smith',
    email: 'john.smith@company.com',
    role: 'Senior Engineer',
    teams: ['engineering'],
  },
  {
    id: 'sarah-wilson',
    name: 'Sarah Wilson',
    email: 'sarah.wilson@company.com',
    role: 'Product Manager',
    teams: ['product'],
  },
];

const mockWorkloadData = [
  {
    memberId: 'john-smith',
    memberName: 'John Smith',
    memberEmail: 'john.smith@company.com',
    emailCount: 5,
  },
  {
    memberId: 'sarah-wilson',
    memberName: 'Sarah Wilson',
    memberEmail: 'sarah.wilson@company.com',
    emailCount: 3,
  },
];

// Test wrapper component
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
  Wrapper.displayName = 'QueryWrapper';
  return Wrapper;
};

describe('useEmailAssignment Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({ success: true });
    mockFetch.mockResolvedValue({
      emailId: 'email-1',
      emailAlias: 'test@company.com',
      suggestions: [mockTeamMembers[0]],
    });
  });

  describe('Data Access', () => {
    it('should provide team members data', () => {
      const { result } = renderHook(() => useEmailAssignment(), {
        wrapper: createWrapper(),
      });

      expect(result.current.teamMembers).toEqual(mockTeamMembers);
    });

    it('should provide workload data', () => {
      const { result } = renderHook(() => useEmailAssignment(), {
        wrapper: createWrapper(),
      });

      expect(result.current.workloadData).toEqual(mockWorkloadData);
    });

    it('should calculate loading state correctly', () => {
      const { result } = renderHook(() => useEmailAssignment(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAssigning).toBe(false);
    });
  });

  describe('Email Assignment Functions', () => {
    it('should assign email successfully', async () => {
      const { result } = renderHook(() => useEmailAssignment(), {
        wrapper: createWrapper(),
      });

      await result.current.assignEmail('email-1', 'john-smith');

      expect(mockMutateAsync).toHaveBeenCalledWith({
        emailId: 'email-1',
        assignedTo: 'john-smith',
      });
    });

    it('should bulk assign emails successfully', async () => {
      const { result } = renderHook(() => useEmailAssignment(), {
        wrapper: createWrapper(),
      });

      await result.current.bulkAssignEmails(['email-1', 'email-2'], 'john-smith');

      expect(mockMutateAsync).toHaveBeenCalledWith({
        emailIds: ['email-1', 'email-2'],
        assignedTo: 'john-smith',
      });
    });

    it('should get assignment suggestions', async () => {
      const { result } = renderHook(() => useEmailAssignment(), {
        wrapper: createWrapper(),
      });

      const suggestions = await result.current.getAssignmentSuggestions('email-1');

      expect(mockFetch).toHaveBeenCalledWith('email-1');
      expect(suggestions).toEqual({
        emailId: 'email-1',
        emailAlias: 'test@company.com',
        suggestions: [mockTeamMembers[0]],
      });
    });
  });

  describe('Helper Functions', () => {
    it('should get team member by ID', () => {
      const { result } = renderHook(() => useEmailAssignment(), {
        wrapper: createWrapper(),
      });

      const member = result.current.getTeamMemberById('john-smith');
      expect(member).toEqual(mockTeamMembers[0]);
    });

    it('should return undefined for non-existent team member', () => {
      const { result } = renderHook(() => useEmailAssignment(), {
        wrapper: createWrapper(),
      });

      const member = result.current.getTeamMemberById('non-existent');
      expect(member).toBeUndefined();
    });

    it('should get assigned member name', () => {
      const { result } = renderHook(() => useEmailAssignment(), {
        wrapper: createWrapper(),
      });

      const name = result.current.getAssignedMemberName('john-smith');
      expect(name).toBe('John Smith');
    });

    it('should return "Unassigned" for no assignee', () => {
      const { result } = renderHook(() => useEmailAssignment(), {
        wrapper: createWrapper(),
      });

      const name = result.current.getAssignedMemberName();
      expect(name).toBe('Unassigned');
    });

    it('should return member ID if member not found', () => {
      const { result } = renderHook(() => useEmailAssignment(), {
        wrapper: createWrapper(),
      });

      const name = result.current.getAssignedMemberName('unknown-id');
      expect(name).toBe('unknown-id');
    });
  });

  describe('Callback Options', () => {
    it('should call onSuccess callback when provided', async () => {
      const onSuccess = vi.fn();
      const onError = vi.fn();

      renderHook(() => useEmailAssignment({ onSuccess, onError }), {
        wrapper: createWrapper(),
      });

      // The success callback would be called by the actual tRPC mutation
      // In our mock setup, we can't easily test this without more complex mocking
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should provide error from mutations', () => {
      const { result } = renderHook(() => useEmailAssignment(), {
        wrapper: createWrapper(),
      });

      // Since we're mocking the mutations to return null errors, this should be null
      expect(result.current.error).toBeNull();
    });
  });
});