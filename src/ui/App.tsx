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
import { UnifiedEmailDashboard } from "./components/UnifiedEmail/UnifiedEmailDashboard.js";
import { Navigate } from "react-router-dom";
import { Agents } from "./components/Agents/Agents.js";
import { WebScraping } from "./components/WebScraping/WebScraping.js";
import { KnowledgeBase } from "./components/KnowledgeBase/KnowledgeBase.js";
import { VectorSearch } from "./components/VectorSearch/VectorSearch.js";
import { Settings } from "./components/Settings/Settings.js";
import { WalmartDashboard } from "../client/components/walmart/WalmartDashboard.js";
import { CSRFProvider, useCSRF } from "./hooks/useCSRF.js";
import { CSRFErrorBoundary } from "./components/Security/CSRFMonitor.js";
import { ErrorBoundary } from "./components/ErrorBoundary/index.js";
import { setupGlobalErrorHandlers } from "./utils/error-handling.js";
import { ToastContainer } from "./components/Toast/index.js";
import { NetworkStatus } from "./components/NetworkStatus/index.js";
import "./App.css";

// Setup global error handlers
setupGlobalErrorHandlers();

// Separate component that uses CSRF hook
function AppWithCSRF() {
  const { token, getHeaders } = useCSRF();
  
  // Apply dark mode by default
  React.useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);
  
  // Create query client inside component
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            cacheTime: 10 * 60 * 1000, // 10 minutes
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
              url: `ws://localhost:3002/trpc-ws`,
              retryDelayMs: () => {
                // Exponential backoff with max delay of 30 seconds
                return Math.min(1000 * 2 ** 0, 30000);
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
            url: "http://localhost:3001/trpc",
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
              <Route
                path="email-dashboard"
                element={<UnifiedEmailDashboard />}
              />
              <Route
                path="email-dashboard/analytics"
                element={<UnifiedEmailDashboard initialView="analytics" />}
              />
              <Route
                path="email-dashboard/workflows"
                element={<UnifiedEmailDashboard initialView="workflows" />}
              />
              <Route
                path="email-dashboard/agents"
                element={<UnifiedEmailDashboard initialView="agents" />}
              />
              <Route
                path="email-dashboard/settings"
                element={<UnifiedEmailDashboard initialView="settings" />}
              />
              <Route
                path="iems-dashboard"
                element={<Navigate to="/email-dashboard" replace />}
              />
              <Route path="walmart" element={<WalmartDashboard />} />
              <Route path="walmart/search" element={<WalmartDashboard activeTab="search" />} />
              <Route path="walmart/cart" element={<WalmartDashboard activeTab="cart" />} />
              <Route path="walmart/lists" element={<WalmartDashboard activeTab="lists" />} />
              <Route path="walmart/budget" element={<WalmartDashboard activeTab="budget" />} />
              <Route path="walmart/orders" element={<WalmartDashboard activeTab="orders" />} />
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
        console.error('App Error Boundary:', error, errorInfo);
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
