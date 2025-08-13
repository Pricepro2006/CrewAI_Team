# Business Intelligence Architecture

## Overview

The CrewAI Team business intelligence system extracts valuable insights from processed emails, including purchase orders, quotes, customer relationships, and workflow patterns. This document outlines the EXISTING architecture and how to enhance the integration between backend services and the TypeScript/React frontend.

## Current State (August 2025)

### Existing TypeScript Infrastructure

The system already has a comprehensive business intelligence infrastructure in TypeScript:

1. **OptimizedBusinessAnalysisService** (`src/core/services/OptimizedBusinessAnalysisService.ts`)
   - Handles multi-phase analysis (Phase 1: Rule-based, Phase 2: Llama 3.2, Phase 3: Phi-4)
   - Extracts business intelligence including financial impact, operational insights
   - Manages performance optimization and caching
   - Provides executive-level strategic analysis

2. **BusinessContextManager** (`src/core/context/BusinessContextManager.ts`)
   - Builds comprehensive business context for analysis
   - Optimizes token usage for LLM calls
   - Manages financial, operational, and strategic context

3. **BusinessIntelligencePrompts** (`src/core/prompts/BusinessIntelligencePrompts.ts`)
   - Generates specialized prompts for business analysis
   - Parses LLM responses into structured business intelligence

4. **Frontend Components**
   - `AnalyticsView.tsx` - Displays workflow analytics and metrics
   - `UnifiedEmailDashboard` - Main dashboard with analytics integration

### Python Analysis Layer
- **Scripts**: `generate_bi_report_simple.py`, `create_business_intelligence_dashboard.py`
- **Database**: Direct SQLite queries on `crewai_enhanced.db`
- **Capabilities**:
  - Extracts PO numbers, quote numbers, customer data
  - Calculates workflow distribution and priority metrics
  - Identifies business value from processed emails
  - Generates text reports and visualization charts

### TypeScript Backend
- **API**: tRPC router with basic analytics endpoints
- **Services**: `RealEmailStorageService` for database access
- **Current Endpoints**:
  - `getDashboardStats`: Basic email statistics
  - `getAnalytics`: Workflow analytics
  - `getWorkflowPatterns`: Pattern analysis

### React Frontend
- **Components**: `AnalyticsView.tsx`, dashboard components
- **Displays**: Workflow completion, response times, agent utilization
- **Charts**: Status distribution, workflow timeline

## Implementation Status (August 5, 2025)

✅ **COMPLETED**: The Business Intelligence integration is now fully operational using the Direct TypeScript Integration approach.

## Implemented Architecture

### 1. Direct TypeScript Integration (IMPLEMENTED)

```typescript
// New BusinessIntelligenceService.ts
export class BusinessIntelligenceService {
  // Port Python logic to TypeScript
  async extractBusinessMetrics() {
    // Query database for processed emails
    // Extract entities (PO, quotes, customers)
    // Calculate business value
    // Return structured BI data
  }
}
```

**Advantages**:
- Single technology stack
- Direct database access
- Type safety throughout
- No inter-process communication overhead
- Easier deployment and maintenance

### 2. Implementation Complete

#### Phase 1: Backend Service Creation ✅
1. Created `BusinessIntelligenceService.ts`
2. Ported key Python analysis functions:
   - Entity extraction (PO numbers, quotes) ✅
   - Customer analysis ✅
   - Workflow distribution ✅
   - Business value calculation ✅
3. Implemented caching for expensive calculations ✅

#### Phase 2: API Enhancement ✅
1. Added new tRPC endpoints:
   ```typescript
   getBusinessIntelligence: publicProcedure
     .input(BusinessIntelligenceInputSchema)
     .query(async ({ input }) => {
       const biService = new BusinessIntelligenceService();
       return await biService.getBusinessMetrics(input);
     })
   ```

2. Endpoint structure: ✅
   - `/api/trpc/email.getBusinessIntelligence` - Main BI data ✅
   - `/api/trpc/email.getBISummary` - Summary metrics ✅
   - `/api/trpc/email.getCustomerInsights` - Customer-specific analysis ✅
   - `/api/trpc/email.getValueMetrics` - Business value tracking ✅

#### Phase 3: Frontend Integration ✅
1. Created new BI components:
   - `BusinessIntelligenceDashboard.tsx` ✅
   - Integrated with existing chart components ✅
   - Added to main navigation menu ✅

2. Updated UnifiedEmailDashboard to include BI view ✅

## Data Flow

```
SQLite Database (crewai_enhanced.db)
         ↓
BusinessIntelligenceService (TypeScript)
         ↓
tRPC API Endpoints
         ↓
React Components
         ↓
User Dashboard
```

## Business Intelligence Metrics

### Core Metrics Extracted
1. **Entity Metrics**:
   - Total unique PO numbers
   - Total unique quote numbers
   - Customer distribution
   - Product/service mentions

2. **Workflow Metrics**:
   - Workflow type distribution
   - Priority distribution
   - Processing time analysis
   - Chain completeness scores

3. **Business Value Metrics**:
   - Total identified value
   - Value by workflow type
   - Value by customer
   - Value trends over time

4. **Performance Metrics**:
   - Email processing rate
   - LLM confidence scores
   - Response time averages

### Data Structure Example

```typescript
interface BusinessIntelligenceData {
  summary: {
    totalEmailsAnalyzed: number;
    totalBusinessValue: number;
    uniquePOCount: number;
    uniqueQuoteCount: number;
    uniqueCustomerCount: number;
  };
  
  workflowDistribution: {
    type: string;
    count: number;
    percentage: number;
    avgValue: number;
  }[];
  
  priorityDistribution: {
    level: 'Critical' | 'High' | 'Medium' | 'Low';
    count: number;
    percentage: number;
  }[];
  
  topCustomers: {
    name: string;
    emailCount: number;
    totalValue: number;
    avgResponseTime: number;
  }[];
  
  entityExtracts: {
    poNumbers: string[];
    quoteNumbers: string[];
    recentHighValueItems: {
      type: string;
      value: number;
      customer: string;
      date: string;
    }[];
  };
  
  processingMetrics: {
    avgConfidence: number;
    avgProcessingTime: number;
    successRate: number;
    timeRange: {
      start: string;
      end: string;
    };
  };
}
```

## Implementation Timeline (COMPLETED)

1. **August 5, 2025**: ✅ All phases completed in single session
   - Created BusinessIntelligenceService with core metrics
   - Added all tRPC endpoints and API integration
   - Built frontend BusinessIntelligenceDashboard component
   - Integrated with existing UI and navigation
   - Tested with live data from 941 analyzed emails

## Performance Considerations

1. **Caching Strategy**:
   - Cache expensive aggregations for 5 minutes
   - Invalidate cache on new email processing
   - Use Redis for distributed caching (future)

2. **Query Optimization**:
   - Create database indexes for BI queries
   - Use materialized views for common aggregations
   - Batch entity extraction queries

3. **Real-time Updates**:
   - WebSocket notifications for new BI insights
   - Incremental updates rather than full recalculation
   - Progressive loading for large datasets

## Security Considerations

1. **Data Access**:
   - Role-based access to BI metrics
   - Customer data isolation
   - Audit logging for BI queries

2. **Value Calculations**:
   - Sanitize extracted monetary values
   - Validate business logic calculations
   - Protect sensitive pricing information

## Future Enhancements

1. **Machine Learning Integration**:
   - Predictive value estimation
   - Anomaly detection in patterns
   - Customer behavior prediction

2. **Advanced Visualizations**:
   - Interactive dashboards
   - Drill-down capabilities
   - Export to PowerBI/Tableau

3. **External Integrations**:
   - ERP system connections
   - CRM data enrichment
   - Financial system reconciliation

## Migration Notes

The current Python scripts (`generate_bi_report_simple.py` and `create_business_intelligence_dashboard.py`) will remain as reference implementations and for batch reporting needs. The TypeScript implementation will become the primary source for real-time BI data in the web application.

## Related Documentation

- [Email Pipeline Architecture](./EMAIL_PIPELINE_PRODUCTION_ARCHITECTURE.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [API Documentation](./API_DOCUMENTATION.md)