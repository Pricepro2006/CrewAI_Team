/**
 * TeamChat Component Test Suite
 * Tests team chat functionality and real-time messaging
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock TeamChat component
interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: string;
  type: "message" | "system" | "notification";
}

interface TeamMember {
  id: string;
  username: string;
  status: "online" | "offline" | "away";
  avatar?: string;
}

interface TeamChatProps {
  messages: ChatMessage[];
  members: TeamMember[];
  currentUserId: string;
  onSendMessage?: (message: string) => void;
  onTyping?: (isTyping: boolean) => void;
  isConnected?: boolean;
  loading?: boolean;
}

const TeamChat: React.FC<TeamChatProps> = ({
  messages,
  members,
  currentUserId,
  onSendMessage,
  onTyping,
  isConnected = true,
  loading = false,
}) => {
  const [inputValue, setInputValue] = React.useState("");
  const [typingUsers, setTypingUsers] = React.useState<string[]>([]);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (inputValue.trim() && onSendMessage) {
      onSendMessage(inputValue);
      setInputValue("");
      onTyping?.(false);
    }
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    onTyping?.((value?.length || 0) > 0);
  };

  const getMessageTypeClass = (type: string) => {
    switch (type) {
      case "system": return "system-message";
      case "notification": return "notification-message";
      default: return "user-message";
    }
  };

  const getMemberStatusColor = (status: string) => {
    switch (status) {
      case "online": return "green";
      case "away": return "orange";
      case "offline": return "gray";
      default: return "gray";
    }
  };

  if (loading) {
    return (
      <div data-testid="team-chat-loading" className="loading">
        Loading chat...
      </div>
    );
  }

  return (
    <div className="team-chat" data-testid="team-chat">
      <div className="chat-header" data-testid="chat-header">
        <h3>Team Chat</h3>
        <div className="connection-status" data-testid="connection-status">
          <span className={`status-indicator ${isConnected ? "connected" : "disconnected"}`}>
            {isConnected ? "🟢" : "🔴"}
          </span>
          {isConnected ? "Connected" : "Disconnected"}
        </div>
      </div>

      <div className="chat-container">
        <div className="members-sidebar" data-testid="members-sidebar">
          <h4>Team Members ({members?.length || 0})</h4>
          <div className="members-list">
            {members?.map((member: any) => (
              <div 
                key={member.id} 
                className="member-item"
                data-testid={`member-${member.id}`}
              >
                <div className="member-avatar">
                  {member.avatar ? (
                    <img src={member.avatar} alt={member.username} />
                  ) : (
                    <div className="avatar-placeholder">
                      {member?.username?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="member-name" data-testid={`member-name-${member.id}`}>
                  {member.username}
                </span>
                <span 
                  className={`member-status ${member.status}`}
                  style={{ color: getMemberStatusColor(member.status) }}
                  data-testid={`member-status-${member.id}`}
                >
                  ●
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="messages-container" data-testid="messages-container">
          <div className="messages-list">
            {messages?.map((message: any) => (
              <div 
                key={message.id}
                className={`message ${getMessageTypeClass(message.type)} ${message.userId === currentUserId ? "own-message" : ""}`}
                data-testid={`message-${message.id}`}
              >
                {message.type === "message" && (
                  <div className="message-header">
                    <span className="username" data-testid={`message-username-${message.id}`}>
                      {message.username}
                    </span>
                    <span className="timestamp" data-testid={`message-timestamp-${message.id}`}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                )}
                <div className="message-content" data-testid={`message-content-${message.id}`}>
                  {message.message}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {(typingUsers?.length || 0) > 0 && (
            <div className="typing-indicator" data-testid="typing-indicator">
              {typingUsers.join(", ")} {(typingUsers?.length || 0) === 1 ? "is" : "are"} typing...
            </div>
          )}

          <div className="message-input-container" data-testid="message-input-container">
            <input
              type="text"
              value={inputValue}
              onChange={(e: any) => handleInputChange(e?.target?.value)}
              onKeyDown={(e: any) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type a message..."
              disabled={!isConnected}
              data-testid="message-input"
              className="message-input"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || !isConnected}
              data-testid="send-button"
              className="send-button"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

describe("TeamChat Component", () => {
  const mockMessages: ChatMessage[] = [
    {
      id: "msg-1",
      userId: "user-1",
      username: "Alice",
      message: "Hello team!",
      timestamp: "2025-01-20T10:00:00Z",
      type: "message",
    },
    {
      id: "msg-2",
      userId: "user-2",
      username: "Bob",
      message: "Hi Alice! How's the project going?",
      timestamp: "2025-01-20T10:01:00Z",
      type: "message",
    },
    {
      id: "msg-3",
      userId: "system",
      username: "System",
      message: "Charlie joined the chat",
      timestamp: "2025-01-20T10:02:00Z",
      type: "system",
    },
  ];

  const mockMembers: TeamMember[] = [
    { id: "user-1", username: "Alice", status: "online" },
    { id: "user-2", username: "Bob", status: "away" },
    { id: "user-3", username: "Charlie", status: "offline" },
  ];

  it("should render team chat correctly", () => {
    render(
      <TeamChat 
        messages={mockMessages} 
        members={mockMembers} 
        currentUserId="user-1"
      />
    );

    expect(screen.getByTestId("team-chat")).toBeInTheDocument();
    expect(screen.getByText("Team Chat")).toBeInTheDocument();
    expect(screen.getByTestId("messages-container")).toBeInTheDocument();
    expect(screen.getByTestId("members-sidebar")).toBeInTheDocument();
  });

  it("should display connection status", () => {
    render(
      <TeamChat 
        messages={mockMessages} 
        members={mockMembers} 
        currentUserId="user-1"
        isConnected={true}
      />
    );

    const status = screen.getByTestId("connection-status");
    expect(status).toHaveTextContent("Connected");
    expect(status).toHaveTextContent("🟢");
  });

  it("should display disconnected status", () => {
    render(
      <TeamChat 
        messages={mockMessages} 
        members={mockMembers} 
        currentUserId="user-1"
        isConnected={false}
      />
    );

    const status = screen.getByTestId("connection-status");
    expect(status).toHaveTextContent("Disconnected");
    expect(status).toHaveTextContent("🔴");
  });

  it("should display team members", () => {
    render(
      <TeamChat 
        messages={mockMessages} 
        members={mockMembers} 
        currentUserId="user-1"
      />
    );

    expect(screen.getByText("Team Members (3)")).toBeInTheDocument();
    
    mockMembers.forEach((member: any) => {
      expect(screen.getByTestId(`member-${member.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`member-name-${member.id}`)).toHaveTextContent(member.username);
    });
  });

  it("should display member status colors", () => {
    render(
      <TeamChat 
        messages={mockMessages} 
        members={mockMembers} 
        currentUserId="user-1"
      />
    );

    expect(screen.getByTestId("member-status-user-1")).toHaveStyle({ color: "green" });
    expect(screen.getByTestId("member-status-user-2")).toHaveStyle({ color: "orange" });
    expect(screen.getByTestId("member-status-user-3")).toHaveStyle({ color: "gray" });
  });

  it("should display messages correctly", () => {
    render(
      <TeamChat 
        messages={mockMessages} 
        members={mockMembers} 
        currentUserId="user-1"
      />
    );

    mockMessages.forEach((message: any) => {
      expect(screen.getByTestId(`message-${message.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`message-content-${message.id}`)).toHaveTextContent(message.message);
      
      if (message.type === "message") {
        expect(screen.getByTestId(`message-username-${message.id}`)).toHaveTextContent(message.username);
      }
    });
  });

  it("should handle sending messages", () => {
    const onSendMessage = vi.fn();
    render(
      <TeamChat 
        messages={mockMessages} 
        members={mockMembers} 
        currentUserId="user-1"
        onSendMessage={onSendMessage}
      />
    );

    const input = screen.getByTestId("message-input");
    const sendButton = screen.getByTestId("send-button");

    fireEvent.change(input, { target: { value: "Hello everyone!" } });
    fireEvent.click(sendButton);

    expect(onSendMessage).toHaveBeenCalledWith("Hello everyone!");
  });

  it("should handle sending messages with Enter key", () => {
    const onSendMessage = vi.fn();
    render(
      <TeamChat 
        messages={mockMessages} 
        members={mockMembers} 
        currentUserId="user-1"
        onSendMessage={onSendMessage}
      />
    );

    const input = screen.getByTestId("message-input");

    fireEvent.change(input, { target: { value: "Hello via Enter!" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(onSendMessage).toHaveBeenCalledWith("Hello via Enter!");
  });

  it("should handle typing indicator", () => {
    const onTyping = vi.fn();
    render(
      <TeamChat 
        messages={mockMessages} 
        members={mockMembers} 
        currentUserId="user-1"
        onTyping={onTyping}
      />
    );

    const input = screen.getByTestId("message-input");

    fireEvent.change(input, { target: { value: "typing..." } });

    expect(onTyping).toHaveBeenCalledWith(true);
  });

  it("should disable input when disconnected", () => {
    render(
      <TeamChat 
        messages={mockMessages} 
        members={mockMembers} 
        currentUserId="user-1"
        isConnected={false}
      />
    );

    const input = screen.getByTestId("message-input");
    const sendButton = screen.getByTestId("send-button");

    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it("should disable send button for empty messages", () => {
    render(
      <TeamChat 
        messages={mockMessages} 
        members={mockMembers} 
        currentUserId="user-1"
      />
    );

    const sendButton = screen.getByTestId("send-button");
    expect(sendButton).toBeDisabled();
  });

  it("should show loading state", () => {
    render(
      <TeamChat 
        messages={[]} 
        members={[]} 
        currentUserId="user-1"
        loading={true}
      />
    );

    expect(screen.getByTestId("team-chat-loading")).toBeInTheDocument();
    expect(screen.getByText("Loading chat...")).toBeInTheDocument();
    expect(screen.queryByTestId("team-chat")).not.toBeInTheDocument();
  });

  it("should distinguish own messages", () => {
    render(
      <TeamChat 
        messages={mockMessages} 
        members={mockMembers} 
        currentUserId="user-1"
      />
    );

    const ownMessage = screen.getByTestId("message-msg-1");
    const otherMessage = screen.getByTestId("message-msg-2");

    expect(ownMessage).toHaveClass("own-message");
    expect(otherMessage).not.toHaveClass("own-message");
  });

  it("should apply correct message type classes", () => {
    render(
      <TeamChat 
        messages={mockMessages} 
        members={mockMembers} 
        currentUserId="user-1"
      />
    );

    const userMessage = screen.getByTestId("message-msg-1");
    const systemMessage = screen.getByTestId("message-msg-3");

    expect(userMessage).toHaveClass("user-message");
    expect(systemMessage).toHaveClass("system-message");
  });

  it("should clear input after sending message", async () => {
    const onSendMessage = vi.fn();
    render(
      <TeamChat 
        messages={mockMessages} 
        members={mockMembers} 
        currentUserId="user-1"
        onSendMessage={onSendMessage}
      />
    );

    const input = screen.getByTestId("message-input") as HTMLInputElement;
    const sendButton = screen.getByTestId("send-button");

    fireEvent.change(input, { target: { value: "Test message" } });
    expect(input.value).toBe("Test message");

    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(input.value).toBe("");
    });
  });

  it("should not send empty or whitespace-only messages", () => {
    const onSendMessage = vi.fn();
    render(
      <TeamChat 
        messages={mockMessages} 
        members={mockMembers} 
        currentUserId="user-1"
        onSendMessage={onSendMessage}
      />
    );

    const input = screen.getByTestId("message-input");
    const sendButton = screen.getByTestId("send-button");

    // Try to send empty message
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(sendButton);

    // Try to send whitespace-only message
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(sendButton);

    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it("should handle Shift+Enter without sending", () => {
    const onSendMessage = vi.fn();
    render(
      <TeamChat 
        messages={mockMessages} 
        members={mockMembers} 
        currentUserId="user-1"
        onSendMessage={onSendMessage}
      />
    );

    const input = screen.getByTestId("message-input");

    fireEvent.change(input, { target: { value: "Multi-line message" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", shiftKey: true });

    expect(onSendMessage).not.toHaveBeenCalled();
  });
});