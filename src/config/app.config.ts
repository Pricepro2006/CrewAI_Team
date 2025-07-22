import { config } from "dotenv";

config();

// Default timeout values for various operations
export const DEFAULT_TIMEOUTS = {
  LLM_GENERATION: 3 * 60 * 1000, // 3 minutes
  AGENT_EXECUTION: 3 * 60 * 1000, // 3 minutes
  TOOL_EXECUTION: 30000, // 30 seconds
  API_REQUEST: 10000, // 10 seconds
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
};

interface DatabaseConfig {
  path: string;
}

interface ApiConfig {
  port: number;
  cors: {
    origin:
      | string[]
      | string
      | boolean
      | ((
          origin: string | undefined,
          callback: (
            err: Error | null,
            origin?: boolean | string | RegExp | (boolean | string | RegExp)[],
          ) => void,
        ) => void);
    credentials: boolean;
    optionsSuccessStatus?: number;
    methods?: string[];
    allowedHeaders?: string[];
  };
}

interface OllamaConfig {
  url: string;
  model?: string;
}

interface AppConfig {
  database: DatabaseConfig;
  api: ApiConfig;
  ollama?: OllamaConfig;
}

const appConfig: AppConfig = {
  database: {
    path: process.env.DATABASE_PATH || "./data/app.db",
  },
  api: {
    port: parseInt(process.env.PORT || "3001", 10),
    cors: {
      origin: function (origin, callback) {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") ||
          process.env.CORS_ORIGIN?.split(",") || [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
          ];

        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"), false);
        }
      },
      credentials: true,
      optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
      ],
    },
  },
  ollama: process.env.OLLAMA_URL
    ? {
        url: process.env.OLLAMA_URL,
        model: process.env.OLLAMA_MODEL,
      }
    : undefined,
};

export default appConfig;
