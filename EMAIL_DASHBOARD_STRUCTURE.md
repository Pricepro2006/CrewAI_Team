# Email Dashboard Structure - What to Expect Under Each Submenu

## Dashboard Overview (/email-dashboard)
**Purpose**: Central hub for all email management activities

### Display:
- **Email List Table** with columns:
  - Email Alias (sender email address)
  - Requested By (recipient name)
  - Subject (email subject line)
  - Summary (brief AI-generated summary)
  - Status (visual indicator: 🔴 red, 🟡 yellow, 🟢 green)
- **Tab Navigation**:
  - Email Alias tab: Shows all emails
  - Marketing-Splunk tab: Marketing-related emails
  - VMware@TDSynnex tab: VMware support emails
- **Metrics Bar**: 8 key metrics cards showing system performance

## Email Analytics (/email-dashboard/analytics)
**Purpose**: Visual insights into email processing performance

### Display:
- **Email Analytics Dashboard** header
- **Status Distribution Chart** (Doughnut/Pie chart)
  - Shows breakdown of email statuses
  - Interactive chart type switcher
- **Workflow Timeline Chart** (Line chart)
  - Tracks workflow completion over time
  - Shows trends and patterns
- **Key Metrics Cards**:
  - Average Response Time (with trend indicator)
  - Workflow Completion Rate (with trend indicator)
  - Daily Email Volume (with trend indicator)
  - Agent Utilization (with trend indicator)

## Workflow Tracking (/email-dashboard/workflows)
**Purpose**: Monitor emails currently in workflow processing

### Display:
- **Workflow Tracking** header
- **Filtered Email Table** showing only emails with:
  - workflowState = "IN_PROGRESS"
  - Same table format as Dashboard Overview
  - Real-time updates as workflows progress
- **Workflow Status Indicators**:
  - START_POINT emails
  - IN_PROGRESS emails
  - COMPLETION emails

## Agent Performance (/email-dashboard/agents)
**Purpose**: Monitor and manage agent assignments and performance

### Display:
- **Agent Management** view
- **Agent List** with performance metrics:
  - Agent name and ID
  - Current workload
  - Average response time
  - Success rate
  - Active/Inactive status
- **Assignment Overview**:
  - Emails pending assignment
  - Current assignments per agent
  - Workload distribution chart

## Email Settings (/email-dashboard/settings)
**Purpose**: Configure email management system settings

### Display:
- **Email Management Settings** header
- **Configuration Sections**:
  1. **Email Aliases**
     - Configure email aliases and routing rules
     - Add/remove monitored email addresses
  2. **Workflow Configuration**
     - Set up workflow automation and triggers
     - Define workflow stages and transitions
  3. **Agent Assignment**
     - Manage agent assignments and workload distribution
     - Set assignment rules and priorities
  4. **Notifications**
     - Configure email alerts and notifications
     - Set up escalation rules

## Visual Design Consistency

### Color Scheme:
- **Headers**: Dark gray (#1f2937)
- **Background**: Light gray (#f3f4f6)
- **Cards/Tables**: White (#ffffff)
- **Status Indicators**:
  - 🔴 Red (#ef4444) - Critical/High Priority
  - 🟡 Yellow (#f59e0b) - Warning/Medium Priority
  - 🟢 Green (#10b981) - Success/Completed

### Typography:
- **Main Headers**: 20px, font-weight: 600
- **Section Headers**: 16px, font-weight: 600
- **Body Text**: 14px, regular
- **Table Headers**: 14px, font-weight: 500

### Layout:
- **Padding**: 24px for main content areas
- **Border Radius**: 8px for cards and containers
- **Shadows**: Subtle box-shadow for depth
- **Responsive**: Adapts to mobile screens