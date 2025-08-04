/**
 * ChatInterface Component Test Suite
 * Tests chat interface functionality and interactions
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import "@testing-library/jest-dom";
import { BrowserRouter } from "react-router-dom";

// Mock the tRPC API first
vi.mock("../../../../lib/trpc", () => ({
  api: {
    chat: {
      create: {
        useMutation: vi.fn(() => ({
          mutateAsync: vi.fn().mockResolvedValue({
            conversationId: "conv-1",
            response: "Hello! How can I help you?",
          }),
        })),
      },
      message: {
        useMutation: vi.fn(() => ({
          mutateAsync: vi.fn().mockResolvedValue({
            response: "I understand your question.",
          }),
        })),
      },
      history: {
        useQuery: vi.fn(() => ({
          data: [
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi there!" },
          ],
        })),
      },
      onMessage: {
        useSubscription: vi.fn(),
      },
    },
  },
}));

// Get reference to the mocked tRPC for test manipulation
const mockTrpc = {
  chat: {
    create: {
      useMutation: vi.fn(() => ({
        mutateAsync: vi.fn().mockResolvedValue({
          conversationId: "conv-1",
          response: "Hello! How can I help you?",
        }),
      })),
    },
    message: {
      useMutation: vi.fn(() => ({
        mutateAsync: vi.fn().mockResolvedValue({
          response: "I understand your question.",
        }),
      })),
    },
    history: {
      useQuery: vi.fn(() => ({
        data: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there!" },
        ],
      })),
    },
    onMessage: {
      useSubscription: vi.fn(),
    },
  },
};

// Mock the child components
vi.mock("../MessageList", () => ({
  MessageList: ({ messages, isProcessing }: any) => (
    <div data-testid="message-list">
      {messages.map((msg: any, index: number) => (
        <div key={index} data-testid={`message-${index}`}>
          <span data-testid={`role-${index}`}>{msg.role}</span>
          <span data-testid={`content-${index}`}>{msg.content}</span>
        </div>
      ))}
      {isProcessing && <div data-testid="processing">Processing...</div>}
    </div>
  ),
}));

vi.mock("../InputBox", () => ({
  InputBox: ({ onSendMessage, disabled }: any) => (
    <div data-testid="input-box">
      <input
        data-testid="message-input"
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const target = e.target as HTMLInputElement;
            onSendMessage(target.value);
            target.value = "";
          }
        }}
        placeholder="Type a message..."
      />
      <button
        data-testid="send-button"
        disabled={disabled}
        onClick={() => {
          const input = document.querySelector('[data-testid="message-input"]') as HTMLInputElement;
          if (input?.value) {
            onSendMessage(input.value);
            input.value = "";
          }
        }}
      >
        Send
      </button>
    </div>
  ),
}));

vi.mock("../../AgentStatus/AgentMonitor", () => ({
  AgentMonitor: () => <div data-testid="agent-monitor">Agent Monitor</div>,
}));

// Mock react-router-dom functions
const mockNavigate = vi.fn();
const mockUseParams = vi.fn(() => ({ conversationId: undefined }));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => mockUseParams(),
    useNavigate: () => mockNavigate,
  };
});

// Import the component after mocks are set up
import { ChatInterface } from "../ChatInterface";

describe("ChatInterface Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  it("should render chat interface correctly", () => {
    renderWithRouter(<ChatInterface />);

    expect(screen.getByText("AI Agent Team Chat")).toBeInTheDocument();
    expect(screen.getByTestId("message-list")).toBeInTheDocument();
    expect(screen.getByTestId("input-box")).toBeInTheDocument();
  });

  it("should display conversation history when available", () => {
    renderWithRouter(<ChatInterface />);

    // Should show messages from the mocked history
    expect(screen.getByTestId("message-0")).toBeInTheDocument();
    expect(screen.getByTestId("role-0")).toHaveTextContent("user");
    expect(screen.getByTestId("content-0")).toHaveTextContent("Hello");
    
    expect(screen.getByTestId("message-1")).toBeInTheDocument();
    expect(screen.getByTestId("role-1")).toHaveTextContent("assistant");
    expect(screen.getByTestId("content-1")).toHaveTextContent("Hi there!");
  });

  it("should handle sending new message", async () => {
    const createMutation = vi.fn().mockResolvedValue({
      conversationId: "new-conv",
      response: "New conversation started!",
    });
    
    mockTrpc.chat.create.useMutation.mockReturnValue({
      mutateAsync: createMutation,
    });

    mockTrpc.chat.history.useQuery.mockReturnValue({
      data: [], // Empty history for new conversation
    });

    renderWithRouter(<ChatInterface />);

    const messageInput = screen.getByTestId("message-input");
    const sendButton = screen.getByTestId("send-button");

    // Type and send message
    fireEvent.change(messageInput, { target: { value: "Hello AI" } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(createMutation).toHaveBeenCalledWith({
        message: "Hello AI",
      });
    });
  });

  it("should handle sending message via Enter key", async () => {
    const createMutation = vi.fn().mockResolvedValue({
      conversationId: "new-conv",
      response: "Message sent via Enter!",
    });
    
    mockTrpc.chat.create.useMutation.mockReturnValue({
      mutateAsync: createMutation,
    });

    mockTrpc.chat.history.useQuery.mockReturnValue({
      data: [], // Empty history
    });

    renderWithRouter(<ChatInterface />);

    const messageInput = screen.getByTestId("message-input");

    // Type message and press Enter
    fireEvent.change(messageInput, { target: { value: "Hello via Enter" } });
    fireEvent.keyDown(messageInput, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(createMutation).toHaveBeenCalledWith({
        message: "Hello via Enter",
      });
    });
  });

  it("should show processing state", async () => {
    const slowCreateMutation = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    );
    
    mockTrpc.chat.create.useMutation.mockReturnValue({
      mutateAsync: slowCreateMutation,
    });

    mockTrpc.chat.history.useQuery.mockReturnValue({
      data: [],
    });

    renderWithRouter(<ChatInterface />);

    const messageInput = screen.getByTestId("message-input");
    const sendButton = screen.getByTestId("send-button");

    fireEvent.change(messageInput, { target: { value: "Test message" } });
    fireEvent.click(sendButton);

    // Should show processing state
    expect(screen.getByTestId("processing")).toBeInTheDocument();
    expect(screen.getByTestId("agent-monitor")).toBeInTheDocument();
    expect(messageInput).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it("should show New Chat button when conversation exists", () => {
    mockUseParams.mockReturnValue({ conversationId: "existing-conv" });

    renderWithRouter(<ChatInterface />);

    expect(screen.getByText("New Chat")).toBeInTheDocument();
  });

  it("should handle New Chat button click", () => {
    mockUseParams.mockReturnValue({ conversationId: "existing-conv" });

    renderWithRouter(<ChatInterface />);

    const newChatButton = screen.getByText("New Chat");
    fireEvent.click(newChatButton);

    expect(mockNavigate).toHaveBeenCalledWith("/chat");
  });

  it("should not show New Chat button for new conversations", () => {
    mockUseParams.mockReturnValue({ conversationId: undefined });

    renderWithRouter(<ChatInterface />);

    expect(screen.queryByText("New Chat")).not.toBeInTheDocument();
  });

  it("should handle message sending errors", async () => {
    const failingMutation = vi.fn().mockRejectedValue(new Error("Network error"));
    
    mockTrpc.chat.create.useMutation.mockReturnValue({
      mutateAsync: failingMutation,
    });

    mockTrpc.chat.history.useQuery.mockReturnValue({
      data: [],
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderWithRouter(<ChatInterface />);

    const messageInput = screen.getByTestId("message-input");
    fireEvent.change(messageInput, { target: { value: "Test message" } });
    fireEvent.keyDown(messageInput, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(failingMutation).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith("Error sending message:", expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it("should prevent sending empty messages", async () => {
    const createMutation = vi.fn();
    
    mockTrpc.chat.create.useMutation.mockReturnValue({
      mutateAsync: createMutation,
    });

    renderWithRouter(<ChatInterface />);

    const sendButton = screen.getByTestId("send-button");

    // Try to send empty message
    fireEvent.click(sendButton);

    // Should not call the mutation
    expect(createMutation).not.toHaveBeenCalled();
  });

  it("should prevent sending messages while processing", async () => {
    let resolvePromise: (value: any) => void;
    const slowMutation = vi.fn().mockImplementation(
      () => new Promise(resolve => { resolvePromise = resolve; })
    );
    
    mockTrpc.chat.create.useMutation.mockReturnValue({
      mutateAsync: slowMutation,
    });

    mockTrpc.chat.history.useQuery.mockReturnValue({
      data: [],
    });

    renderWithRouter(<ChatInterface />);

    const messageInput = screen.getByTestId("message-input");
    const sendButton = screen.getByTestId("send-button");

    // Send first message
    fireEvent.change(messageInput, { target: { value: "First message" } });
    fireEvent.click(sendButton);

    // Try to send second message while first is processing
    fireEvent.change(messageInput, { target: { value: "Second message" } });
    fireEvent.click(sendButton);

    // Should only call mutation once
    expect(slowMutation).toHaveBeenCalledTimes(1);
  });
});