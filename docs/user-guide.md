# Email Dashboard User Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Dashboard Overview](#dashboard-overview)
4. [Email Table Features](#email-table-features)
5. [Filtering and Search](#filtering-and-search)
6. [Status Management](#status-management)
7. [Analytics Dashboard](#analytics-dashboard)
8. [Export and Reporting](#export-and-reporting)
9. [Real-time Updates](#real-time-updates)
10. [Troubleshooting](#troubleshooting)

## Introduction

The TD SYNNEX Email Dashboard is a comprehensive email management system designed to streamline email processing, tracking, and analytics. This guide will help you navigate and utilize all features effectively.

### Key Features
- **Real-time email tracking** with WebSocket updates
- **Advanced filtering** with multi-column search
- **Status management** with workflow tracking
- **Analytics dashboard** with visual insights
- **Export capabilities** for CSV and Excel formats
- **SLA tracking** for performance monitoring

## Getting Started

### Accessing the Dashboard
1. Navigate to https://email-dashboard.tdsynnex.com
2. Login with your TD SYNNEX credentials
3. You'll be directed to the main dashboard view

### First-Time Setup
1. **Set your preferences** in Settings → User Preferences
2. **Configure notifications** for real-time alerts
3. **Save filter presets** for quick access
4. **Customize dashboard layout** to your workflow

## Dashboard Overview

### Main Components

#### 1. Email Table
The central component displaying all emails with:
- Email Alias
- Requested By
- Subject
- Summary
- Current Status
- Action buttons

#### 2. Status Indicators
- 🔴 **Red**: Critical/Urgent emails requiring immediate attention
- 🟡 **Yellow**: Pending emails awaiting action
- 🟢 **Green**: Completed/Resolved emails

#### 3. Top Navigation
- **Dashboard**: Main email table view
- **Analytics**: Performance metrics and charts
- **Reports**: Export and reporting tools
- **Settings**: User preferences and configuration

## Email Table Features

### Sorting
- Click any column header to sort
- Click again to reverse sort order
- Multi-column sorting with Shift+Click

### Column Management
1. Right-click any column header
2. Select "Column Settings"
3. Toggle columns on/off
4. Drag to reorder columns

### Row Actions
- **View**: Opens email details
- **Edit**: Modify email status/assignment
- **Archive**: Move to archive
- **Delete**: Remove email (with confirmation)

## Filtering and Search

### Global Search
- Use the search bar at the top
- Searches across all visible columns
- Real-time results as you type

### Advanced Filtering

#### Creating Filters
1. Click "Advanced Filter" button
2. Select column to filter
3. Choose operator:
   - Contains
   - Equals
   - Starts with
   - Ends with
   - Greater than/Less than (dates)
   - Regex (advanced users)
4. Enter filter value
5. Click "Apply"

#### Filter Presets
1. Create your filter combination
2. Click "Save Preset"
3. Name your preset
4. Access saved presets from dropdown

#### Multi-Column Filtering
- Add multiple filter rules
- Choose AND/OR logic between rules
- Group filters for complex queries

Example:
```
Status = "Pending" AND 
(Subject contains "urgent" OR Priority = "High")
```

## Status Management

### Changing Email Status
1. Click the status indicator
2. Select new status from dropdown
3. Add optional comment
4. Click "Update"

### Workflow States
- **New**: Unprocessed emails
- **In Progress**: Currently being handled
- **Pending**: Awaiting response/action
- **Resolved**: Completed successfully
- **Escalated**: Requires supervisor attention

### Bulk Status Updates
1. Select multiple emails (checkbox)
2. Click "Bulk Actions"
3. Choose "Update Status"
4. Select new status
5. Confirm action

## Analytics Dashboard

### Key Metrics
- **Total Emails**: Current volume
- **Average Response Time**: SLA tracking
- **Status Distribution**: Visual breakdown
- **Trend Analysis**: Historical patterns

### Charts and Visualizations

#### Status Distribution Chart
- Pie chart showing email status breakdown
- Click segments to drill down
- Export chart as image

#### Response Time Trends
- Line graph of response times
- Toggle between daily/weekly/monthly views
- Identify peak periods

#### SLA Compliance
- Gauge showing current compliance %
- Red/Yellow/Green indicators
- Historical compliance tracking

### Custom Analytics
1. Click "Custom Report"
2. Select metrics to include
3. Choose date range
4. Generate report

## Export and Reporting

### Quick Export
1. Select emails to export
2. Click "Export" button
3. Choose format:
   - CSV
   - Excel (XLSX)
   - PDF (coming soon)

### Scheduled Reports
1. Navigate to Reports → Scheduled
2. Click "Create New Schedule"
3. Configure:
   - Report type
   - Recipients
   - Frequency (daily/weekly/monthly)
   - Time of delivery
4. Save schedule

### Report Templates
- **Daily Summary**: Email volume and status
- **SLA Report**: Performance metrics
- **User Activity**: Individual performance
- **Custom Template**: Build your own

## Real-time Updates

### WebSocket Notifications
- Automatic updates when emails arrive
- Status changes reflected instantly
- No need to refresh the page

### Notification Settings
1. Click notification bell icon
2. Configure:
   - Desktop notifications
   - Sound alerts
   - Email notifications
   - Specific event triggers

### Connection Status
- Green dot: Connected
- Yellow dot: Reconnecting
- Red dot: Disconnected

## Troubleshooting

### Common Issues

#### Page Not Loading
1. Clear browser cache
2. Check internet connection
3. Try incognito/private mode
4. Contact IT support

#### Export Not Working
1. Check popup blocker settings
2. Ensure sufficient permissions
3. Try smaller data selection
4. Use different browser

#### Missing Emails
1. Check filter settings
2. Verify date range
3. Confirm permissions
4. Refresh the page

### Performance Tips
- Use filter presets for complex queries
- Export large datasets in batches
- Close unused browser tabs
- Enable browser hardware acceleration

### Getting Help
- **Help Center**: Click "?" icon
- **Support Email**: emaildashboard-support@tdsynnex.com
- **IT Helpdesk**: Extension 5555
- **Training Videos**: Available in Help Center

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Search | Ctrl/Cmd + K |
| New Filter | Ctrl/Cmd + F |
| Export | Ctrl/Cmd + E |
| Refresh | F5 |
| Select All | Ctrl/Cmd + A |
| Clear Filters | Ctrl/Cmd + Shift + F |

## Best Practices

1. **Regular Maintenance**
   - Archive resolved emails monthly
   - Update filter presets as needed
   - Review analytics weekly

2. **Efficient Workflow**
   - Use keyboard shortcuts
   - Create personalized filter presets
   - Set up automated reports

3. **Data Management**
   - Export important data regularly
   - Use meaningful status updates
   - Add comments for context

---

*Last Updated: January 2025*
*Version: 1.0.0*