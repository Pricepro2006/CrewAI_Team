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
import { api } from "../lib/trpc";
import { ChatInterface } from "./components/Chat/ChatInterface";
import { MainLayout } from "./components/Layout/MainLayout";
import { Dashboard } from "./components/Dashboard/Dashboard";
import { EmailDashboard } from "./components/Email/EmailDashboard";
import { Navigate } from "react-router-dom";
import { Agents } from "./components/Agents/Agents";
import { WebScraping } from "./components/WebScraping/WebScraping";
import { KnowledgeBase } from "./components/KnowledgeBase/KnowledgeBase";
import { VectorSearch } from "./components/VectorSearch/VectorSearch";
import { Settings } from "./components/Settings/Settings";
import { WalmartGroceryAgent } from "./components/WalmartAgent/WalmartGroceryAgent";
import { CSRFProvider, useCSRF } from "./hooks/useCSRF";
import { CSRFErrorBoundary } from "./components/Security/CSRFMonitor";
import { ErrorBoundary } from "./components/ErrorBoundary/index";
import { setupGlobalErrorHandlers } from "./utils/error-handling";
import { ToastContainer } from "./components/Toast/index";
import { NetworkStatus } from "./components/NetworkStatus/index";
import { webSocketConfig, getApiBaseUrl } from "../config/websocket.config";
import "./App.css";

// Setup global error handlers
setupGlobalErrorHandlers();

// Separate component that uses CSRF hook
function AppWithCSRF() {
  const { token, getHeaders } = useCSRF();

  // Apply dark mode by default
  React.useEffect(() => {
    document.documentElement.classList.add("dark");
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
            retryDelay: (attemptIndex) =>
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
              retryDelayMs: () => {
                // Exponential backoff with max delay of 30 seconds
                return Math.min(webSocketConfig.reconnectInterval * 2, 30000);
              },
              WebSocket: window.WebSocket,
              connectionParams: () => ({
                headers: {
                  ...getHeaders(),
                  authorization: localStorage.getItem("token")
                    ? `Bearer ${localStorage.getItem("token")}`
                    : undefined,
                },
              }),
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
              <Route index element={<Dashboard />} />
              <Route path="chat" element={<ChatInterface />} />
              <Route path="chat/:conversationId" element={<ChatInterface />} />
              <Route path="agents" element={<Agents />} />
              <Route path="email-dashboard" element={<EmailDashboard />} />
              <Route path="email-dashboard/*" element={<EmailDashboard />} />
              <Route
                path="iems-dashboard"
                element={<Navigate to="/email-dashboard" replace />}
              />
              <Route path="walmart" element={<WalmartGroceryAgent />} />
              <Route path="walmart/*" element={<WalmartGroceryAgent />} />
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

// Main App component with CSRF Provider
function App() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error("App Error Boundary:", error, errorInfo);
      }}
    >
      <CSRFErrorBoundary>
        <CSRFProvider>
          <AppWithCSRF />
        </CSRFProvider>
      </CSRFErrorBoundary>
    </ErrorBoundary>
  );
}

export default App;
