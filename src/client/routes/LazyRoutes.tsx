import { lazy } from "react";

// Export prop types to fix TS4023 errors
export interface EmailDashboardMultiPanelProps {
  emails?: any[];
  loading?: boolean;
  error?: any;
  onEmailSelect?: (email: any) => void;
  onAssignEmail?: (emailId: string, assignee: string) => void;
  onStatusChange?: (emailId: string, status: string) => void;
  className?: string;
}

export interface AdvancedEmailDashboardProps {
  [key: string]: any;
}

export interface WalmartDashboardProps {
  [key: string]: any;
}

export interface WalmartProductSearchProps {
  [key: string]: any;
}

export interface WalmartShoppingCartProps {
  [key: string]: any;
}

export interface WalmartOrderHistoryProps {
  [key: string]: any;
}

export interface StatusDistributionChartProps {
  data: { red: number; yellow: number; green: number };
  totalEmails: number;
}

export interface WorkflowTimelineChartProps {
  [key: string]: any;
}

export interface SLATrackingDashboardProps {
  [key: string]: any;
}

// Lazy load dashboard components for code splitting
export const EmailDashboardDemo = lazy(
  () => import("../pages/EmailDashboardDemo").then(module => ({ default: module.EmailDashboardDemo }))
);

export const EmailDashboardMultiPanel = lazy(
  () => import("../components/dashboard/EmailDashboardMultiPanel").then(module => ({ default: module.EmailDashboardMultiPanel as any }))
);

export const AdvancedEmailDashboard = lazy(
  () => import("../components/dashboard/AdvancedEmailDashboard").then(module => ({ default: module.AdvancedEmailDashboard as any }))
);

// Lazy load Walmart components
export const WalmartDashboard = lazy(
  () => import("../components/walmart/WalmartDashboard").then(module => ({ default: module.WalmartDashboard as any }))
);

export const WalmartProductSearch = lazy(
  () => import("../components/walmart/WalmartProductSearch").then(module => ({ default: module.WalmartProductSearch as any }))
);

export const WalmartShoppingCart = lazy(
  () => import("../components/walmart/WalmartShoppingCart").then(module => ({ default: module.WalmartShoppingCart as any }))
);

export const WalmartOrderHistory = lazy(
  () => import("../components/walmart/WalmartOrderHistory").then(module => ({ default: module.WalmartOrderHistory as any }))
);

// Lazy load chart components
export const StatusDistributionChart = lazy(
  () => import("../components/charts/StatusDistributionChart").then(module => ({ default: module.StatusDistributionChart as any }))
);

export const WorkflowTimelineChart = lazy(
  () => import("../components/charts/WorkflowTimelineChart").then(module => ({ default: module.WorkflowTimelineChart as any }))
);

export const SLATrackingDashboard = lazy(
  () => import("../components/charts/SLATrackingDashboard").then(module => ({ default: module.SLATrackingDashboard as any }))
);