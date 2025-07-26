export interface Conversation {
    id: string;
    title?: string;
    messages: Message[];
    createdAt: string;
    updatedAt: string;
}
export interface Message {
    id?: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp?: string;
    metadata?: Record<string, any>;
}
export declare class ConversationService {
    private db;
    constructor();
    private initializeDatabase;
    create(): Promise<Conversation>;
    get(id: string): Promise<Conversation | null>;
    list(limit?: number, offset?: number): Promise<Conversation[]>;
    addMessage(conversationId: string, message: Message): Promise<void>;
    updateTitle(conversationId: string, title: string): Promise<void>;
    delete(conversationId: string): Promise<void>;
    clearAll(): Promise<void>;
    search(query: string, limit?: number): Promise<Conversation[]>;
    getRecentConversations(days?: number, limit?: number): Promise<Conversation[]>;
    getConversationStats(): Promise<{
        totalConversations: number;
        totalMessages: number;
        averageMessagesPerConversation: number;
        recentActivity: {
            date: string;
            count: number;
        }[];
    }>;
    exportConversation(conversationId: string, format?: "json" | "markdown"): Promise<string>;
    exportAllConversations(format?: "json" | "csv"): Promise<string>;
}
//# sourceMappingURL=ConversationService.d.ts.map