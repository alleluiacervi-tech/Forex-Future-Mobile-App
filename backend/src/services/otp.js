import crypto from 'crypto';
import prisma from '../db/prisma.js';
import Logger from '../utils/logger.js';

const logger = new Logger('OtpService');

// default configuration constants
const OTP_LENGTH = 6;
const toPositiveInt = (value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  if (rounded < min) return fallback;
  return Math.min(rounded, max);
};

const OTP_EXPIRY_MINUTES = toPositiveInt(process.env.OTP_EXPIRES_MIN, 5, { min: 1, max: 60 });
const OTP_MAX_ATTEMPTS = toPositiveInt(process.env.OTP_MAX_ATTEMPTS, 5, { min: 1, max: 20 });
const RESEND_LIMIT = toPositiveInt(process.env.OTP_RESEND_LIMIT, 3, { min: 1, max: 20 }); // per window
const RESEND_WINDOW_MS = toPositiveInt(process.env.OTP_RESEND_WINDOW_MIN, 15, { min: 1, max: 24 * 60 }) * 60 * 1000; // minutes
const ATTEMPT_BASE_DELAY_MS = 300; // base multiplier for progressive delay

const randomSixDigitCode = () =>
  String(Math.floor(Math.random() * 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
const hashValue = (val) =>
  crypto.createHash('sha256').update(String(val || '')).digest('hex');
const normalizeOtpCode = (value) => String(value || '').replace(/\D/g, '').slice(0, OTP_LENGTH);

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
    const code = randomSixDigitCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const windowStart = new Date(Date.now() - RESEND_WINDOW_MS);

    await prisma.$transaction(async (tx) => {
      // count recent OTPs of the same purpose to enforce resend limit
      const recent = await tx.otp.count({
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
      await tx.otp.updateMany({
        where: { userId, purpose, used: false },
        data: { used: true }
      });

      await tx.otp.create({
        data: {
          userId,
          purpose,
          otpHash: hashValue(code),
          expiresAt,
          ip,
          deviceInfo
        }
      });
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
    const submitted = normalizeOtpCode(submittedCode);
    if (!submitted || submitted.length !== OTP_LENGTH) {
      throw new Error('Invalid OTP code.');
    }

    const now = new Date();
    const providedHash = hashValue(submitted);

    const outcome = await prisma.$transaction(async (tx) => {
      const otpRecord = await tx.otp.findFirst({
        where: {
          userId,
          purpose,
          used: false
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!otpRecord) {
        return { status: 'missing' };
      }

      if (now > otpRecord.expiresAt) {
        // expire it so user needs to request again
        await tx.otp.updateMany({
          where: { id: otpRecord.id, used: false },
          data: { used: true }
        });
        return { status: 'expired' };
      }

      if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
        await tx.otp.updateMany({
          where: { id: otpRecord.id, used: false },
          data: { used: true }
        });
        return { status: 'max' };
      }

      if (providedHash !== otpRecord.otpHash) {
        // incorrect
        const attempts = otpRecord.attempts + 1;
        const update = attempts >= OTP_MAX_ATTEMPTS ? { attempts, used: true } : { attempts };
        const updated = await tx.otp.updateMany({
          where: { id: otpRecord.id, used: false },
          data: update
        });

        if (!updated.count) {
          return { status: 'missing' };
        }

        return { status: 'invalid', attempts };
      }

      // success: consume OTP if it is still available.
      const consumed = await tx.otp.updateMany({
        where: { id: otpRecord.id, used: false },
        data: { used: true }
      });

      if (!consumed.count) {
        return { status: 'missing' };
      }

      return { status: 'verified' };
    });

    if (outcome.status === 'verified') {
      logger.info('OTP verified', { userId, purpose, ip, deviceInfo });
      return true;
    }

    if (outcome.status === 'invalid') {
      const attempts = Number.isFinite(Number(outcome.attempts)) ? Number(outcome.attempts) : 1;
      const delay = ATTEMPT_BASE_DELAY_MS * Math.max(1, attempts);
      await new Promise((r) => setTimeout(r, delay));

      logger.warn('OTP verification failed', { userId, purpose, attempts, ip, deviceInfo });
      throw new Error('Invalid OTP code.');
    }

    if (outcome.status === 'expired') {
      throw new Error('OTP expired. Please request a new code.');
    }

    if (outcome.status === 'max') {
      throw new Error('Maximum verification attempts exceeded. Please request a new code.');
    }

    throw new Error('No OTP pending for this action.');
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
