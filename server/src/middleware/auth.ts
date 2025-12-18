import { Request, Response, NextFunction } from 'express';
import JWTService from '../utils/jwt';
import { User } from '../database/models/User';
import HttpError from '../utils/HttpError';
import logger from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    profile?: any;
  };
}

/**
 * Middleware to authenticate JWT token
 */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw new HttpError(401, 'Access token is required', 'ACCESS_TOKEN_REQUIRED');
    }

    // Verify token
    const decoded = JWTService.verifyAccessToken(token);

    // Get user from database
    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) {
      throw new HttpError(401, 'User not found', 'USER_NOT_FOUND');
    }

    if (!user.emailVerified) {
      throw new HttpError(401, 'Email not verified', 'EMAIL_NOT_VERIFIED');
    }

    // Add user to request
    req.user = {
      id: (user._id as any).toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profile: user.profile
    };

    next();
  } catch (error: any) {
    if (error instanceof HttpError) {
      next(error);
      return;
    }

    logger.warn('Authentication failed:', { 
      error, 
      requestId: req.requestId,
      ip: req.ip 
    });

    if (error.name === 'JsonWebTokenError') {
      next(new HttpError(401, 'Invalid token', 'INVALID_TOKEN'));
      return;
    }

    if (error.name === 'TokenExpiredError') {
      next(new HttpError(401, 'Token expired', 'TOKEN_EXPIRED'));
      return;
    }

    next(new HttpError(401, 'Authentication failed', 'AUTHENTICATION_FAILED'));
  }
};

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    next(new HttpError(401, 'Authentication required', 'AUTHENTICATION_REQUIRED'));
    return;
  }

  // Add admin check logic here when admin role is implemented
  // For now, just proceed
  next();
};

/**
 * Middleware to optionally authenticate (doesn't fail if no token)
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    const decoded = JWTService.verifyAccessToken(token);
    const user = await User.findById(decoded.userId).select('-passwordHash');
    
    if (user && user.emailVerified) {
      req.user = {
        id: (user._id as any).toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profile: user.profile
      };
    }

    next();
  } catch (error: any) {
    // If token is invalid, just continue without user
    next();
  }
};

export default {
  authenticateToken,
  requireAdmin,
  optionalAuth
};