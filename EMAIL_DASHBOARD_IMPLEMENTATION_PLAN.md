# Email Dashboard Implementation Plan

## Current State vs Target State Analysis

### Screenshot Analysis (Target State)
The screenshot shows a professional email dashboard with:

1. **Three distinct sections:**
   - **Email Alias** section (top) - Shows emails for InsightFortinet@TDSynnex.com and InsightInfoblox@TDSynnex.com
   - **Marketing-Splunk** section (middle) - Shows marketing-related emails
   - **VMware-TDSynnex** section (bottom) - Shows VMware support cases

2. **Column Structure:**
   - Email Alias / Marketing-Splunk / VMware-TDSynnex (category header)
   - Requested By (sender name)
   - Subject (email subject line)
   - Summary (brief description)
   - Status (Red/Yellow/Green dots)
   - Assigned To (for middle section)
   - Action (for bottom section)

3. **Visual Elements:**
   - Clean, professional table layout
   - Status indicators (colored dots: red for urgent, yellow for in-progress, green for completed)
   - Action buttons for support cases
   - Clear categorization and grouping

### Current Implementation Analysis
Our current EmailDashboard has:
- Basic email listing functionality
- Status indicators (already implemented)
- Search and filtering
- WebSocket real-time updates
- Basic categorization

**Missing Elements:**
- Email categorization by alias/type (Email Alias, Marketing-Splunk, VMware-TDSynnex)
- Proper data mapping from IEMS project structure
- Section-based display instead of single table
- Specific summary generation
- Assignment functionality for Marketing emails
- Action buttons for VMware support

## Implementation Plan

### Phase 1: Data Integration and Mapping
**Priority: High | Timeline: 2-3 hours**

1. **Create IEMS Data Service**
   ```typescript
   // src/api/services/IEMSDataService.ts
   - Load mailboxes.json and distribution_list.json
   - Map email aliases to categories
   - Process email batch files
   - Generate summaries using AI
   ```

2. **Update Email Types**
   ```typescript
   // src/types/iems-email.types.ts
   interface IEMSEmail {
     id: string;
     category: 'email-alias' | 'marketing-splunk' | 'vmware-tdsynnex';
     emailAlias: string;
     requestedBy: string;
     subject: string;
     summary: string;
     status: 'red' | 'yellow' | 'green';
     statusText?: string;
     assignedTo?: string;
     action?: string;
     receivedTime: Date;
     rawData: any;
   }
   ```

3. **Create Data Processing Pipeline**
   - Load email batches from `/home/pricepro2006/iems_project/db_backups/email_batches/`
   - Map emails to appropriate categories based on recipient
   - Generate summaries using FullAnalysis data
   - Determine status based on urgency and workflow state

### Phase 2: Backend API Updates
**Priority: High | Timeline: 2-3 hours**

1. **Update tRPC Router**
   ```typescript
   // src/api/routes/iems-email.router.ts
   - getCategorizedEmails: Return emails grouped by category
   - updateEmailAssignment: Handle assignment updates
   - performEmailAction: Handle action buttons
   - getEmailSummary: Generate AI-powered summaries
   ```

2. **Integrate with Existing Services**
   - Connect to EmailAnalysisAgent for summary generation
   - Use existing WebSocket service for real-time updates
   - Leverage Redis cache for performance

### Phase 3: UI Implementation
**Priority: High | Timeline: 3-4 hours**

1. **Create New Components**
   ```typescript
   // src/ui/components/Email/IEMSDashboard.tsx
   - Main dashboard container matching screenshot layout
   
   // src/ui/components/Email/EmailAliasSection.tsx
   - Display emails for specific aliases
   
   // src/ui/components/Email/MarketingSplunkSection.tsx
   - Marketing emails with assignment dropdown
   
   // src/ui/components/Email/VMwareTDSynnexSection.tsx
   - Support cases with action buttons
   ```

2. **Update Styling**
   ```css
   /* src/ui/components/Email/IEMSDashboard.css */
   - Match screenshot's clean, professional look
   - Proper spacing and typography
   - Status indicator styling
   - Section borders and backgrounds
   ```

3. **Component Structure**
   ```tsx
   <IEMSDashboard>
     <EmailAliasSection 
       emails={emailAliasEmails}
       onStatusChange={handleStatusChange}
     />
     <MarketingSplunkSection 
       emails={marketingEmails}
       onAssign={handleAssignment}
     />
     <VMwareTDSynnexSection 
       emails={vmwareEmails}
       onAction={handleAction}
     />
   </IEMSDashboard>
   ```

### Phase 4: Email Analysis Integration
**Priority: High | Timeline: 2-3 hours**

1. **Enhance Email Analysis**
   - Use existing EmailAnalysisAgent for intelligent summaries
   - Implement priority detection based on content
   - Extract key information (quotes, DNS info, case details)
   - Identify action items and urgency

2. **Status Determination Logic**
   ```typescript
   function determineEmailStatus(email: IEMSEmail): StatusInfo {
     // Red: Urgent/Critical emails requiring immediate attention
     // Yellow: In-progress or pending response
     // Green: Completed or informational
   }
   ```

### Phase 5: Real-time Updates and Actions
**Priority: Medium | Timeline: 2 hours**

1. **WebSocket Integration**
   - Update dashboard when new emails arrive
   - Real-time status changes
   - Assignment notifications
   - Action completion updates

2. **Action Handlers**
   - Assignment dropdown for Marketing emails
   - Action buttons for VMware support
   - Status update capability
   - Email response functionality

### Phase 6: Testing and Refinement
**Priority: High | Timeline: 2 hours**

1. **Data Validation**
   - Ensure all emails are properly categorized
   - Verify summary accuracy
   - Test status determination logic
   - Validate real-time updates

2. **UI/UX Testing**
   - Match screenshot layout precisely
   - Test responsive behavior
   - Verify all interactions work
   - Performance optimization

## Technical Implementation Details

### Data Flow
1. **Email Ingestion**
   ```
   IEMS Email Batches → IEMSDataService → Database → API → UI
   ```

2. **Categorization Logic**
   ```typescript
   function categorizeEmail(email: RawEmail): EmailCategory {
     const recipient = email.Recipients[0]?.toLowerCase() || '';
     
     if (mailboxes.some(m => m.email.toLowerCase() === recipient)) {
       return 'email-alias';
     } else if (recipient.includes('marketing') || recipient.includes('splunk')) {
       return 'marketing-splunk';
     } else if (recipient.includes('vmware')) {
       return 'vmware-tdsynnex';
     }
     
     return 'email-alias'; // default
   }
   ```

3. **Summary Generation**
   ```typescript
   async function generateSummary(email: RawEmail): Promise<string> {
     if (email.FullAnalysis?.quick_summary) {
       return email.FullAnalysis.quick_summary;
     }
     
     // Use AI to generate summary
     const summary = await emailAnalysisAgent.analyzeSummary({
       subject: email.Subject,
       body: email.BodyText,
       keyPhrases: email.KeyPhrases
     });
     
     return summary;
   }
   ```

## File Structure
```
src/
├── api/
│   ├── routes/
│   │   └── iems-email.router.ts
│   ├── services/
│   │   └── IEMSDataService.ts
│   └── scripts/
│       └── import-iems-emails.ts
├── ui/
│   └── components/
│       └── Email/
│           ├── IEMSDashboard.tsx
│           ├── IEMSDashboard.css
│           ├── EmailAliasSection.tsx
│           ├── MarketingSplunkSection.tsx
│           └── VMwareTDSynnexSection.tsx
└── types/
    └── iems-email.types.ts
```

## Success Criteria
1. Dashboard matches screenshot layout exactly
2. All emails properly categorized into three sections
3. Status indicators working correctly
4. Assignment and action functionality operational
5. Real-time updates via WebSocket
6. Performance: Dashboard loads in <2 seconds
7. All IEMS email data properly imported and displayed

## Next Steps
1. Start with Phase 1: Data Integration
2. Build backend API endpoints
3. Implement UI components
4. Integrate email analysis
5. Add real-time features
6. Test with actual IEMS data