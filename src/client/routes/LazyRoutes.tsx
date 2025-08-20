import { lazy, ComponentType } from "react";
import type { EmailRecord } from '../../shared/types/core.types.js';

// Export prop types to fix TS4023 errors
export interface EmailDashboardMultiPanelProps {
  emails?: EmailRecord[];
  loading?: boolean;
  error?: Error | string | null;
  onEmailSelect?: (email: EmailRecord) => void;
  onAssignEmail?: (emailId: string, assignee: string) => void;
  onStatusChange?: (emailId: string, status: string) => void;
  className?: string;
}

export interface AdvancedEmailDashboardProps {
  emails?: EmailRecord[];
  loading?: boolean;
  error?: Error | string | null;
  className?: string;
  [key: string]: unknown;
}

export interface WalmartDashboardProps {
  className?: string;
  [key: string]: unknown;
}

export interface WalmartProductSearchProps {
  onSearch?: (query: string) => void;
  className?: string;
  [key: string]: unknown;
}

export interface WalmartShoppingCartProps {
  onCheckout?: () => void;
  className?: string;
  [key: string]: unknown;
}

export interface WalmartOrderHistoryProps {
  onOrderSelect?: (orderId: string) => void;
  className?: string;
  [key: string]: unknown;
}

export interface StatusDistributionChartProps {
  data: { red: number; yellow: number; green: number };
  totalEmails: number;
}

export interface WorkflowTimelineChartProps {
  data?: Array<{ date: string; count: number; status: string }>;
  className?: string;
  [key: string]: unknown;
}

export interface SLATrackingDashboardProps {
  data?: Array<{ metric: string; current: number; target: number; status: 'good' | 'warning' | 'critical' }>;
  className?: string;
  [key: string]: unknown;
}

// Lazy load dashboard components for code splitting
export const EmailDashboardDemo = lazy(
  () => import("../pages/EmailDashboardDemo").then(module => ({ default: module.EmailDashboardDemo }))
);

export const EmailDashboardMultiPanel = lazy(
  () => import("../components/dashboard/EmailDashboardMultiPanel").then(module => ({ default: module.EmailDashboardMultiPanel }))
);

export const AdvancedEmailDashboard = lazy(
  () => import("../components/dashboard/AdvancedEmailDashboard").then(module => ({ default: module.AdvancedEmailDashboard }))
);

// Lazy load Walmart components
export const WalmartDashboard = lazy(
  () => import("../components/walmart/WalmartDashboard").then(module => ({ default: module.WalmartDashboard }))
);

export const WalmartProductSearch = lazy(
  () => import("../components/walmart/WalmartProductSearch").then(module => ({ default: module.WalmartProductSearch }))
);

export const WalmartShoppingCart = lazy(
  () => import("../components/walmart/WalmartShoppingCart").then(module => ({ default: module.WalmartShoppingCart }))
);

export const WalmartOrderHistory = lazy(
  () => import("../components/walmart/WalmartOrderHistory").then(module => ({ default: module.WalmartOrderHistory }))
);

// Lazy load chart components
export const StatusDistributionChart = lazy(
  () => import("../components/charts/StatusDistributionChart").then(module => ({ default: module.StatusDistributionChart }))
);

export const WorkflowTimelineChart = lazy(
  () => import("../components/charts/WorkflowTimelineChart").then(module => ({ default: module.WorkflowTimelineChart }))
);

export const SLATrackingDashboard = lazy(
  () => import("../components/charts/SLATrackingDashboard").then(module => ({ default: module.SLATrackingDashboard }))
);