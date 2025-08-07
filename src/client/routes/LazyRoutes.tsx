import { lazy } from "react";

// Lazy load dashboard components for code splitting
export const EmailDashboardDemo = lazy(
  () => import("../pages/EmailDashboardDemo")
);

export const EmailDashboardMultiPanel = lazy(
  () => import("../components/dashboard/EmailDashboardMultiPanel")
);

export const AdvancedEmailDashboard = lazy(
  () => import("../components/dashboard/AdvancedEmailDashboard")
);

// Lazy load Walmart components
export const WalmartDashboard = lazy(
  () => import("../components/walmart/WalmartDashboard")
);

export const WalmartProductSearch = lazy(
  () => import("../components/walmart/WalmartProductSearch")
);

export const WalmartShoppingCart = lazy(
  () => import("../components/walmart/WalmartShoppingCart")
);

export const WalmartOrderHistory = lazy(
  () => import("../components/walmart/WalmartOrderHistory")
);

// Lazy load chart components
export const StatusDistributionChart = lazy(
  () => import("../components/charts/StatusDistributionChart")
);

export const WorkflowTimelineChart = lazy(
  () => import("../components/charts/WorkflowTimelineChart")
);

export const SLATrackingDashboard = lazy(
  () => import("../components/charts/SLATrackingDashboard")
);