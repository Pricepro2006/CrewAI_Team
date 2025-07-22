import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, } from "../enhanced-router";
import { EmailStorageService } from "../../services/EmailStorageService";
import { WebSocketService } from "../../services/WebSocketService";
import { getTeamMemberById, TEAM_MEMBERS, getSuggestedAssignees, } from "../../../config/team-members.config";
const emailStorage = new EmailStorageService();
const wsService = new WebSocketService();
export const emailAssignmentRouter = router({
    /**
     * Get all team members
     */
    getTeamMembers: publicProcedure.query(async () => {
        return TEAM_MEMBERS.map((member) => ({
            id: member.id,
            name: member.name,
            email: member.email,
            role: member.role,
            teams: member.teams,
        }));
    }),
    /**
     * Assign an email to a team member
     */
    assignEmail: protectedProcedure
        .input(z.object({
        emailId: z.string().min(1),
        assignedTo: z.string().nullable(),
    }))
        .mutation(async ({ input, ctx, }) => {
        const { emailId, assignedTo } = input;
        // Validate team member if provided
        if (assignedTo && !getTeamMemberById(assignedTo)) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Invalid team member ID",
            });
        }
        // Get the email
        const email = await emailStorage.getEmail(emailId);
        if (!email) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Email not found",
            });
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
            type: "update",
            email: updatedEmail,
        });
        // Log assignment activity
        const assigneeName = assignedTo
            ? getTeamMemberById(assignedTo)?.name
            : "Unassigned";
        await emailStorage.logActivity({
            emailId,
            action: "assigned",
            userId: ctx.user?.id || "system",
            details: {
                assignedTo: assignedTo || null,
                assigneeName,
            },
            timestamp: new Date().toISOString(),
        });
        return updatedEmail;
    }),
    /**
     * Bulk assign emails
     */
    bulkAssignEmails: protectedProcedure
        .input(z.object({
        emailIds: z.array(z.string()).min(1),
        assignedTo: z.string().nullable(),
    }))
        .mutation(async ({ input, ctx, }) => {
        const { emailIds, assignedTo } = input;
        // Validate team member if provided
        if (assignedTo && !getTeamMemberById(assignedTo)) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Invalid team member ID",
            });
        }
        const updatedEmails = [];
        const errors = [];
        for (const emailId of emailIds) {
            try {
                const email = await emailStorage.getEmail(emailId);
                if (!email) {
                    errors.push({ emailId, error: "Email not found" });
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
                    type: "update",
                    email: updatedEmail,
                });
            }
            catch (error) {
                errors.push({
                    emailId,
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        }
        // Log bulk assignment activity
        const assigneeName = assignedTo
            ? getTeamMemberById(assignedTo)?.name
            : "Unassigned";
        await emailStorage.logActivity({
            action: "bulk_assigned",
            userId: ctx.user?.id || "system",
            details: {
                emailCount: updatedEmails.length,
                assignedTo: assignedTo || null,
                assigneeName,
                errors: errors.length > 0 ? errors : undefined,
            },
            timestamp: new Date().toISOString(),
        });
        return {
            updated: updatedEmails,
            errors,
        };
    }),
    /**
     * Get assignment suggestions for an email
     */
    getAssignmentSuggestions: publicProcedure
        .input(z.string())
        .query(async ({ input: emailId }) => {
        const email = await emailStorage.getEmail(emailId);
        if (!email) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Email not found",
            });
        }
        // Get suggestions based on email alias
        const suggestions = getSuggestedAssignees(email.email_alias);
        return {
            emailId,
            emailAlias: email.email_alias,
            suggestions: suggestions.map((member) => ({
                id: member.id,
                name: member.name,
                email: member.email,
                role: member.role,
                confidence: 0.8, // Could be calculated based on rules
            })),
        };
    }),
    /**
     * Get workload distribution
     */
    getWorkloadDistribution: publicProcedure.query(async () => {
        const workload = await emailStorage.getAssignmentWorkload();
        const workloadWithNames = Object.entries(workload).map(([memberId, count]) => {
            const member = getTeamMemberById(memberId);
            return {
                memberId,
                memberName: member?.name || "Unknown",
                memberEmail: member?.email,
                emailCount: count,
            };
        });
        // Add unassigned count
        const unassignedCount = await emailStorage.getUnassignedCount();
        workloadWithNames.push({
            memberId: null,
            memberName: "Unassigned",
            memberEmail: null,
            emailCount: unassignedCount,
        });
        return workloadWithNames.sort((a, b) => b.emailCount - a.emailCount);
    }),
    /**
     * Subscribe to email updates
     */
    onEmailUpdate: publicProcedure.subscription(() => {
        return {
            async *[Symbol.asyncIterator]() {
                // This would be connected to the WebSocket service
                // For now, return a placeholder
                yield {
                    type: "connected",
                    timestamp: new Date().toISOString(),
                };
            },
        };
    }),
});
//# sourceMappingURL=emailAssignment.router.js.map