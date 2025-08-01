export type Message = {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
};
