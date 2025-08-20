import React from "react";
import type { Message } from "./types.js";
import "./MessageList.css";

interface MessageListProps {
  messages: Message[];
  isProcessing: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isProcessing,
}) => {
  const formatContent = (content: string) => {
    // Handle undefined or null content
    if (!content) {
      return <p className="text-gray-500">No content</p>;
    }

    // Simple markdown-like formatting
    return content.split("\n").map((line, i) => {
      // Code blocks
      if (line.startsWith("```")) {
        return (
          <pre key={i} className="code-block">
            {line.substring(3)}
          </pre>
        );
      }

      // Headers
      if (line.startsWith("# ")) {
        return <h3 key={i}>{line.substring(2)}</h3>;
      }
      if (line.startsWith("## ")) {
        return <h4 key={i}>{line.substring(3)}</h4>;
      }

      // Bold text
      if (line.includes("**")) {
        const parts = line.split("**");
        return (
          <p key={i}>
            {parts?.map((part, j) =>
              j % 2 === 1 ? <strong key={j}>{part}</strong> : part,
            )}
          </p>
        );
      }

      // Lists
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return <li key={i}>{line.substring(2)}</li>;
      }
      if (/^\d+\.\s/.test(line)) {
        return <li key={i}>{line.substring(line.indexOf(".") + 2)}</li>;
      }

      // Regular paragraph
      return line.trim() ? <p key={i}>{line}</p> : <br key={i} />;
    });
  };

  return (
    <div className="message-list">
      {messages?.map((message, index) => (
        <div key={index} className={`message message-${message.role}`}>
          <div className="message-role">
            {message.role === "user"
              ? "👤"
              : message.role === "assistant"
                ? "🤖"
                : "ℹ️"}
            <span>{message.role}</span>
          </div>
          <div className="message-content">
            {formatContent(message.content)}
          </div>
          {message.timestamp && (
            <div className="message-timestamp">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>
      ))}

      {isProcessing && (
        <div className="message message-assistant">
          <div className="message-role">
            🤖 <span>assistant</span>
          </div>
          <div className="message-content">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
