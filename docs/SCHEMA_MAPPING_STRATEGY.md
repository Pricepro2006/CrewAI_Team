# Schema Mapping Strategy - Definitive Guide

## 🎯 Core Principle

**Database schema is the source of truth**. All code must adapt to the database, not vice versa.

## 📊 Schema Layers

### 1. Database Layer (Source of Truth)
The `emails_enhanced` table uses these column names:
- `internet_message_id` - RFC 5322 compliant message ID
- `sender_email` - Email address of sender
- `sender_name` - Display name of sender
- `body_content` - Email body text
- `received_date_time` - When email was received
- `conversation_id` - Microsoft Graph conversation ID

### 2. Entity Layer (Internal Domain Model)
TypeScript interfaces should match database exactly:
```typescript
interface EmailEntity {
  id: string;
  internet_message_id: string;  // Match DB column name
  sender_email: string;         // Match DB column name
  sender_name: string | null;   // Match DB column name
  body_content: string;         // Match DB column name
  received_date_time: string;   // Match DB column name
  conversation_id: string | null;
  // ... etc
}
```

### 3. API Response Layer (Frontend Contract)
Transform to frontend-friendly format:
```typescript
interface EmailApiResponse {
  id: string;
  messageId: string;        // Maps from internet_message_id
  from: {
    email: string;        // Maps from sender_email
    name: string | null;  // Maps from sender_name
  };
  body: string;           // Maps from body_content
  receivedAt: string;     // Maps from received_date_time
  conversationId: string | null;
  // ... etc
}
```

## 🔄 Mapping Functions

### Database → Entity (Repository Layer)
```typescript
// In EmailRepositoryImpl.ts
protected mapRowToEntity(row: any): EmailEntity {
  return {
    id: row.id,
    internet_message_id: row.internet_message_id,
    sender_email: row.sender_email,
    sender_name: row.sender_name,
    body_content: row.body_content,
    received_date_time: row.received_date_time,
    conversation_id: row.conversation_id,
    // Direct mapping - no transformation
  };
}
```

### Entity → API Response (Service Layer)
```typescript
// In UnifiedEmailService.ts
private mapEntityToApiResponse(entity: EmailEntity): EmailApiResponse {
  return {
    id: entity.id,
    messageId: entity.internet_message_id,  // Transform name
    from: {
      email: entity.sender_email,
      name: entity.sender_name
    },
    body: entity.body_content,
    receivedAt: entity.received_date_time,
    conversationId: entity.conversation_id,
    // Transform to frontend-friendly format
  };
}
```

## 📁 Files to Update

### 1. Type Definitions
- `/src/types/database/email.entity.ts` - Create new file with DB-matching types
- `/src/types/api/email.response.ts` - Create new file with API response types
- `/src/types/unified-email.types.ts` - Update to use API response types

### 2. Repository Layer
- `/src/database/repositories/EmailRepositoryImpl.ts`
  - Update all SQL queries to use actual column names
  - Update mapRowToEntity to match DB columns exactly
  - Remove any field name transformations

### 3. Service Layer
- `/src/api/services/UnifiedEmailService.ts`
  - Add mapEntityToApiResponse method
  - Transform entity to API format here
- `/src/api/services/RealEmailStorageService.ts`
  - Update queries to use correct column names
  - Add proper entity-to-API mapping

### 4. Remove Old Mappings
- Any place doing `row.message_id` → change to `row.internet_message_id`
- Any place doing `entity.message_id` → change to `entity.internet_message_id`

## 🛡️ Validation Strategy

### 1. Startup Validation
```typescript
// In server startup
async function validateDatabaseSchema() {
  const expectedColumns = [
    'internet_message_id',
    'sender_email',
    'body_content',
    // ... etc
  ];
  
  const actualColumns = await getTableColumns('emails_enhanced');
  const missing = expectedColumns.filter(col => !actualColumns.includes(col));
  
  if (missing.length > 0) {
    throw new Error(`Database schema mismatch. Missing columns: ${missing.join(', ')}`);
  }
}
```

### 2. Runtime Type Guards
```typescript
function isValidEmailEntity(obj: any): obj is EmailEntity {
  return (
    typeof obj.internet_message_id === 'string' &&
    typeof obj.sender_email === 'string' &&
    typeof obj.body_content === 'string'
    // ... etc
  );
}
```

## 🚦 Migration Steps

1. **Create New Type Files** ✅
   - Database entity types (match DB exactly)
   - API response types (frontend contract)
   - Mapping function types

2. **Update Repository Layer** ✅
   - Fix all SQL queries
   - Update entity mapping
   - Add validation

3. **Update Service Layer** ✅
   - Add transformation logic
   - Keep API contract stable
   - Add logging for debugging

4. **Add Schema Validation** ✅
   - Startup checks
   - Runtime guards
   - Error reporting

5. **Update Tests** ✅
   - Repository tests use DB column names
   - Service tests verify transformations
   - Integration tests check full flow

## ⚠️ Common Pitfalls to Avoid

1. **Don't Mix Layers**: Keep DB names in repository, API names in services
2. **Don't Transform in Repository**: Repositories should be pure DB access
3. **Don't Leak DB Names to Frontend**: Always transform in service layer
4. **Don't Forget Null Handling**: DB nulls need proper TypeScript types

## 📋 Checklist

- [ ] All SQL queries use actual DB column names
- [ ] Entity types match database exactly
- [ ] Service layer handles all transformations
- [ ] API responses have consistent, frontend-friendly names
- [ ] Schema validation runs on startup
- [ ] Tests verify both DB access and API transformation
- [ ] No direct DB column names in frontend code

## 🎯 End Goal

- **Database**: Uses proper email field names (internet_message_id)
- **Backend**: Clean separation between DB and API layers
- **Frontend**: Gets consistent, camelCase API responses
- **Maintenance**: Easy to update when schema changes
- **Reliability**: Catches mismatches early with validation

---
This strategy ensures we never have schema mismatch issues again.