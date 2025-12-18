import { Router, Request, Response } from 'express';
import AuthService from '../services/AuthService';
import { asyncHandler, HttpError } from '../utils';
import { 
  registerSchema, 
  verifyEmailSchema, 
  refreshTokenSchema 
} from '../utils/validation';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user and send verification email
 * @access Public
 */
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const { error, value } = registerSchema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true 
  });
  
  if (error) {
    const errorMessage = error.details.map(detail => detail.message).join(', ');
    logger.warn('Registration validation failed:', { 
      errors: error.details, 
      requestId: req.requestId 
    });
    throw new HttpError(400, `Validation failed: ${errorMessage}`, 'VALIDATION_ERROR');
  }

  const result = await AuthService.register(value);
  
  res.status(201).json({
    success: result.success,
    message: result.message,
    email: result.email
  });
}));

/**
 * @route POST /api/auth/verify-email
 * @desc Verify email with 6-digit code and return JWT tokens
 * @access Public
 */
router.post('/verify-email', asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const { error, value } = verifyEmailSchema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true 
  });
  
  if (error) {
    const errorMessage = error.details.map(detail => detail.message).join(', ');
    logger.warn('Email verification validation failed:', { 
      errors: error.details, 
      requestId: req.requestId 
    });
    throw new HttpError(400, `Validation failed: ${errorMessage}`, 'VALIDATION_ERROR');
  }

  const authResponse = await AuthService.verifyEmail(value);
  
  res.status(200).json(authResponse);
}));

/**
 * @route POST /api/auth/refresh-token
 * @desc Refresh access token using refresh token
 * @access Public
 */
router.post('/refresh-token', asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const { error, value } = refreshTokenSchema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true 
  });
  
  if (error) {
    const errorMessage = error.details.map(detail => detail.message).join(', ');
    logger.warn('Token refresh validation failed:', { 
      errors: error.details, 
      requestId: req.requestId 
    });
    throw new HttpError(400, `Validation failed: ${errorMessage}`, 'VALIDATION_ERROR');
  }

  const tokens = await AuthService.refreshToken(value.refreshToken);
  
  res.status(200).json(tokens);
}));

/**
 * @route POST /api/auth/logout
 * @desc Logout user by invalidating refresh token
 * @access Private (requires authentication middleware)
 */
router.post('/logout', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new HttpError(401, 'Authentication required', 'AUTHENTICATION_REQUIRED');
  }

  await AuthService.logout(req.user.id);
  
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
}));

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 * @access Private (requires authentication middleware)
 */
router.get('/me', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new HttpError(401, 'Authentication required', 'AUTHENTICATION_REQUIRED');
  }

  res.status(200).json({
    user: req.user
  });
}));

/**
 * @route POST /api/auth/resend-verification
 * @desc Resend verification email
 * @access Public
 */
router.post('/resend-verification', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  
  if (!email) {
    throw new HttpError(400, 'Email is required', 'EMAIL_REQUIRED');
  }

  // Check if user exists and is not verified
  const user = await (await import('../database/models/User')).User.findOne({ 
    email: email.toLowerCase() 
  });
  
  if (!user) {
    throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
  }

  if (user.emailVerified) {
    throw new HttpError(400, 'Email is already verified', 'EMAIL_ALREADY_VERIFIED');
  }

  // Generate new verification code
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Store code in Redis with 10 minute expiry
  const { setEmailCode } = await import('../database/redis/redisUtils');
  await setEmailCode(user.email, verificationCode, 600);
  
  // Send verification email
  const emailService = (await import('../utils/email')).default;
  await emailService.sendVerificationEmail({
    to: user.email,
    verificationCode,
    firstName: user.firstName
  });

  logger.info('Verification email resent', { 
    userId: user._id, 
    email: user.email,
    requestId: req.requestId 
  });

  res.status(200).json({
    success: true,
    message: 'Verification code sent to email'
  });
}));

export default router;