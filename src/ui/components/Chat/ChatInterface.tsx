import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../../lib/trpc";
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

  const createConversation = api.chat?.create?.useMutation?.() || { 
    mutateAsync: async () => Promise.resolve(null) 
  };
  const sendMessage = api.chat?.message?.useMutation?.() || { 
    mutateAsync: async () => Promise.resolve(null) 
  };
  const conversationHistory = api.chat?.history?.useQuery?.(
    { conversationId: conversationId! },
    { enabled: !!conversationId },
  ) || { data: [] };

  // Load conversation history
  useEffect(() => {
    if (conversationHistory.data) {
      setMessages(conversationHistory.data);
    }
  }, [conversationHistory.data]);

  // Subscribe to real-time updates (hook must be at top level)
  const subscription = api.chat?.onMessage?.useSubscription?.(
    { conversationId: conversationId! },
    {
      enabled: !!conversationId,
      onData: (data: unknown) => {
        const message = data as Message;
        setMessages((prev: Message[]) => [...prev, message]);
      },
      onError: (error) => {
        console.warn('WebSocket subscription failed:', error);
      },
    }
  );

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    setIsProcessing(true);

    try {
      if (!conversationId) {
        // Create new conversation
        const userMessage: Message = { role: "user", content: text };
        setMessages([userMessage]);

        const result = await createConversation?.mutateAsync({
          message: text,
        });

        if (!result) {
          throw new Error('Failed to create conversation');
        }

        const typedResult = result as { conversationId: string; response: string };

        setConversationId(typedResult.conversationId);
        navigate(`/chat/${typedResult.conversationId}`);

        setMessages((prev: Message[]) => [
          ...prev,
          {
            role: "assistant",
            content: typedResult.response,
          },
        ]);
      } else {
        // Continue conversation
        const userMessage: Message = { role: "user", content: text };
        setMessages((prev: Message[]) => [...prev, userMessage]);

        const result = await sendMessage?.mutateAsync({
          conversationId,
          message: text,
        });

        if (!result) {
          throw new Error('Failed to send message');
        }

        setMessages((prev: Message[]) => [
          ...prev,
          {
            role: "assistant",
            content: result.response,
          },
        ]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev: Message[]) => [
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
