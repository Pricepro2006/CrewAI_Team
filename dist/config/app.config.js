import { config } from 'dotenv';
config();
const appConfig = {
    database: {
        path: process.env.DATABASE_PATH || './data/app.db',
    },
    api: {
        port: parseInt(process.env.PORT || '3001', 10),
        cors: {
            origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
            credentials: true,
        },
    },
    ollama: process.env.OLLAMA_URL ? {
        url: process.env.OLLAMA_URL,
        model: process.env.OLLAMA_MODEL,
    } : undefined,
};
export default appConfig;
//# sourceMappingURL=app.config.js.map