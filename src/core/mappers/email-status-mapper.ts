/**
 * Email Status Mapper
 * Provides type-safe mapping between database and application status values
 */

import type {
  DatabaseEmailStatus,
  DatabaseWorkflowState,
  ApplicationEmailStatus,
  ApplicationWorkflowState,
  ColorStatus,
  EmailStatusMapping,
  TypedEmailRecord,
  TypedEmailResponse,
} from '../types/email-status-types.js';

// Comprehensive status mapping table
const STATUS_MAPPINGS: EmailStatusMapping[] = [
  {
    databaseStatus: 'pending',
    databaseWorkflowState: 'START_POINT',
    applicationStatus: 'unread',
    applicationWorkflowState: 'pending',
    colorStatus: 'red',
    displayText: 'Critical',
    description: 'Email requires immediate attention'
  },
  {
    databaseStatus: 'imported',
    databaseWorkflowState: 'START_POINT',
    applicationStatus: 'unread',
    applicationWorkflowState: 'pending',
    colorStatus: 'red',
    displayText: 'New',
    description: 'Newly imported email awaiting processing'
  },
  {
    databaseStatus: 'phase1_complete',
    databaseWorkflowState: 'IN_PROGRESS',
    applicationStatus: 'processing',
    applicationWorkflowState: 'in_progress',
    colorStatus: 'yellow',
    displayText: 'In Progress',
    description: 'Initial analysis complete, further processing required'
  },
  {
    databaseStatus: 'phase2_complete',
    databaseWorkflowState: 'IN_PROGRESS',
    applicationStatus: 'processing',
    applicationWorkflowState: 'under_review',
    colorStatus: 'yellow',
    displayText: 'Under Review',
    description: 'Advanced analysis complete, awaiting final review'
  },
  {
    databaseStatus: 'phase3_complete',
    databaseWorkflowState: 'COMPLETION',
    applicationStatus: 'resolved',
    applicationWorkflowState: 'completed',
    colorStatus: 'green',
    displayText: 'Completed',
    description: 'All phases complete, email fully processed'
  },
  {
    databaseStatus: 'analyzed',
    databaseWorkflowState: 'COMPLETION',
    applicationStatus: 'read',
    applicationWorkflowState: 'completed',
    colorStatus: 'green',
    displayText: 'Analyzed',
    description: 'Email has been analyzed and processed'
  },
  {
    databaseStatus: 'failed',
    databaseWorkflowState: 'error',
    applicationStatus: 'escalated',
    applicationWorkflowState: 'rejected',
    colorStatus: 'red',
    displayText: 'Failed',
    description: 'Processing failed, manual intervention required'
  },
  {
    databaseStatus: 'error',
    databaseWorkflowState: 'error',
    applicationStatus: 'escalated',
    applicationWorkflowState: 'rejected',
    colorStatus: 'red',
    displayText: 'Error',
    description: 'An error occurred during processing'
  },
  {
    databaseStatus: 'active',
    databaseWorkflowState: 'IN_PROGRESS',
    applicationStatus: 'processing',
    applicationWorkflowState: 'in_progress',
    colorStatus: 'yellow',
    displayText: 'Active',
    description: 'Currently being processed'
  }
];

/**
 * Map database status to application status with exhaustive checking
 */
export function mapDatabaseToApplicationStatus(
  dbStatus: DatabaseEmailStatus,
  dbWorkflowState?: DatabaseWorkflowState
): ApplicationEmailStatus {
  const mapping = STATUS_MAPPINGS.find(m => 
    m.databaseStatus === dbStatus && 
    (!dbWorkflowState || m.databaseWorkflowState === dbWorkflowState)
  );

  if (!mapping) {
    // Fallback mapping based on status patterns
    switch (dbStatus) {
      case 'pending':
      case 'imported':
        return 'unread';
      case 'phase1_complete':
      case 'phase2_complete':
      case 'active':
        return 'processing';
      case 'phase3_complete':
      case 'analyzed':
        return 'resolved';
      case 'failed':
      case 'error':
        return 'escalated';
      default:
        // This should never happen with proper typing
        const exhaustiveCheck: never = dbStatus;
        throw new Error(`Unmapped database status: ${exhaustiveCheck}`);
    }
  }

  return mapping.applicationStatus;
}

/**
 * Map database workflow state to application workflow state
 */
export function mapDatabaseToApplicationWorkflowState(
  dbWorkflowState: DatabaseWorkflowState
): ApplicationWorkflowState {
  switch (dbWorkflowState) {
    case 'START_POINT':
    case 'pending':
      return 'pending';
    case 'IN_PROGRESS':
    case 'in_progress':
      return 'in_progress';
    case 'COMPLETION':
    case 'completed':
      return 'completed';
    case 'error':
      return 'rejected';
    default:
      // Exhaustive check
      const exhaustiveCheck: never = dbWorkflowState;
      throw new Error(`Unmapped workflow state: ${exhaustiveCheck}`);
  }
}

/**
 * Map database status to color status
 */
export function mapDatabaseToColorStatus(
  dbStatus: DatabaseEmailStatus,
  dbWorkflowState?: DatabaseWorkflowState
): ColorStatus {
  const mapping = STATUS_MAPPINGS.find(m => 
    m.databaseStatus === dbStatus && 
    (!dbWorkflowState || m.databaseWorkflowState === dbWorkflowState)
  );

  if (!mapping) {
    // Fallback based on status
    if (dbStatus === 'pending' || dbStatus === 'imported' || dbStatus === 'failed' || dbStatus === 'error') {
      return 'red';
    } else if (dbStatus === 'phase3_complete' || dbStatus === 'analyzed') {
      return 'green';
    } else {
      return 'yellow';
    }
  }

  return mapping.colorStatus;
}

/**
 * Get display text for a given database status
 */
export function getStatusDisplayText(
  dbStatus: DatabaseEmailStatus,
  dbWorkflowState?: DatabaseWorkflowState
): string {
  const mapping = STATUS_MAPPINGS.find(m => 
    m.databaseStatus === dbStatus && 
    (!dbWorkflowState || m.databaseWorkflowState === dbWorkflowState)
  );

  return mapping?.displayText || 'Unknown';
}

/**
 * Transform database email record to API response format
 */
export function transformEmailRecord(dbRecord: TypedEmailRecord): TypedEmailResponse {
  const applicationStatus = mapDatabaseToApplicationStatus(dbRecord.status, dbRecord.workflow_state);
  const applicationWorkflowState = mapDatabaseToApplicationWorkflowState(dbRecord.workflow_state);
  const colorStatus = mapDatabaseToColorStatus(dbRecord.status, dbRecord.workflow_state);
  const statusText = getStatusDisplayText(dbRecord.status, dbRecord.workflow_state);

  return {
    ...dbRecord,
    status: applicationStatus,
    workflowState: applicationWorkflowState,
    colorStatus,
    statusText,
  };
}

/**
 * Validate status transition
 */
export function isValidStatusTransition(
  fromStatus: DatabaseEmailStatus,
  toStatus: DatabaseEmailStatus
): boolean {
  // Define valid transitions
  const validTransitions: Record<DatabaseEmailStatus, DatabaseEmailStatus[]> = {
    'pending': ['imported', 'phase1_complete', 'failed', 'error'],
    'imported': ['phase1_complete', 'analyzed', 'failed', 'error'],
    'phase1_complete': ['phase2_complete', 'analyzed', 'failed', 'error'],
    'phase2_complete': ['phase3_complete', 'analyzed', 'failed', 'error'],
    'phase3_complete': ['analyzed'],
    'analyzed': [], // Terminal state
    'failed': ['pending', 'imported'], // Can retry
    'error': ['pending', 'imported'], // Can retry
    'active': ['phase1_complete', 'phase2_complete', 'phase3_complete', 'analyzed', 'failed', 'error'],
  };

  return validTransitions[fromStatus]?.includes(toStatus) || false;
}

/**
 * Get next valid statuses for a given status
 */
export function getNextValidStatuses(currentStatus: DatabaseEmailStatus): DatabaseEmailStatus[] {
  const validTransitions: Record<DatabaseEmailStatus, DatabaseEmailStatus[]> = {
    'pending': ['imported', 'phase1_complete', 'failed'],
    'imported': ['phase1_complete', 'analyzed', 'failed'],
    'phase1_complete': ['phase2_complete', 'analyzed', 'failed'],
    'phase2_complete': ['phase3_complete', 'analyzed', 'failed'],
    'phase3_complete': ['analyzed'],
    'analyzed': [],
    'failed': ['pending', 'imported'],
    'error': ['pending', 'imported'],
    'active': ['phase1_complete', 'phase2_complete', 'phase3_complete', 'analyzed', 'failed'],
  };

  return validTransitions[currentStatus] || [];
}