import nodemailer from 'nodemailer';
import logger from './logger';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface VerificationEmailData {
  to: string;
  verificationCode: string;
  firstName: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;
  private fromEmail: string;

  constructor() {
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@lettera.app';
    
    // Get email configuration from environment variables
    const emailConfig: EmailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    };

    this.transporter = nodemailer.createTransport(emailConfig);
  }

  /**
   * Send verification email with 6-digit code
   */
  async sendVerificationEmail(data: VerificationEmailData): Promise<void> {
    const { to, verificationCode, firstName } = data;
    
    try {
      const mailOptions = {
        from: this.fromEmail,
        to,
        subject: 'Email Verification - Lettera',
        html: this.getVerificationEmailTemplate(firstName, verificationCode)
      };

      await this.transporter.sendMail(mailOptions);
      logger.info('Verification email sent successfully', { to, requestId: 'email_service' });
    } catch (error) {
      logger.error('Failed to send verification email:', { 
        to, 
        error, 
        requestId: 'email_service' 
      });
      throw new Error('Failed to send verification email');
    }
  }

  /**
   * HTML template for verification email
   */
  private getVerificationEmailTemplate(firstName: string, verificationCode: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Email Verification</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 40px 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            color: #333;
            text-decoration: none;
          }
          .content {
            text-align: center;
          }
          .greeting {
            font-size: 18px;
            color: #333;
            margin-bottom: 20px;
          }
          .code-container {
            background-color: #f8f9fa;
            border: 2px dashed #e9ecef;
            border-radius: 8px;
            padding: 30px;
            margin: 30px 0;
          }
          .verification-code {
            font-size: 32px;
            font-weight: bold;
            color: #007bff;
            letter-spacing: 8px;
            margin: 0;
          }
          .instruction {
            color: #6c757d;
            font-size: 14px;
            margin-top: 15px;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            color: #6c757d;
            font-size: 12px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <a href="#" class="logo">Lettera</a>
          </div>
          
          <div class="content">
            <div class="greeting">
              Hello, ${firstName}!
            </div>
            
            <p>Thank you for registering with Lettera. To complete your registration, please verify your email address by entering the following verification code:</p>
            
            <div class="code-container">
              <div class="verification-code">${verificationCode}</div>
              <div class="instruction">
                This code will expire in 10 minutes
              </div>
            </div>
            
            <p>If you didn't create an account with Lettera, you can safely ignore this email.</p>
          </div>
          
          <div class="footer">
            <p>© 2024 Lettera. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('Email service connection successful', { requestId: 'email_service' });
      return true;
    } catch (error) {
      logger.error('Email service connection failed:', { error, requestId: 'email_service' });
      return false;
    }
  }
}

export default new EmailService();