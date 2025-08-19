import { lazy } from "react";

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