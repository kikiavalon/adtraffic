import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
import chatRouter from './routes/chat.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

// Middleware
app.use(cors({
  origin: [
    'chrome-extension://*', // Chrome extension origin
    'http://localhost:*',   // Local development
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' })); // IO uploads can be large

// Routes
app.use(healthRouter);
app.use(chatRouter);

// Start server
app.listen(PORT, () => {
  console.log(`AdTraffic.ai backend running on port ${PORT}`);
});

export default app;
