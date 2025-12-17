import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRouter from './routes/health';
import mediaRouter from './routes/media';
import { connectDB, createIndexes } from './database';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/health', healthRouter);
app.use('/api/media', mediaRouter);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Lettera Server API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response) => {
  console.error('Error:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Initialize database connection and start server
const startServer = async () => {
  try {
    // Подключаемся к базе данных
    await connectDB();
    
    // Создаем индексы
    await createIndexes();
    
    // Запускаем HTTP сервер
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📖 API documentation available at http://localhost:${PORT}`);
      console.log(`🏥 Health check available at http://localhost:${PORT}/api/health`);
      console.log(`🗄️  Database health check: http://localhost:${PORT}/api/health/db`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Graceful shutdown starting...`);
      
      server.close(() => {
        console.log('🔌 HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;
