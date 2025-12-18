import bcrypt from 'bcryptjs';
import { User, IUser } from '../database/models/User';
import { 
  setEmailCode, 
  getEmailCode, 
  deleteEmailCode,
  setRefreshToken,
  getRefreshToken,
  invalidateAllRefreshTokens 
} from '../database/redis/redisUtils';
import logger from '../utils/logger';
import HttpError from '../utils/HttpError';
import JWTService from '../utils/jwt';
import emailService from '../utils/email';

const SALT_ROUNDS = 12;
const VERIFICATION_CODE_EXPIRY = 600; // 10 minutes in seconds

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface VerifyEmailRequest {
  email: string;
  verificationCode: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    profile?: {
      position?: string;
      company?: string;
      category?: string;
      skills?: string[];
    };
  };
}

export class AuthService {
  /**
   * Generate 6-digit verification code
   */
  private static generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Validate password strength
   */
  private static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one digit');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Register new user and send verification email
   */
  static async register(request: RegisterRequest): Promise<{ success: boolean; message: string; email: string }> {
    const { email, password, firstName, lastName } = request;
    
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        logger.warn('Registration attempt with existing email', { 
          email, 
          existingUserId: existingUser._id 
        });
        throw new HttpError(409, 'User with this email already exists', 'EMAIL_ALREADY_EXISTS');
      }

      // Validate password
      const passwordValidation = this.validatePassword(password);
      if (!passwordValidation.isValid) {
        throw new HttpError(400, `Password validation failed: ${passwordValidation.errors.join(', ')}`, 'INVALID_PASSWORD');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Create user with emailVerified: false
      const user = new User({
        email: email.toLowerCase(),
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        emailVerified: false,
        status: 'offline',
        lastSeen: new Date()
      });

      await user.save();
      logger.info('User created successfully', { 
        userId: user._id, 
        email: user.email 
      });

      // Generate and store verification code
      const verificationCode = this.generateVerificationCode();
      await setEmailCode(user.email, verificationCode, VERIFICATION_CODE_EXPIRY);
      
      logger.info('Verification code stored in Redis', { 
        userId: (user._id as any), 
        email: user.email,
        expiresIn: VERIFICATION_CODE_EXPIRY
      });

      // Send verification email
      await emailService.sendVerificationEmail({
        to: user.email,
        verificationCode,
        firstName: user.firstName
      });

      logger.info('Verification email sent', { 
        userId: (user._id as any), 
        email: user.email 
      });

      return {
        success: true,
        message: 'Verification code sent to email',
        email: user.email
      };

    } catch (error: any) {
      // If it's already an HttpError, rethrow it
      if (error instanceof HttpError) {
        throw error;
      }

      // Handle database errors
      if ((error as any).name === 'MongoServerError' && (error as any).code === 11000) {
        logger.warn('Duplicate email during registration', { email });
        throw new HttpError(409, 'User with this email already exists', 'EMAIL_ALREADY_EXISTS');
      }

      logger.error('Registration failed:', { email, error });
      throw new HttpError(500, 'Registration failed', 'REGISTRATION_ERROR');
    }
  }

  /**
   * Verify email with code and generate tokens
   */
  static async verifyEmail(request: VerifyEmailRequest): Promise<AuthResponse> {
    const { email, verificationCode } = request;
    
    try {
      // Find user
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
      }

      // Check if email is already verified
      if (user.emailVerified) {
        throw new HttpError(400, 'Email is already verified', 'EMAIL_ALREADY_VERIFIED');
      }

      // Get verification code from Redis
      const storedCode = await getEmailCode(user.email);
      
      if (!storedCode) {
        throw new HttpError(400, 'Verification code has expired', 'CODE_EXPIRED');
      }

      // Verify code
      if (storedCode !== verificationCode) {
        throw new HttpError(400, 'Invalid verification code', 'INVALID_CODE');
      }

      // Update user as verified
      user.emailVerified = true;
      await user.save();

      // Remove verification code from Redis
      await deleteEmailCode(user.email);

      // Generate tokens
      const accessToken = JWTService.generateAccessToken({
        userId: (user._id as any).toString(),
        email: user.email
      });

      const refreshToken = JWTService.generateRefreshToken({
        userId: (user._id as any).toString(),
        type: 'refresh'
      });

      // Store refresh token in Redis
      await setRefreshToken((user._id as any).toString(), refreshToken, 7 * 24 * 60 * 60); // 7 days

      logger.info('Email verified and tokens generated', { 
        userId: (user._id as any), 
        email: user.email 
      });

      return {
        accessToken,
        refreshToken,
        user: {
          id: (user._id as any).toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profile: user.profile
        }
      };

    } catch (error: any) {
      if (error instanceof HttpError) {
        throw error;
      }

      logger.error('Email verification failed:', { email, error });
      throw new HttpError(500, 'Email verification failed', 'VERIFICATION_ERROR');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Verify refresh token
      const decoded = JWTService.verifyRefreshToken(refreshToken);
      
      // Check if token exists in Redis
      const storedToken = await getRefreshToken(decoded.userId);
      
      if (storedToken !== refreshToken) {
        throw new HttpError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
      }

      // Get user
      const user = await User.findById(decoded.userId);
      if (!user || !user.emailVerified) {
        throw new HttpError(401, 'User not found or email not verified', 'USER_NOT_FOUND');
      }

      // Generate new tokens
      const newAccessToken = JWTService.generateAccessToken({
        userId: (user._id as any).toString(),
        email: user.email
      });

      const newRefreshToken = JWTService.generateRefreshToken({
        userId: (user._id as any).toString(),
        type: 'refresh'
      });

      // Update refresh token in Redis
      await setRefreshToken((user._id as any).toString(), newRefreshToken, 7 * 24 * 60 * 60);

      logger.info('Tokens refreshed successfully', { userId: (user._id as any) });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };

    } catch (error: any) {
      if (error instanceof HttpError) {
        throw error;
      }

      logger.error('Token refresh failed:', { error });
      throw new HttpError(401, 'Token refresh failed', 'REFRESH_ERROR');
    }
  }

  /**
   * Logout user (invalidate refresh token)
   */
  static async logout(userId: string): Promise<void> {
    try {
      await invalidateAllRefreshTokens(userId);
      
      logger.info('User logged out successfully', { userId });
    } catch (error: any) {
      logger.error('Logout failed:', { userId, error });
      throw new HttpError(500, 'Logout failed', 'LOGOUT_ERROR');
    }
  }
}

export default AuthService;