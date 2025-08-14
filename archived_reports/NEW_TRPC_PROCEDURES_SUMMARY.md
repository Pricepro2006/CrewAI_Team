# New tRPC Procedures Added to walmart-grocery.router.ts

This document summarizes the four new tRPC procedures that were added to the Walmart grocery router following existing patterns.

## 1. processGroceryInput

**Type**: Mutation
**Purpose**: Handle natural language input, return parsed items with live prices and updated totals

**Input Schema**:
```typescript
{
  conversationId: string,
  userId: string,
  input: string (1-1000 chars),
  location?: {
    zipCode: string,
    city: string,
    state: string
  }
}
```

**Features**:
- Integrates with WalmartChatAgent for natural language processing
- Returns structured grocery list with live pricing
- Emits real-time updates via WebSocket
- Handles location-based pricing
- Provides delivery eligibility information

## 2. getPurchaseHistory

**Type**: Query
**Purpose**: Retrieve user's purchase history with patterns

**Input Schema**:
```typescript
{
  userId: string,
  limit?: number (1-100, default: 20),
  offset?: number (min: 0, default: 0),
  timeframe?: "week" | "month" | "quarter" | "year" | "all" (default: "month"),
  includePatterns?: boolean (default: true)
}
```

**Features**:
- Time-based filtering (week, month, quarter, year, all)
- Pagination support
- Purchase pattern analysis (categories, products, spending habits)
- Integration with conversation service and RAG system
- Shopping behavior insights

## 3. getSmartRecommendations

**Type**: Query
**Purpose**: Get AI-powered product recommendations based on history and current deals

**Input Schema**:
```typescript
{
  userId: string,
  context?: "reorder" | "trending" | "deals" | "seasonal" | "personalized" (default: "personalized"),
  budget?: number (positive),
  dietaryRestrictions?: string[],
  excludeCategories?: string[],
  limit?: number (1-50, default: 10)
}
```

**Features**:
- Context-aware recommendations (reorder, trending, deals, seasonal, personalized)
- Budget-conscious filtering
- Dietary restriction support
- Integration with MasterOrchestrator for AI analysis
- Deal opportunity identification
- Real-time updates

## 4. calculateListTotals

**Type**: Mutation
**Purpose**: Real-time calculation of subtotal, tax, total, and savings

**Input Schema**:
```typescript
{
  items: Array<{
    productId: string,
    quantity: number (positive),
    price: number (positive),
    originalPrice?: number (positive)
  }>,
  location: {
    zipCode: string,
    state: string
  },
  promoCode?: string,
  loyaltyMember?: boolean (default: false)
}
```

**Features**:
- State-based tax calculation with real tax rates
- Promo code support (SAVE10, WELCOME5, GROCERY15, FREESHIP)
- Loyalty member discounts
- Delivery fee calculation with $35 free threshold
- Comprehensive breakdown with recommendations
- Real-time updates via WebSocket

## Real-time Event Integration

All procedures integrate with the existing WebSocket infrastructure and emit the following new events:

- `grocery_input_processed`: When natural language input is processed
- `recommendations_generated`: When AI recommendations are created
- `totals_calculated`: When list totals are computed

## Enhanced Subscription Support

The `onUpdate` subscription procedure has been extended to support the new event types:
- Added "grocery", "recommendations", "totals" to the event enum
- User-specific filtering for personalized events

## Architecture Compliance

All procedures follow the established tRPC patterns:
- Use zod schemas for input validation
- Integrate with existing services (WalmartChatAgent, conversation service, RAG system)
- Follow error handling patterns
- Use structured logging
- Support real-time updates
- Maintain type safety throughout

## Integration Points

- **WalmartChatAgent**: For natural language processing
- **Conversation Service**: For user history and context
- **RAG System**: For purchase data retrieval
- **Deal Data Service**: For current deals and promotions
- **MasterOrchestrator**: For AI-powered analysis
- **WebSocket Events**: For real-time updates

This implementation provides a comprehensive grocery shopping experience with live pricing, intelligent recommendations, and real-time total calculations while maintaining the existing architectural patterns and performance standards.