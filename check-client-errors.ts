// Test compilation script to check client errors
import './src/client/components/ErrorBoundary';
import './src/client/components/charts/ChartBase';
import './src/client/components/dashboard/EmailDashboardMultiPanel';
import './src/client/components/email/EmailTable';
import './src/client/hooks/useEmailAssignment';
import './src/client/hooks/useOptimizedTRPC';
import './src/client/hooks/usePerformanceMonitor';
import './src/client/lib/api';
import './src/client/pages/EmailDashboardDemo';

console.log('Client compilation check');