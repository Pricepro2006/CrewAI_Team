# Backend Integration Recovery Plan

## Critical Issues Identified

### 1. **Build Failures (BLOCKING)**
- **EmailChainAnalyzer.test.ts**: 26 syntax errors with invalid assignment syntax `mockDbData?.length || 0 = 0;`
- **ErrorTracker.ts**: Incorrect import path `../../utils/logger.js` (should be `../utils/logger.js`)
- **Multiple monitoring files**: Same incorrect logger import path

### 2. **API Server Cannot Start**
- Module resolution errors prevent server from starting
- TypeScript compilation fails due to test file syntax errors
- Import path issues in monitoring modules

### 3. **WebSocket Configuration Issues**
- Server expects WebSocket on port 8080 at `/ws` endpoint
- Frontend tries to connect to port 8080 but gets 404 errors
- tRPC WebSocket using different endpoint `/trpc-ws` on port 3001

### 4. **React Hook Error in Email Dashboard**
- Invalid hook call in EmailDashboard component
- Prevents entire email management section from loading

### 5. **Database Connection Issues**
- DatabaseManager appears functional but server can't start to test it
- Connection pooling implemented but untested

## Resolution Plan

### Phase 1: Fix Build Errors (IMMEDIATE)
1. **Fix EmailChainAnalyzer.test.ts syntax errors**
   - Replace all instances of `mockDbData?.length || 0 = 0;` with `mockDbData.length = 0;`
   - 26 locations need fixing (lines 443, 531, 537, 555, 571, 587, 604, 628, 639, 650, 664, 669, 683, 722, 756, 793, 827, 852, 891, 952, 965, 985, 1009, 1033, 1053, 1066)

2. **Fix import paths in monitoring modules**
   - Update ErrorTracker.ts: `../../utils/logger.js` → `../utils/logger.js`
   - Check and fix all monitoring files with incorrect paths

3. **Fix other import issues**
   - Update all microservices files with incorrect logger paths
   - Fix config/features/FeatureFlagService.ts import

### Phase 2: Start API Server
1. **Run build to verify fixes**
   ```bash
   npm run build:server
   ```

2. **Start API server**
   ```bash
   npm run dev:server
   ```

3. **Verify health endpoint**
   ```bash
   curl http://localhost:3001/health
   ```

### Phase 3: Fix WebSocket Integration
1. **Align WebSocket endpoints**
   - Main WebSocket server on 8080 at `/ws`
   - tRPC WebSocket on 3001 at `/trpc-ws`
   - Walmart WebSocket on 3001 at `/ws/walmart`

2. **Update frontend WebSocket clients**
   - Ensure correct ports and endpoints
   - Add proper error handling and reconnection logic

### Phase 4: Fix React Email Dashboard
1. **Debug hook error in EmailDashboard.tsx**
   - Check for conditional hook calls
   - Ensure hooks are at top level
   - Fix any hook dependency issues

2. **Test email dashboard functionality**
   - Verify data loading
   - Check chart rendering
   - Test ingestion panel

### Phase 5: Integration Testing
1. **Test agent connectivity**
   - Verify llama.cpp integration
   - Test each agent endpoint
   - Check RAG system integration

2. **Test data flow**
   - Database queries
   - API endpoints
   - WebSocket real-time updates

3. **Performance testing**
   - Load testing with multiple concurrent users
   - Memory usage monitoring
   - Response time measurements

## Priority Order
1. **P0 (Immediate)**: Fix build errors - Without this, nothing works
2. **P1 (Critical)**: Start API server - Enables all backend functionality  
3. **P2 (High)**: Fix WebSocket - Enables real-time features
4. **P3 (Medium)**: Fix Email Dashboard - Restores major feature
5. **P4 (Low)**: Integration testing - Ensures stability

## Expected Outcomes
- **Build Success**: All TypeScript compilation errors resolved
- **API Server Running**: Health check returns "healthy" status
- **WebSocket Connected**: No more 404 errors, real-time updates working
- **Email Dashboard Functional**: No React errors, data displays correctly
- **Agents Operational**: All agents respond to queries with actual data

## Time Estimate
- Phase 1: 15 minutes (syntax fixes)
- Phase 2: 10 minutes (server startup)
- Phase 3: 30 minutes (WebSocket alignment)
- Phase 4: 20 minutes (React debugging)
- Phase 5: 45 minutes (integration testing)

**Total: ~2 hours to full functionality**

## Success Metrics
- ✅ `npm run build:server` completes without errors
- ✅ API server starts and health check passes
- ✅ WebSocket connections established without errors
- ✅ All UI pages load without crashes
- ✅ Agents respond with real data (not placeholders)
- ✅ Real-time updates work in dashboard