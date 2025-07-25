import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/trpc";
import { MessageList } from "./MessageList";
import { InputBox } from "./InputBox";
import { AgentMonitor } from "../AgentStatus/AgentMonitor";
import type { Message } from "./types";
import "./ChatInterface.css";

export const ChatInterface: React.FC = () => {
  const { conversationId: urlConversationId } = useParams();
  const navigate = useNavigate();
  const [conversationId, setConversationId] = useState<string | null>(
    urlConversationId || null,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const createConversation = (api.chat as any).create.useMutation();
  const sendMessage = (api.chat as any).message.useMutation();
  const conversationHistory = (api.chat as any).history.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId },
  );

  // Load conversation history
  useEffect(() => {
    if (conversationHistory.data) {
      setMessages(conversationHistory.data);
    }
  }, [conversationHistory.data]);

  // Subscribe to real-time updates
  (api.chat as any).onMessage.useSubscription(
    { conversationId: conversationId! },
    {
      enabled: !!conversationId,
      onData: (data: unknown) => {
        const message = data as Message;
        setMessages((prev) => [...prev, message]);
      },
    },
  );

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    setIsProcessing(true);

    try {
      if (!conversationId) {
        // Create new conversation
        const userMessage: Message = { role: "user", content: text };
        setMessages([userMessage]);

        const result = await createConversation.mutateAsync({
          message: text,
        });

        setConversationId(result.conversationId);
        navigate(`/chat/${result.conversationId}`);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.response,
          },
        ]);
      } else {
        // Continue conversation
        const userMessage: Message = { role: "user", content: text };
        setMessages((prev) => [...prev, userMessage]);

        const result = await sendMessage.mutateAsync({
          conversationId,
          message: text,
        });

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.response,
          },
        ]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: "Error: Failed to send message. Please try again.",
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <h2>AI Agent Team Chat</h2>
        {conversationId && (
          <button
            className="new-chat-btn"
            onClick={() => {
              setConversationId(null);
              setMessages([]);
              navigate("/chat");
            }}
          >
            New Chat
          </button>
        )}
      </div>

      <div className="chat-container">
        <MessageList messages={messages} isProcessing={isProcessing} />
        <div ref={messageEndRef} />
      </div>

      <InputBox onSendMessage={handleSendMessage} disabled={isProcessing} />

      {isProcessing && <AgentMonitor />}
    </div>
  );
};
