# Email Dashboard Component Architecture

## Overview
This document outlines the new table-based component architecture for the Email Dashboard, replacing the current card-based layout to match the target design.

## Component Hierarchy

```
EmailDashboard/
├── EmailDashboardLayout
│   ├── DashboardHeader
│   │   ├── PageTitle
│   │   ├── RefreshButton
│   │   └── ActionButtons
│   ├── DashboardStats
│   │   ├── StatCard (Total Emails)
│   │   ├── StatCard (Critical)
│   │   ├── StatCard (In Progress)
│   │   └── StatCard (Completed)
│   ├── EmailTableContainer
│   │   ├── TableToolbar
│   │   │   ├── SearchBar
│   │   │   ├── FilterDropdowns
│   │   │   └── ExportButtons
│   │   ├── EmailTable
│   │   │   ├── TableHeader
│   │   │   ├── TableBody
│   │   │   │   └── EmailRow
│   │   │   │       ├── StatusIndicator
│   │   │   │       ├── EmailAlias
│   │   │   │       ├── RequestedBy
│   │   │   │       ├── Subject
│   │   │   │       └── Summary
│   │   │   └── TablePagination
│   │   └── EmptyState
│   └── EmailDetailsSidebar
│       ├── EmailDetails
│       ├── ActionButtons
│       └── ActivityLog
```

## Core Components

### 1. EmailTable Component
The main table component that displays email data in a structured format.

**Features:**
- Sortable columns
- Selectable rows
- Responsive design
- Virtual scrolling for performance
- Column resizing
- Fixed header during scroll

**Props:**
```typescript
interface EmailTableProps {
  emails: EmailRecord[];
  loading?: boolean;
  selectedEmails?: string[];
  onEmailSelect?: (emailId: string) => void;
  onEmailsSelect?: (emailIds: string[]) => void;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onRowClick?: (email: EmailRecord) => void;
}
```

### 2. StatusIndicator Component
Visual indicator showing email status as colored circles.

**Features:**
- Three states: Red (Critical), Yellow (In Progress), Green (Completed)
- Tooltip with status text
- Pulsing animation for critical items
- Accessibility support

**Props:**
```typescript
interface StatusIndicatorProps {
  status: 'red' | 'yellow' | 'green';
  statusText: string;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
  className?: string;
}
```

### 3. TableToolbar Component
Controls for filtering, searching, and exporting table data.

**Features:**
- Global search across all columns
- Column-specific filters
- Date range picker
- Export to CSV/Excel
- Saved filter presets
- Clear all filters

**Props:**
```typescript
interface TableToolbarProps {
  onSearch: (query: string) => void;
  onFilter: (filters: FilterConfig) => void;
  onExport: (format: 'csv' | 'excel') => void;
  filters: FilterConfig;
  totalResults: number;
}
```

### 4. FilterPanel Component
Advanced filtering UI for the email table.

**Features:**
- Multi-select dropdowns
- Date range selection
- Status checkboxes
- Workflow type filters
- Priority filters
- Custom filter builder

**Props:**
```typescript
interface FilterPanelProps {
  filters: FilterConfig;
  onFilterChange: (filters: FilterConfig) => void;
  availableOptions: {
    emailAliases: string[];
    requesters: string[];
    statuses: StatusOption[];
    workflowTypes: string[];
    priorities: string[];
  };
}
```

### 5. DashboardStats Component
Summary statistics displayed above the table.

**Features:**
- Real-time updates
- Animated number transitions
- Click to filter functionality
- Responsive grid layout

**Props:**
```typescript
interface DashboardStatsProps {
  totalEmails: number;
  criticalCount: number;
  inProgressCount: number;
  completedCount: number;
  onStatClick?: (statType: string) => void;
}
```

## State Management

### Email State Interface
```typescript
interface EmailDashboardState {
  emails: EmailRecord[];
  loading: boolean;
  error: string | null;
  filters: FilterConfig;
  sorting: SortConfig;
  pagination: PaginationConfig;
  selectedEmails: string[];
  activeEmail: EmailRecord | null;
}

interface FilterConfig {
  search: string;
  emailAliases: string[];
  requesters: string[];
  statuses: ('red' | 'yellow' | 'green')[];
  workflowTypes: string[];
  priorities: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
}
```

## Styling Architecture

### Design Tokens
```scss
// Colors
$status-red: #DC2626;
$status-yellow: #F59E0B;
$status-green: #10B981;
$table-border: #E5E7EB;
$table-header-bg: #F9FAFB;
$row-hover: #F3F4F6;

// Spacing
$table-padding: 16px;
$row-height: 56px;
$indicator-size: 12px;

// Typography
$font-primary: 'Inter', sans-serif;
$text-primary: #111827;
$text-secondary: #6B7280;
```

### Component Classes
```scss
.email-table {
  &__container { }
  &__header { }
  &__body { }
  &__row {
    &--selected { }
    &--hover { }
  }
  &__cell {
    &--status { }
    &--email { }
    &--requester { }
    &--subject { }
    &--summary { }
  }
}

.status-indicator {
  &--red { }
  &--yellow { }
  &--green { }
  &--pulse { }
}
```

## Performance Considerations

### Optimization Strategies
1. **Virtual Scrolling**: Render only visible rows
2. **Memoization**: Use React.memo for row components
3. **Debounced Search**: Delay API calls during typing
4. **Lazy Loading**: Load data as user scrolls
5. **Column Virtualization**: For wide tables
6. **Web Workers**: For heavy filtering operations

### Bundle Size Optimization
- Tree-shaking unused components
- Code splitting by route
- Dynamic imports for heavy features
- CSS modules for scoped styles

## Accessibility

### WCAG 2.1 Compliance
- Keyboard navigation support
- Screen reader announcements
- ARIA labels and descriptions
- Focus management
- Color contrast ratios
- Alternative text for status indicators

### Keyboard Shortcuts
- `Tab`: Navigate between elements
- `Space`: Select/deselect row
- `Enter`: Open email details
- `Ctrl+A`: Select all
- `Escape`: Close modals/sidebars

## Migration Strategy

### Phase 1: Component Development
1. Build new components in isolation
2. Create Storybook stories
3. Unit test all components
4. Integration tests

### Phase 2: Integration
1. Create feature flag for new UI
2. Implement side-by-side with old UI
3. Migrate state management
4. Update API endpoints

### Phase 3: Rollout
1. Beta test with subset of users
2. Gather feedback and iterate
3. Full rollout with fallback
4. Remove old components

## Component API Examples

### EmailTable Usage
```tsx
<EmailTable
  emails={filteredEmails}
  loading={isLoading}
  selectedEmails={selectedIds}
  onEmailSelect={handleEmailSelect}
  onSort={handleSort}
  onRowClick={handleRowClick}
/>
```

### StatusIndicator Usage
```tsx
<StatusIndicator
  status={email.status}
  statusText={email.status_text}
  size="md"
  showPulse={email.status === 'red'}
/>
```

### FilterPanel Usage
```tsx
<FilterPanel
  filters={currentFilters}
  onFilterChange={handleFilterChange}
  availableOptions={{
    emailAliases: uniqueEmailAliases,
    requesters: uniqueRequesters,
    statuses: statusOptions,
    workflowTypes: workflowTypes,
    priorities: ['Critical', 'High', 'Medium', 'Low']
  }}
/>
```

## Testing Strategy

### Component Testing
- Unit tests for all components
- Integration tests for component interactions
- Visual regression tests
- Performance benchmarks
- Accessibility audits

### Test Coverage Goals
- 90%+ unit test coverage
- Critical path E2E tests
- Performance budgets
- Accessibility score > 95

## Documentation

### Component Documentation
- Props documentation with TypeScript
- Usage examples
- Best practices
- Common patterns
- Troubleshooting guide

### Developer Guidelines
- Naming conventions
- File structure
- State management patterns
- Performance guidelines
- Accessibility checklist