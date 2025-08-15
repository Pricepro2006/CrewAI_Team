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

export const TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'nick-paul',
    name: 'Nick Paul',
    email: 'Nick.Paul@TDSynnex.com',
    role: 'Team Lead',
    teams: ['insight', 'primary', 'compucom', 'optiv'],
  },
  {
    id: 'john-smith',
    name: 'John Smith',
    email: 'John.Smith@TDSynnex.com',
    role: 'Senior Analyst',
    teams: ['quotes', 'support'],
  },
  {
    id: 'emily-johnson',
    name: 'Emily Johnson',
    email: 'Emily.Johnson@TDSynnex.com',
    role: 'Support Specialist',
    teams: ['po', 'orders', 'support'],
  },
  {
    id: 'michael-brown',
    name: 'Michael Brown',
    email: 'Michael.Brown@TDSynnex.com',
    role: 'Technical Lead',
    teams: ['microsoft', 'surface', 'hpe'],
  },
  {
    id: 'jennifer-davis',
    name: 'Jennifer Davis',
    email: 'Jennifer.Davis@TDSynnex.com',
    role: 'Product Specialist',
    teams: ['apple', 'india', 'quotes'],
  },
  {
    id: 'richard-lee',
    name: 'Richard Lee',
    email: 'Richard.Lee@TDSynnex.com',
    role: 'Operations Manager',
    teams: ['manilla', 'china', 'compucom'],
  },
  {
    id: 'sarah-wilson',
    name: 'Sarah Wilson',
    email: 'Sarah.Wilson@TDSynnex.com',
    role: 'Sales Coordinator',
    teams: ['US', 'insight', 'sales'],
  },
  {
    id: 'jessica-taylor',
    name: 'Jessica Taylor',
    email: 'Jessica.Taylor@TDSynnex.com',
    role: 'Integration Specialist',
    teams: ['optiv', 'network', 'security'],
  },
  {
    id: 'daniel-martinez',
    name: 'Daniel Martinez',
    email: 'Daniel.Martinez@TDSynnex.com',
    role: 'Support Engineer',
    teams: ['vmware', 'support'],
  },
  {
    id: 'heather-green',
    name: 'Heather Green',
    email: 'Heather.Green@TDSynnex.com',
    role: 'Security Analyst',
    teams: ['fortinet', 'security', 'network'],
  }
];

// Helper function to get team members by team
export function getTeamMembersByTeam(team: string): TeamMember[] {
  return TEAM_MEMBERS?.filter(member => 
    member?.teams?.some(t => t.toLowerCase() === team.toLowerCase())
  );
}

// Helper function to get team member by ID
export function getTeamMemberById(id: string): TeamMember | undefined {
  return TEAM_MEMBERS.find(member => member.id === id);
}

// Helper function to get team member by email
export function getTeamMemberByEmail(email: string): TeamMember | undefined {
  return TEAM_MEMBERS.find(member => 
    member?.email?.toLowerCase() === email.toLowerCase()
  );
}

// Email alias to team mapping based on IEMS patterns
export const EMAIL_ALIAS_TEAMS: Record<string, string[]> = {
  'T119889C@TDSynnex.com': ['main', 'primary', 'insight', 'compucom', 'optiv'],
  'Enpointe2@TDSynnex.com': ['support', 'enpointe'],
  'US.Insightsurface@TDSynnex.com': ['microsoft', 'surface', 'quotes'],
  'InsightHPI@TDSynnex.com': ['hpi', 'quotes', 'products'],
  'Insight3@TDSynnex.com': ['quotes', 'support'],
  'Insightordersupport@TDSynnex.com': ['po', 'orders', 'support'],
  'Team4401@TDSynnex.com': ['manilla', 'connection'],
  'BuildaMac@TDSynnex.com': ['india', 'apple'],
  'salesinsight@TDSynnex.com': ['US', 'insight'],
  'compucom@TDSynnex.com': ['manilla', 'china', 'compucom'],
  'optiv@TDSynnex.com': ['optiv', 'quotes', 'po'],
  'Insight-HPE-BTO-QuoteRequest@TDSynnex.com': ['insight', 'quotes', 'hpe'],
};

// Get suggested assignees based on email alias
export function getSuggestedAssignees(emailAlias: string): TeamMember[] {
  const teams = EMAIL_ALIAS_TEAMS[emailAlias] || [];
  const members = new Set<TeamMember>();
  
  teams.forEach(team => {
    getTeamMembersByTeam(team).forEach(member => members.add(member));
  });
  
  return Array.from(members);
}