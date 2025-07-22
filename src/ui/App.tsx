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
import { api } from "@/lib/trpc";
import { ChatInterface } from "./components/Chat/ChatInterface";
import { MainLayout } from "./components/Layout/MainLayout";
import { Dashboard } from "./components/Dashboard/Dashboard";
import { EmailDashboard } from "./components/Email/EmailDashboard";
import { IEMSDashboard } from "./components/IEMS/IEMSDashboard";
import { Agents } from "./components/Agents/Agents";
import { WebScraping } from "./components/WebScraping/WebScraping";
import { KnowledgeBase } from "./components/KnowledgeBase/KnowledgeBase";
import { VectorSearch } from "./components/VectorSearch/VectorSearch";
import { Settings } from "./components/Settings/Settings";
import "./App.css";

function App() {
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

  // Create tRPC client inside component
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
            }),
          }),
          false: httpLink({
            url: "http://localhost:3001/trpc",
            headers() {
              const token = localStorage.getItem("token");
              return token
                ? {
                    authorization: `Bearer ${token}`,
                  }
                : {};
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
        <Router>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="chat" element={<ChatInterface />} />
              <Route path="chat/:conversationId" element={<ChatInterface />} />
              <Route path="agents" element={<Agents />} />
              <Route path="email-dashboard" element={<EmailDashboard />} />
              <Route path="iems-dashboard" element={<IEMSDashboard />} />
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

export default App;
