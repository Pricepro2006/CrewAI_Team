import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, wsLink, splitLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import type { AppRouter } from '../api/trpc/router';
import { ChatInterface } from './components/Chat/ChatInterface';
import { MainLayout } from './components/Layout/MainLayout';
import './App.css';

// Create tRPC client
export const trpc = createTRPCReact<AppRouter>();

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
  links: [
    splitLink({
      condition(op) {
        return op.type === 'subscription';
      },
      true: wsLink({
        url: `ws://localhost:3001/trpc-ws`,
      }),
      false: httpBatchLink({
        url: 'http://localhost:3000/trpc',
        headers() {
          const token = localStorage.getItem('token');
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
              <Route index element={<ChatInterface />} />
              <Route path="chat" element={<ChatInterface />} />
              <Route path="chat/:conversationId" element={<ChatInterface />} />
              <Route path="agents" element={<AgentDashboard />} />
              <Route path="knowledge" element={<KnowledgeBase />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </Router>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

// Placeholder components
function AgentDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Agent Dashboard</h1>
      <p>Monitor and manage your AI agents</p>
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

function Settings() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <p>Configure your AI Agent Team</p>
    </div>
  );
}

export default App;
