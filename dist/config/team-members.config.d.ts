/**
 * Team Members Configuration
 * Based on IEMS project patterns for email assignment
 */
export interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: string;
    teams: string[];
    avatar?: string;
}
export declare const TEAM_MEMBERS: TeamMember[];
export declare function getTeamMembersByTeam(team: string): TeamMember[];
export declare function getTeamMemberById(id: string): TeamMember | undefined;
export declare function getTeamMemberByEmail(email: string): TeamMember | undefined;
export declare const EMAIL_ALIAS_TEAMS: Record<string, string[]>;
export declare function getSuggestedAssignees(emailAlias: string): TeamMember[];
//# sourceMappingURL=team-members.config.d.ts.map