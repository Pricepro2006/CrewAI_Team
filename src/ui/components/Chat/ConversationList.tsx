import React from "react";
import { api } from "../../../lib/trpc.js";

interface ConversationListProps {
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  currentId,
  onSelect,
  onNew,
}) => {
  const { data: conversations, isLoading } = (api.chat as any).list.useQuery({
    limit: 50,
    offset: 0,
  });

  return (
    <div className="h-full flex flex-col">
      {/* New Conversation Button */}
      <div className="p-4">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span>New Chat</span>
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">Loading...</div>
        ) : conversations && conversations.length > 0 ? (
          <div className="space-y-1 p-2">
            {conversations.map((conv: any) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === currentId}
                onSelect={() => onSelect(conv.id)}
              />
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-gray-500">
            No conversations yet
          </div>
        )}
      </div>
    </div>
  );
};

interface ConversationItemProps {
  conversation: {
    id: string;
    title?: string;
    createdAt: string;
    updatedAt: string;
  };
  isActive: boolean;
  onSelect: () => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onSelect,
}) => {
  const title = conversation.title || "New Conversation";
  const date = new Date(conversation.updatedAt);
  const dateStr = formatRelativeDate(date);

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
        isActive
          ? "bg-blue-100 text-blue-900"
          : "hover:bg-gray-100 text-gray-700"
      }`}
    >
      <div className="font-medium text-sm truncate">{title}</div>
      <div className="text-xs text-gray-500 mt-1">{dateStr}</div>
    </button>
  );
};

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString();
}
