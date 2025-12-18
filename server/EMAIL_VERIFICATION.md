# Email Verification API Documentation

## Overview

This document describes the email verification system implemented for user registration in the Lettera backend.

## Features

- ✅ User registration with email verification
- ✅ 6-digit verification codes sent via email
- ✅ JWT token generation (access + refresh)
- ✅ Redis storage for verification codes and refresh tokens
- ✅ Comprehensive error handling and validation
- ✅ Password strength validation
- ✅ Email format validation

## API Endpoints

### 1. POST /api/auth/register

Register a new user and send verification email.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Validation Rules:**
- `email`: RFC-compliant email format, max 255 characters
- `password`: Minimum 8 characters, must contain:
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one digit
  - At least one special character
- `firstName`: Required, 1-50 characters
- `lastName`: Required, 1-50 characters

**Success Response (201):**
```json
{
  "success": true,
  "message": "Verification code sent to email",
  "email": "user@example.com"
}
```

**Error Responses:**
- `409 Conflict`: Email already exists
- `400 Bad Request`: Validation errors
- `500 Internal Server Error`: Server error

### 2. POST /api/auth/verify-email

Verify email with 6-digit code and receive JWT tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "verificationCode": "123456"
}
```

**Success Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "profile": {
      "position": "Developer",
      "company": "Tech Corp",
      "category": "IT",
      "skills": ["JavaScript", "Node.js"]
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid or expired code
- `404 Not Found`: User not found
- `400 Bad Request`: Email already verified
- `500 Internal Server Error`: Server error

### 3. POST /api/auth/refresh-token

Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or expired refresh token

### 4. POST /api/auth/logout

Logout user and invalidate refresh token.

**Headers:** `Authorization: Bearer <access_token>`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid access token

### 5. GET /api/auth/me

Get current user profile.

**Headers:** `Authorization: Bearer <access_token>`

**Success Response (200):**
```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "profile": {
      "position": "Developer",
      "company": "Tech Corp",
      "category": "IT",
      "skills": ["JavaScript", "Node.js"]
    }
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid access token

### 6. POST /api/auth/resend-verification

Resend verification email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Verification code sent to email"
}
```

**Error Responses:**
- `404 Not Found`: User not found
- `400 Bad Request`: Email already verified

## Security Features

### Password Validation
- Minimum 8 characters
- Must contain uppercase, lowercase, digit, and special character
- Prevents common weak passwords

### JWT Tokens
- **Access Token**: 15 minutes expiration
- **Refresh Token**: 7 days expiration
- Tokens include user ID and email
- Refresh tokens stored in Redis with validation

### Verification Codes
- 6-digit numeric codes
- 10-minute expiration
- Stored in Redis with automatic cleanup
- Single-use codes

### Error Handling
- Comprehensive logging with request IDs
- Structured error responses with error codes
- No sensitive information leaked in errors
- Proper HTTP status codes

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Email Service Configuration
FROM_EMAIL=noreply@lettera.app

# SMTP Configuration (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Redis Configuration (already exists)
REDIS_URL=redis://localhost:6379
```

### Email Service Setup

#### Gmail SMTP
1. Enable 2-factor authentication on your Google account
2. Generate an app password for the application
3. Use the app password in `SMTP_PASS`

#### Other Email Providers
Configure the SMTP settings according to your provider's documentation:
- SendGrid
- Mailgun
- Amazon SES
- Custom SMTP server

### Redis Configuration

The system uses Redis for:
- Verification code storage (10-minute TTL)
- Refresh token storage (7-day TTL)
- User status tracking (5-minute TTL)

Ensure Redis is running and accessible via `REDIS_URL`.

## Database Schema

The User model includes:
- `email`: User's email (unique, indexed)
- `passwordHash`: Bcrypt-hashed password
- `firstName`, `lastName`: User's name
- `profile`: Optional profile information
- `emailVerified`: Email verification status
- `status`: User status (online/offline/away)
- `lastSeen`: Last activity timestamp

## Logging

All operations are logged with:
- Request ID for tracing
- User ID (when available)
- Operation details
- Error information
- Performance metrics

Logs are stored in `server/logs/` with daily rotation.

## Error Codes

| Code | Description |
|------|-------------|
| `EMAIL_ALREADY_EXISTS` | User with email already registered |
| `INVALID_PASSWORD` | Password doesn't meet requirements |
| `VALIDATION_ERROR` | Request validation failed |
| `CODE_EXPIRED` | Verification code has expired |
| `INVALID_CODE` | Verification code is incorrect |
| `EMAIL_ALREADY_VERIFIED` | Email is already verified |
| `USER_NOT_FOUND` | User doesn't exist |
| `INVALID_REFRESH_TOKEN` | Refresh token is invalid/expired |
| `ACCESS_TOKEN_REQUIRED` | Access token missing |
| `AUTHENTICATION_REQUIRED` | Authentication required |

## Testing

Run the test suite:
```bash
npm test
```

The tests cover:
- User registration validation
- Email verification flow
- Token refresh functionality
- Error handling
- Security validations

## Production Considerations

1. **Environment Variables**
   - Use strong, unique JWT secrets
   - Configure proper email service credentials
   - Use environment-specific Redis instances

2. **Security**
   - Enable HTTPS in production
   - Implement rate limiting
   - Monitor for suspicious registration patterns
   - Regular security audits

3. **Monitoring**
   - Set up alerts for failed registrations
   - Monitor email delivery rates
   - Track token usage patterns
   - Log performance metrics

4. **Scaling**
   - Use Redis Cluster for high availability
   - Implement database connection pooling
   - Consider message queues for email sending
   - Load balance across multiple instances

## Integration Guide

### Frontend Integration

1. **Registration Flow**
   - Collect user data
   - Call `/api/auth/register`
   - Show message about checking email
   - Redirect to verification page

2. **Verification Flow**
   - Collect email and verification code
   - Call `/api/auth/verify-email`
   - Store tokens securely
   - Redirect to dashboard

3. **Token Management**
   - Store access token in memory
   - Store refresh token in httpOnly cookie
   - Implement automatic token refresh
   - Handle token expiration gracefully

### API Client Example

```javascript
// Registration
const register = async (userData) => {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  return response.json();
};

// Email verification
const verifyEmail = async (email, code) => {
  const response = await fetch('/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, verificationCode: code })
  });
  return response.json();
};
```

## Troubleshooting

### Common Issues

1. **Email not received**
   - Check spam folder
   - Verify SMTP configuration
   - Check email service quotas
   - Ensure correct FROM_EMAIL domain

2. **Verification code expired**
   - Use `/api/auth/resend-verification` to get new code
   - Check Redis is running and accessible

3. **Token refresh failures**
   - Verify refresh token is stored correctly
   - Check Redis connectivity
   - Ensure JWT_SECRET is consistent

4. **Registration fails**
   - Check database connectivity
   - Verify MongoDB connection
   - Check for duplicate email errors

### Debugging

Enable debug logging:
```bash
DEBUG=lettera:* npm run dev
```

Check Redis keys:
```bash
redis-cli keys "*verification_code*"
redis-cli keys "*refresh_token*"
```

## Support

For issues and questions:
1. Check the logs in `server/logs/`
2. Verify environment configuration
3. Test with the health check endpoints
4. Review this documentation

---

This email verification system provides a secure, scalable foundation for user authentication in the Lettera application.