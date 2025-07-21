import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, wsLink, splitLink, createWSClient } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import type { AppRouter } from "../api/trpc/router";
import { ChatInterface } from "./components/Chat/ChatInterface";
import { MainLayout } from "./components/Layout/MainLayout";
import { Dashboard } from "./components/Dashboard/Dashboard";
import { EmailDashboard } from "./components/Email/EmailDashboard";
import "./App.css";

// Create tRPC client
export const trpc = createTRPCReact<AppRouter>();

// Export trpc instance for use in other components
export { trpc as trpcClient };

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

// Create tRPC client
const trpcClient = trpc.createClient({
  transformer: superjson,
  links: [
    splitLink({
      condition(op) {
        return op.type === "subscription";
      },
      true: wsLink({
        client: createWSClient({
          url: `ws://localhost:3001/trpc-ws`,
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
      }),
    }),
  ],
});

function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="chat" element={<ChatInterface />} />
              <Route path="chat/:conversationId" element={<ChatInterface />} />
              <Route path="email-dashboard" element={<EmailDashboard />} />
              <Route path="architecture-expert" element={<ArchitectureExpert />} />
              <Route path="database-expert" element={<DatabaseExpert />} />
              <Route path="web-scraping" element={<WebScraping />} />
              <Route path="knowledge-base" element={<KnowledgeBase />} />
              <Route path="vector-search" element={<VectorSearch />} />
              <Route path="professional-dashboard" element={<ProfessionalDashboard />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </Router>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

// Placeholder components
function ArchitectureExpert() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Architecture Expert</h1>
      <p>Design and review system architectures</p>
    </div>
  );
}

function DatabaseExpert() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Database Expert</h1>
      <p>Database design and optimization</p>
    </div>
  );
}

function WebScraping() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Web Scraping</h1>
      <p>Extract data from websites</p>
    </div>
  );
}

function KnowledgeBase() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Knowledge Base</h1>
      <p>Manage your RAG documents and embeddings</p>
    </div>
  );
}

function VectorSearch() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Vector Search</h1>
      <p>Search through vector embeddings</p>
    </div>
  );
}

function ProfessionalDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Professional Dashboard</h1>
      <p>Advanced enterprise features</p>
    </div>
  );
}

function Settings() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <p>Configure your AI Agent Team</p>
    </div>
  );
}

export default App;
