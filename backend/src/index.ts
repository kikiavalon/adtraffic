import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
import chatRouter from './routes/chat.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

// Middleware
app.use(cors({
  origin: [
    /^chrome-extension:\/\//,
    /^http:\/\/localhost/,
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use(healthRouter);
app.use(chatRouter);

// Only start server when run directly (not when imported for testing)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`AdTraffic.ai backend running on port ${PORT}`);
  });
}

export default app;
