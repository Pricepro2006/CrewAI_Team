import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { EmailStorageService } from '../services/EmailStorageService';
import { WebSocketService } from '../services/WebSocketService';
import { getTeamMemberById, TEAM_MEMBERS } from '../../config/team-members.config';
import { AppError } from '../utils/errors';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Initialize services
const emailStorage = new EmailStorageService();
const wsService = new WebSocketService();

// Validation schemas
const AssignEmailSchema = z.object({
  emailId: z.string().min(1),
  assignedTo: z.string().nullable(), // null to unassign
});

const BulkAssignSchema = z.object({
  emailIds: z.array(z.string()).min(1),
  assignedTo: z.string().nullable(),
});

/**
 * GET /api/email-assignment/team-members
 * Get all available team members for assignment
 */
router.get('/team-members', asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: TEAM_MEMBERS.map(member => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      teams: member.teams,
    })),
  });
}));

/**
 * POST /api/email-assignment/assign
 * Assign an email to a team member
 */
router.post('/assign', asyncHandler(async (req: Request, res: Response) => {
  const { emailId, assignedTo } = AssignEmailSchema.parse(req.body);

  // Validate team member if provided
  if (assignedTo && !getTeamMemberById(assignedTo)) {
    throw new AppError('Invalid team member ID', 400);
  }

  // Get the email
  const email = await emailStorage.getEmail(emailId);
  if (!email) {
    throw new AppError('Email not found', 404);
  }

  // Update assignment
  const updatedEmail = {
    ...email,
    assignedTo: assignedTo || undefined,
    lastUpdated: new Date().toISOString(),
  };

  await emailStorage.updateEmail(emailId, updatedEmail);

  // Emit WebSocket event
  wsService.emitEmailUpdate({
    type: 'update',
    email: updatedEmail,
  });

  // Log assignment activity
  const assigneeName = assignedTo ? getTeamMemberById(assignedTo)?.name : 'Unassigned';
  await emailStorage.logActivity({
    emailId,
    action: 'assigned',
    userId: req.user?.id || 'system',
    details: {
      assignedTo: assignedTo || null,
      assigneeName,
    },
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    data: updatedEmail,
  });
}));

/**
 * POST /api/email-assignment/bulk-assign
 * Assign multiple emails to a team member
 */
router.post('/bulk-assign', asyncHandler(async (req: Request, res: Response) => {
  const { emailIds, assignedTo } = BulkAssignSchema.parse(req.body);

  // Validate team member if provided
  if (assignedTo && !getTeamMemberById(assignedTo)) {
    throw new AppError('Invalid team member ID', 400);
  }

  const updatedEmails = [];
  const errors = [];

  for (const emailId of emailIds) {
    try {
      const email = await emailStorage.getEmail(emailId);
      if (!email) {
        errors.push({ emailId, error: 'Email not found' });
        continue;
      }

      const updatedEmail = {
        ...email,
        assignedTo: assignedTo || undefined,
        lastUpdated: new Date().toISOString(),
      };

      await emailStorage.updateEmail(emailId, updatedEmail);
      updatedEmails.push(updatedEmail);

      // Emit WebSocket event
      wsService.emitEmailUpdate({
        type: 'update',
        email: updatedEmail,
      });
    } catch (error) {
      errors.push({ emailId, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  // Log bulk assignment activity
  const assigneeName = assignedTo ? getTeamMemberById(assignedTo)?.name : 'Unassigned';
  await emailStorage.logActivity({
    action: 'bulk_assigned',
    userId: req.user?.id || 'system',
    details: {
      emailCount: updatedEmails.length,
      assignedTo: assignedTo || null,
      assigneeName,
      errors: errors.length > 0 ? errors : undefined,
    },
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    data: {
      updated: updatedEmails,
      errors,
    },
  });
}));

/**
 * GET /api/email-assignment/suggestions/:emailId
 * Get assignment suggestions based on email content and rules
 */
router.get('/suggestions/:emailId', asyncHandler(async (req: Request, res: Response) => {
  const { emailId } = req.params;

  if (!emailId) {
    throw new AppError('Email ID is required', 400);
  }

  const email = await emailStorage.getEmail(emailId);
  if (!email) {
    throw new AppError('Email not found', 404);
  }

  // Get suggestions based on email alias
  const { getSuggestedAssignees } = await import('../../config/team-members.config');
  const suggestions = getSuggestedAssignees(email.email_alias);

  res.json({
    success: true,
    data: {
      emailId,
      emailAlias: email.email_alias,
      suggestions: suggestions.map(member => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        confidence: 0.8, // Could be calculated based on rules
      })),
    },
  });
}));

/**
 * GET /api/email-assignment/workload
 * Get workload distribution across team members
 */
router.get('/workload', asyncHandler(async (req: Request, res: Response) => {
  const workload = await emailStorage.getAssignmentWorkload();

  const workloadWithNames = Object.entries(workload).map(([memberId, count]) => {
    const member = getTeamMemberById(memberId);
    return {
      memberId,
      memberName: member?.name || 'Unknown',
      memberEmail: member?.email,
      emailCount: count,
    };
  });

  // Add unassigned count
  const unassignedCount = await emailStorage.getUnassignedCount();
  workloadWithNames.push({
    memberId: null as any,
    memberName: 'Unassigned',
    memberEmail: null as any,
    emailCount: unassignedCount,
  });

  res.json({
    success: true,
    data: workloadWithNames.sort((a, b) => b.emailCount - a.emailCount),
  });
}));

export default router;