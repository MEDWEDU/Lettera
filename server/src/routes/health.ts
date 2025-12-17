import { Router } from 'express';
import { Request, Response } from 'express';
import { getConnectionState } from '../database';

const router = Router();

/**
 * @route GET /api/health
 * @desc Health check endpoint
 * @access Public
 */
router.get('/', (req: Request, res: Response) => {
  const dbState = getConnectionState();
  
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: 'Lettera Server is healthy!',
    environment: process.env.NODE_ENV || 'development',
    database: {
      connected: dbState.readyState === 1,
      host: dbState.host,
      port: dbState.port,
      name: dbState.name,
      readyState: dbState.readyState
    }
  });
});

/**
 * @route GET /api/health/db
 * @desc Database health check endpoint
 * @access Public
 */
router.get('/db', (req: Request, res: Response) => {
  const dbState = getConnectionState();
  
  const isConnected = dbState.readyState === 1;
  const stateMap = {
    0: 'disconnected',
    1: 'connected', 
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.status(isConnected ? 200 : 503).json({
    database: {
      connected: isConnected,
      readyState: dbState.readyState,
      readyStateText: stateMap[dbState.readyState as keyof typeof stateMap] || 'unknown',
      host: dbState.host,
      port: dbState.port,
      name: dbState.name,
      timestamp: new Date().toISOString()
    }
  });
});

export default router;
