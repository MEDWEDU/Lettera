import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRouter from './routes/health';
import mediaRouter from './routes/media';
import authRouter from './routes/auth';
import {
  connectDB,
  createIndexes,
  initializeRedis,
  setupRedisGracefulShutdown,
} from './database';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import logger from './utils/logger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Request logging middleware
app.use(requestLogger);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/health', healthRouter);
app.use('/api/media', mediaRouter);
app.use('/api/auth', authRouter);

// Root route
app.get('/', (_req, res) => {
  res.json({
    message: 'Lettera Server API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// 404 handler (must be before error handler)
app.use('*', notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Initialize database connection and start server
const startServer = async () => {
  try {
    logger.info('🚀 Starting Lettera Server...');

    // Подключаемся к базе данных
    logger.info('=== DATABASE CONNECTION ===');
    await connectDB();

    // Создаем индексы
    await createIndexes();

    // Подключаемся к Redis (не блокирует, если Redis недоступен)
    logger.info('=== REDIS CONNECTION ===');
    await initializeRedis();
    setupRedisGracefulShutdown();

    // Запускаем HTTP сервер
    const server = app.listen(PORT, () => {
      logger.info(`✅ Server is running on port ${PORT}`);
      logger.info(`📖 API documentation available at http://localhost:${PORT}`);
      logger.info(
        `🏥 Health check available at http://localhost:${PORT}/api/health`
      );
      logger.info(
        `🗄️  Database health check: http://localhost:${PORT}/api/health/db`
      );
      logger.info(
        `📡 Redis health check: http://localhost:${PORT}/api/health/redis`
      );
      logger.info(`📎 Media uploads: http://localhost:${PORT}/api/media`);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`🛑 Received ${signal}. Graceful shutdown starting...`);

      server.close(() => {
        logger.info('🔌 HTTP server closed');
        logger.info('👋 Goodbye!');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;
