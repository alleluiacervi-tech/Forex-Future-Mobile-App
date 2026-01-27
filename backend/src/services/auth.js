import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import prisma from '../db/prisma.js';
import Logger from '../utils/logger.js';

const logger = new Logger('AuthService');

class AuthService {
  // Validate email format
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate password strength
  validatePassword(password) {
    if (password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters.' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one uppercase letter.' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one lowercase letter.' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one number.' };
    }
    return { valid: true };
  }

  // Hash password
  async hashPassword(password) {
    try {
      const hash = await bcrypt.hash(password, 10);
      return hash;
    } catch (error) {
      logger.error('Password hashing failed', { error: error.message });
      throw new Error('Failed to hash password');
    }
  }

  // Compare password
  async comparePassword(password, hash) {
    try {
      const match = await bcrypt.compare(password, hash);
      return match;
    } catch (error) {
      logger.error('Password comparison failed', { error: error.message });
      throw new Error('Failed to compare password');
    }
  }

  // Issue JWT token
  issueToken(userId) {
    try {
      const token = jwt.sign(
        { sub: userId },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );
      logger.info('Token issued', { userId });
      return token;
    } catch (error) {
      logger.error('Token issuance failed', { userId, error: error.message });
      throw new Error('Failed to issue token');
    }
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      return payload;
    } catch (error) {
      logger.warn('Token verification failed', { error: error.message });
      throw new Error('Invalid token');
    }
  }

  // Register user
  async registerUser(name, email, password) {
    logger.info('User registration attempt', { email, name });

    // Validate inputs
    if (!name || name.trim().length < 2) {
      logger.warn('Registration validation failed - invalid name', { name });
      throw new Error('Name must be at least 2 characters.');
    }

    if (!this.validateEmail(email)) {
      logger.warn('Registration validation failed - invalid email', { email });
      throw new Error('Invalid email format.');
    }

    const passwordValidation = this.validatePassword(password);
    if (!passwordValidation.valid) {
      logger.warn('Registration validation failed - weak password', { email });
      throw new Error(passwordValidation.error);
    }

    // Check if user already exists
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } }
    });

    if (existingUser) {
      logger.warn('Registration failed - email already registered', { email });
      throw new Error('Email already registered.');
    }

    try {
      // Hash password
      const passwordHash = await this.hashPassword(password);

      // Create user
      const user = await prisma.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          account: {
            create: {
              balance: 100000,
              equity: 100000,
              marginUsed: 0,
              currency: 'USD'
            }
          },
          watchlist: {
            create: {
              pairs: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD']
            }
          }
        },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
          baseCurrency: true,
          riskLevel: true,
          notifications: true,
          trialActive: true,
          trialStartedAt: true,
          account: true,
          watchlist: true
        }
      });

      logger.info('User registered successfully', { userId: user.id, email });
      return user;
    } catch (error) {
      logger.error('User registration failed', { email, error: error.message });
      throw error;
    }
  }

  // Authenticate user (login)
  async authenticateUser(email, password) {
    logger.info('User authentication attempt', { email });

    if (!email || !password) {
      logger.warn('Authentication failed - missing credentials', { email });
      throw new Error('Email and password are required.');
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
      // Find user
      const user = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        select: {
          id: true,
          name: true,
          email: true,
          passwordHash: true,
          createdAt: true,
          updatedAt: true,
          baseCurrency: true,
          riskLevel: true,
          notifications: true,
          trialActive: true,
          trialStartedAt: true,
          account: true,
          watchlist: true
        }
      });

      if (!user || !user.passwordHash) {
        logger.warn('Authentication failed - user not found', { email });
        throw new Error('Invalid email or password.');
      }

      // Verify password
      const passwordMatch = await this.comparePassword(password, user.passwordHash);
      if (!passwordMatch) {
        logger.warn('Authentication failed - incorrect password', { email });
        throw new Error('Invalid email or password.');
      }

      // Check trial status
      if (email.toLowerCase() !== 'demo@forex.app' && !user.trialActive) {
        logger.warn('Authentication failed - trial not activated', { userId: user.id, email });
        throw new Error('Free trial must be activated before login.');
      }

      // Remove passwordHash from response
      const { passwordHash: _passwordHash, ...safeUser } = user;

      // Issue token
      const token = this.issueToken(user.id);

      logger.info('User authenticated successfully', { userId: user.id, email });
      return { user: safeUser, token };
    } catch (error) {
      logger.error('User authentication error', { email, error: error.message });
      throw error;
    }
  }

  // Start free trial
  async startTrial(email, password) {
    logger.info('Trial start attempt', { email });

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const user = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        select: {
          id: true,
          name: true,
          email: true,
          passwordHash: true,
          trialActive: true,
          createdAt: true,
          updatedAt: true,
          baseCurrency: true,
          riskLevel: true,
          notifications: true,
          trialStartedAt: true,
          account: true,
          watchlist: true
        }
      });

      if (!user || !user.passwordHash) {
        logger.warn('Trial start failed - user not found', { email });
        throw new Error('Invalid email or password.');
      }

      // Verify password
      const passwordMatch = await this.comparePassword(password, user.passwordHash);
      if (!passwordMatch) {
        logger.warn('Trial start failed - incorrect password', { email });
        throw new Error('Invalid email or password.');
      }

      // Check if trial already active
      if (user.trialActive) {
        logger.warn('Trial already active', { userId: user.id, email });
        throw new Error('Trial already active.');
      }

      // Activate trial
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          trialActive: true,
          trialStartedAt: new Date()
        },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
          baseCurrency: true,
          riskLevel: true,
          notifications: true,
          trialActive: true,
          trialStartedAt: true,
          account: true,
          watchlist: true
        }
      });

      // Issue token
      const token = this.issueToken(updatedUser.id);

      logger.info('Trial activated successfully', { userId: updatedUser.id, email });
      return { user: updatedUser, token };
    } catch (error) {
      logger.error('Trial activation error', { email, error: error.message });
      throw error;
    }
  }

  // Get user by ID
  async getUserById(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
          baseCurrency: true,
          riskLevel: true,
          notifications: true,
          trialActive: true,
          trialStartedAt: true,
          account: true,
          watchlist: true
        }
      });

      if (!user) {
        logger.warn('User not found', { userId });
        throw new Error('User not found.');
      }

      return user;
    } catch (error) {
      logger.error('Failed to fetch user', { userId, error: error.message });
      throw error;
    }
  }

  // Update user password
  async updatePassword(userId, currentPassword, newPassword) {
    logger.info('Password update attempt', { userId });

    const passwordValidation = this.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      logger.warn('Password update failed - weak password', { userId });
      throw new Error(passwordValidation.error);
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, passwordHash: true }
      });

      if (!user) {
        logger.warn('Password update failed - user not found', { userId });
        throw new Error('User not found.');
      }

      // Verify current password
      const passwordMatch = await this.comparePassword(currentPassword, user.passwordHash);
      if (!passwordMatch) {
        logger.warn('Password update failed - incorrect current password', { userId });
        throw new Error('Current password is incorrect.');
      }

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash }
      });

      logger.info('Password updated successfully', { userId });
      return true;
    } catch (error) {
      logger.error('Password update error', { userId, error: error.message });
      throw error;
    }
  }
}

export default new AuthService();
