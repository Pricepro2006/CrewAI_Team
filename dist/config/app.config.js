import { config } from 'dotenv';
config();
const appConfig = {
    database: {
        path: process.env.DATABASE_PATH || './data/app.db',
    },
    api: {
        port: parseInt(process.env.PORT || '3001', 10),
        cors: {
            origin: function (origin, callback) {
                const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || process.env.CORS_ORIGIN?.split(',') || [
                    'http://localhost:3000',
                    'http://localhost:5173',
                    'http://localhost:5174',
                    'http://localhost:5175'
                ];
                // Allow requests with no origin (like mobile apps or curl requests)
                if (!origin)
                    return callback(null, true);
                if (allowedOrigins.indexOf(origin) !== -1) {
                    callback(null, true);
                }
                else {
                    callback(new Error('Not allowed by CORS'), false);
                }
            },
            credentials: true,
            optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
        },
    },
    ollama: process.env.OLLAMA_URL ? {
        url: process.env.OLLAMA_URL,
        model: process.env.OLLAMA_MODEL,
    } : undefined,
};
export default appConfig;
//# sourceMappingURL=app.config.js.map