import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
import chatRouter from './routes/chat.js';
import conversationsRouter from './routes/conversations.js';
import authRouter from './routes/auth.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

// Middleware
app.use(cors({
  origin: [
    /^chrome-extension:\/\//,
    /^http:\/\/localhost/,
  ],
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use(healthRouter);
app.use(chatRouter);
app.use(conversationsRouter);
app.use(authRouter);

// Global error handler (must be after all routes)
app.use(errorHandler);

// Only start server when run directly (not when imported for testing)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    const model = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001';
    const maxTokens = process.env.CLAUDE_MAX_TOKENS ?? '1024';
    const dailyLimit = process.env.DAILY_API_LIMIT ?? '100';
    console.log(`AdTraffic.ai backend running on port ${PORT}`);
    console.log(`  Model: ${model} | Max tokens: ${maxTokens} | Daily limit: ${dailyLimit} requests`);
    console.log(`  Usage dashboard: http://localhost:${PORT}/api/usage`);
  });
}

export default app;
