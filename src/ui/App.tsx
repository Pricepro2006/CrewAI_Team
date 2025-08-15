import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  httpBatchLink,
  httpLink,
  wsLink,
  splitLink,
  createWSClient,
} from "@trpc/client";
import superjson from "superjson";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { api } from "../lib/trpc.js";
import { ChatInterface } from "./components/Chat/ChatInterface.js";
import { MainLayout } from "./components/Layout/MainLayout.js";
import { Dashboard } from "./components/Dashboard/Dashboard.js";
import { EmailDashboard } from "./components/Email/EmailDashboard.js";
import { Navigate } from "react-router-dom";
import { Agents } from "./components/Agents/Agents.js";
import { WebScraping } from "./components/WebScraping/WebScraping.js";
import { KnowledgeBase } from "./components/KnowledgeBase/KnowledgeBase.js";
import { VectorSearch } from "./components/VectorSearch/VectorSearch.js";
import { Settings } from "./components/Settings/Settings.js";
import { WalmartGroceryAgent } from "./components/WalmartAgent/WalmartGroceryAgent.js";
import { CSRFProvider, useCSRF } from "./hooks/useCSRF.js";
import { CSRFErrorBoundary } from "./components/Security/CSRFMonitor.js";
import { ErrorBoundary } from "./components/ErrorBoundary/index.js";
import { setupGlobalErrorHandlers } from "./utils/error-handling.js";
import { ToastContainer } from "./components/Toast/index.js";
import { NetworkStatus } from "./components/NetworkStatus/index.js";
import { webSocketConfig, getApiBaseUrl } from "../config/websocket.config.js";
import { ErrorProvider } from "./contexts/ErrorContext.js";
import {
  DashboardErrorBoundary,
  WalmartErrorBoundary,
  ChatErrorBoundary,
  EmailErrorBoundary,
} from "./components/ErrorBoundary/SectionErrorBoundary.js";
import { logger } from "../utils/logger.js";
import "./App.css";

// Setup global error handlers
setupGlobalErrorHandlers();

// Separate component that uses CSRF hook
function AppWithCSRF() {
  const { token, getHeaders } = useCSRF();

  // Apply dark mode by default
  React.useEffect(() => {
    document?.documentElement?.classList.add("dark");
  }, []);

  // Create query client inside component with improved retry logic
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            cacheTime: 10 * 60 * 1000, // 10 minutes
            retry: (failureCount, error: any) => {
              // Don't retry on authentication/CSRF errors
              if (error?.status === 401 || error?.status === 403) {
                return false;
              }
              // Don't retry on 404 errors (missing endpoints)
              if (error?.status === 404) {
                return false;
              }
              // Don't retry on CSRF token errors
              if (
                error?.message?.includes("CSRF") ||
                error?.message?.includes("csrf")
              ) {
                return false;
              }
              // Don't retry if we've already tried 3 times
              if (failureCount >= 3) {
                return false;
              }
              return true;
            },
            retryDelay: (attemptIndex: any) =>
              Math.min(1000 * 2 ** attemptIndex, 30000),
          },
        },
      }),
  );

  // Create tRPC client with CSRF support
  const [trpcClient] = React.useState(() =>
    api.createClient({
      transformer: superjson,
      links: [
        splitLink({
          condition(op) {
            return op.type === "subscription";
          },
          true: wsLink({
            client: createWSClient({
              url: webSocketConfig.url,
              retryDelayMs: (attemptIndex) => {
                // Exponential backoff with jitter
                const delay = Math.min(1000 * Math.pow(2, attemptIndex), 30000);
                return delay + Math.random() * 1000;
              },
              WebSocket: window.WebSocket,
              onOpen: () => {
                logger.info('tRPC WebSocket connected', 'WEBSOCKET');
              },
              onClose: (cause) => {
                logger.info('tRPC WebSocket disconnected', 'WEBSOCKET', { cause });
              },
              // connectionParams is not available in this version of tRPC WebSocket client
              // Authentication is handled via query parameters or headers in the URL
            }),
          }),
          false: httpBatchLink({
            url: `${getApiBaseUrl()}/trpc`,
            headers() {
              const authToken = localStorage.getItem("token");
              return {
                ...getHeaders(), // Include CSRF headers
                ...(authToken && { authorization: `Bearer ${authToken}` }),
              };
            },
            // Add CORS credentials
            fetch(url, options) {
              return fetch(url, {
                ...options,
                credentials: "include",
              });
            },
          }),
        }),
      ],
    }),
  );

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {/* Global UI Components */}
        <NetworkStatus position="top" showWhenOnline={true} />
        <ToastContainer position="top-right" maxToasts={5} />

        <Router>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={
                <DashboardErrorBoundary>
                  <Dashboard />
                </DashboardErrorBoundary>
              } />
              <Route path="chat" element={
                <ChatErrorBoundary>
                  <ChatInterface />
                </ChatErrorBoundary>
              } />
              <Route path="chat/:conversationId" element={
                <ChatErrorBoundary>
                  <ChatInterface />
                </ChatErrorBoundary>
              } />
              <Route path="agents" element={<Agents />} />
              <Route path="email-dashboard" element={
                <EmailErrorBoundary>
                  <EmailDashboard />
                </EmailErrorBoundary>
              } />
              <Route path="email-dashboard/*" element={
                <EmailErrorBoundary>
                  <EmailDashboard />
                </EmailErrorBoundary>
              } />
              <Route
                path="iems-dashboard"
                element={<Navigate to="/email-dashboard" replace />}
              />
              <Route path="walmart" element={
                <WalmartErrorBoundary>
                  <WalmartGroceryAgent />
                </WalmartErrorBoundary>
              } />
              <Route path="walmart/*" element={
                <WalmartErrorBoundary>
                  <WalmartGroceryAgent />
                </WalmartErrorBoundary>
              } />
              <Route path="web-scraping" element={<WebScraping />} />
              <Route path="knowledge-base" element={<KnowledgeBase />} />
              <Route path="vector-search" element={<VectorSearch />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </Router>
      </QueryClientProvider>
    </api.Provider>
  );
}

// Main App component with CSRF Provider and Error Context
function App() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error("App Error Boundary:", error, errorInfo);
      }}
    >
      <ErrorProvider maxErrors={100} autoCleanup={true}>
        <CSRFErrorBoundary>
          <CSRFProvider>
            <AppWithCSRF />
          </CSRFProvider>
        </CSRFErrorBoundary>
      </ErrorProvider>
    </ErrorBoundary>
  );
}

export default App;
