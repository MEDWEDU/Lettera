import { Router } from 'express';
import { Request, Response } from 'express';

const router = Router();

/**
 * @route GET /api/health
 * @desc Health check endpoint
 * @access Public
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: 'Lettera Server is healthy!',
    environment: process.env.NODE_ENV || 'development',
  });
});

export default router;
