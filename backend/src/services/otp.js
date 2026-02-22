import crypto from 'crypto';
import prisma from '../db/prisma.js';
import Logger from '../utils/logger.js';

const logger = new Logger('OtpService');

// default configuration constants
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const RESEND_LIMIT = 3; // per window
const RESEND_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_BASE_DELAY_MS = 300; // base multiplier for progressive delay

const randomSixDigitCode = () =>
  String(Math.floor(Math.random() * 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
const hashValue = (val) =>
  crypto.createHash('sha256').update(String(val || '')).digest('hex');

class OtpService {
  /**
   * Generate an OTP for a given user and purpose.
   * Enforces resend limits and invalidates any previous unused OTPs.
   * @param {string} userId
   * @param {string} purpose
   * @param {object} [opts]
   * @param {string} [opts.ip]
   * @param {string} [opts.deviceInfo]
   */
  async generateOtp(userId, purpose, { ip, deviceInfo } = {}) {
    // count recent OTPs of the same purpose to enforce resend limit
    const windowStart = new Date(Date.now() - RESEND_WINDOW_MS);
    const recent = await prisma.otp.count({
      where: {
        userId,
        purpose,
        createdAt: { gt: windowStart }
      }
    });
    if (recent >= RESEND_LIMIT) {
      const err = new Error('Too many OTP requests. Please try again later.');
      err.code = 'OTP_RESEND_LIMIT';
      throw err;
    }

    // invalidate existing unused otp records for same purpose
    await prisma.otp.updateMany({
      where: { userId, purpose, used: false },
      data: { used: true }
    });

    const code = randomSixDigitCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.otp.create({
      data: {
        userId,
        purpose,
        otpHash: hashValue(code),
        expiresAt,
        ip,
        deviceInfo
      }
    });

    logger.info('OTP generated', { userId, purpose, expiresAt, ip, deviceInfo });
    return { code, expiresAt };
  }

  /**
   * Verify a submitted OTP code for a given user and purpose.
   * On success marks otp as used. On failure increments attempts and may
   * invalidate the otp when attempts exceed the limit.
   */
  async verifyOtp(userId, purpose, submittedCode, { ip, deviceInfo } = {}) {
    const now = new Date();
    const otpRecord = await prisma.otp.findFirst({
      where: {
        userId,
        purpose,
        used: false
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!otpRecord) {
      throw new Error('No OTP pending for this action.');
    }

    if (now > otpRecord.expiresAt) {
      // expire it so user needs to request again
      await prisma.otp.update({
        where: { id: otpRecord.id },
        data: { used: true }
      });
      throw new Error('OTP expired. Please request a new code.');
    }

    if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.otp.update({
        where: { id: otpRecord.id },
        data: { used: true }
      });
      throw new Error('Maximum verification attempts exceeded. Please request a new code.');
    }

    const expected = otpRecord.otpHash;
    const providedHash = hashValue(String(submittedCode).replace(/\D/g, ''));

    if (providedHash !== expected) {
      // incorrect
      const attempts = otpRecord.attempts + 1;
      const update = { attempts };
      if (attempts >= OTP_MAX_ATTEMPTS) {
        update.used = true;
      }
      await prisma.otp.update({ where: { id: otpRecord.id }, data: update });

      // progressive delay
      const delay = ATTEMPT_BASE_DELAY_MS * attempts;
      await new Promise((r) => setTimeout(r, delay));

      logger.warn('OTP verification failed', { userId, purpose, attempts, ip, deviceInfo });
      throw new Error('Invalid OTP code.');
    }

    // success
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { used: true }
    });

    logger.info('OTP verified', { userId, purpose, ip, deviceInfo });
    return true;
  }

  /**
   * Cleanup expired OTPs periodically. Call from server startup.
   */
  async cleanupExpiredOtps() {
    const now = new Date();
    const result = await prisma.otp.updateMany({
      where: { expiresAt: { lt: now }, used: false },
      data: { used: true }
    });
    if (result.count > 0) {
      logger.info('Cleaned up expired OTPs', { count: result.count });
    }
  }
}

export default new OtpService();
