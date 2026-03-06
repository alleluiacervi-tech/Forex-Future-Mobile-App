import express from "express";
import {
  forgotPasswordSchema,
  loginSchema,
  parseSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  trialStartSchema,
  verifyEmailSchema
} from "../utils/validators.js";
import authenticate from "../middleware/auth.js";
import authService from "../services/auth.js";
import otpService from "../services/otp.js";
import prisma from "../db/prisma.js"; // ADDED: for refresh token operations
import Logger from "../utils/logger.js";

const router = express.Router();
const logger = new Logger('AuthRoutes');

const resetThrottle = new Map();
const resetThrottleMs = Number(process.env.PASSWORD_RESET_THROTTLE_MS || 60_000);

const toNonNegativeInt = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

const emailVerificationThrottleWindowMs = toNonNegativeInt(process.env.EMAIL_VERIFICATION_THROTTLE_MS, 60_000);
const emailVerificationThrottleMaxAttempts = toNonNegativeInt(process.env.EMAIL_VERIFICATION_THROTTLE_MAX_ATTEMPTS, 6);

const verifyThrottle = new Map();
const resendThrottle = new Map();

const secondsFromMs = (ms) => Math.max(1, Math.ceil(ms / 1000));

const checkVerifyRateLimit = (key) => {
  if (emailVerificationThrottleWindowMs <= 0 || emailVerificationThrottleMaxAttempts <= 0) {
    return { throttled: false };
  }

  const now = Date.now();
  const existing = verifyThrottle.get(key);
  if (!existing || typeof existing !== "object") {
    verifyThrottle.set(key, { windowStart: now, attempts: 1 });
    return { throttled: false };
  }

  const windowStart = Number(existing.windowStart || 0);
  const attempts = Number(existing.attempts || 0);
  const withinWindow = windowStart > 0 && now - windowStart < emailVerificationThrottleWindowMs;

  if (!withinWindow) {
    verifyThrottle.set(key, { windowStart: now, attempts: 1 });
    return { throttled: false };
  }

  if (attempts >= emailVerificationThrottleMaxAttempts) {
    const retryAfterMs = emailVerificationThrottleWindowMs - (now - windowStart);
    const retryAfterSec = secondsFromMs(retryAfterMs);
    return { throttled: true, retryAfterSec };
  }

  verifyThrottle.set(key, { windowStart, attempts: attempts + 1 });
  return { throttled: false };
};

const checkResendRateLimit = (key) => {
  if (emailVerificationThrottleWindowMs <= 0) {
    return { throttled: false };
  }

  const now = Date.now();
  const lastAt = Number(resendThrottle.get(key) || 0);
  if (lastAt > 0 && now - lastAt < emailVerificationThrottleWindowMs) {
    const retryAfterMs = emailVerificationThrottleWindowMs - (now - lastAt);
    const retryAfterSec = secondsFromMs(retryAfterMs);
    return { throttled: true, retryAfterSec };
  }

  resendThrottle.set(key, now);
  return { throttled: false };
};

router.post("/register", async (req, res) => {
  const { data, error } = parseSchema(registerSchema, req.body);
  if (error) {
    return res.status(400).json({ error, code: 'VALIDATION_ERROR' });
  }

  try {
    const card =
      data.cardNumber && data.cardExpMonth && data.cardExpYear && data.cardCvc
        ? {
            cardNumber: data.cardNumber,
            cardExpMonth: data.cardExpMonth,
            cardExpYear: data.cardExpYear,
            cardCvc: data.cardCvc
          }
        : undefined;

    const result = await authService.registerUser(
      data.name,
      data.email,
      data.password,
      card
    );
    const user = result?.user || result;
    // ADDED: success response with consistent format
    return res.status(201).json({
      success: true,
      user,
      account: user.account,
      trialRequired: true,
      verificationRequired: Boolean(result?.verificationRequired),
      verificationUnavailable: Boolean(result?.verificationUnavailable),
      debugCode: result?.debugCode,
      debugExpiresAt: result?.debugExpiresAt
    });
  } catch (error) {
    logger.error('Registration endpoint error', { error: error.message });

    // ADDED: Error code for email already exists
    if (error.message.includes('already registered')) {
      return res.status(409).json({ error: error.message, code: 'AUTH_EMAIL_EXISTS' });
    }
    if (error.message.includes('must be')) {
      return res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
    }

    // ADDED: Error code for server error
    return res.status(500).json({ error: "Registration failed.", code: 'SERVER_ERROR' });
  }
});

router.post("/email/verify", async (req, res) => {
  const { data, error } = parseSchema(verifyEmailSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const normalizedEmail = data.email.trim().toLowerCase();
  const key = `verify:${req.ip}|${normalizedEmail}`;
  const limited = checkVerifyRateLimit(key);
  if (limited.throttled) {
    res.set("Retry-After", String(limited.retryAfterSec));
    return res
      .status(429)
      // ADDED: Error code for rate limiting
      .json({ error: `Too many attempts. Please wait ${limited.retryAfterSec}s and try again.`, retryAfterSec: limited.retryAfterSec, code: 'AUTH_OTP_MAX_ATTEMPTS' });
  }

  try {
    const result = await authService.verifyEmailCode(normalizedEmail, data.code, {
      ip: req.ip,
      deviceInfo: req.get("user-agent")
    });
    verifyThrottle.delete(key);
    return res.json({ ok: true, ...result });
  } catch (err) {
    // ADDED: Error codes for OTP verification failures
    const message = err instanceof Error ? err.message : "Email verification failed.";
    let code = 'AUTH_OTP_INVALID';
    if (message.toLowerCase().includes('expired')) code = 'AUTH_OTP_EXPIRED';
    if (message.toLowerCase().includes('maximum') || message.toLowerCase().includes('too many')) code = 'AUTH_OTP_MAX_ATTEMPTS';
    return res.status(400).json({ error: message, code });
  }
});

router.post("/email/resend", async (req, res) => {
  const { data, error } = parseSchema(resendVerificationSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const normalizedEmail = data.email.trim().toLowerCase();
  const key = `resend:${req.ip}|${normalizedEmail}`;
  const limited = checkResendRateLimit(key);
  if (limited.throttled) {
    return res.json({ message: "If the account exists, a new verification code will be sent shortly." });
  }

  try {
    const result = await authService.requestEmailVerification(normalizedEmail, { ip: req.ip });
    if (result?.unavailable) {
      return res.status(503).json({ error: "Email verification is temporarily unavailable." });
    }
    return res.json({
      message: "If the account exists, a new verification code will be sent shortly.",
      debugCode: result?.debugCode,
      debugExpiresAt: result?.debugExpiresAt
    });
  } catch (err) {
    logger.error("Resend verification endpoint error", { email: normalizedEmail, error: err?.message });
    return res.json({ message: "If the account exists, a new verification code will be sent shortly." });
  }
});

router.post("/login", async (req, res) => {
  const { data, error } = parseSchema(loginSchema, req.body);
  if (error) {
    return res.status(400).json({ error, code: 'VALIDATION_ERROR' });
  }

  try {
    const result = await authService.authenticateUser(data.email, data.password);
    if (result.otpRequired) {
      // OTP was sent instead of issuing token
      return res.json({ success: true, otpRequired: true, debugCode: result.debugCode, debugExpiresAt: result.debugExpiresAt });
    }
    const { user, token } = result;
    // ADDED: generate refresh token on login
    const crypto = await import('crypto');
    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ip: req.ip,
        userAgent: req.get('user-agent') || null,
      },
    });
    // ADDED: success flag for consistent response format
    return res.json({
      success: true,
      user,
      account: user.account,
      token,
      refreshToken: rawRefreshToken,
    });
  } catch (error) {
    logger.error('Login endpoint error', { error: error.message });

    // ADDED: Error code AUTH_SUB_TRIAL_EXPIRED for trial issues
    if (
      error.message.toLowerCase().includes('trial must be activated') ||
      error.message.toLowerCase().includes('free trial must be activated')
    ) {
      return res.status(403).json({ success: false, error: error.message, code: 'SUB_TRIAL_EXPIRED', trialRequired: true });
    }
    if (error.message.toLowerCase().includes('trial has expired')) {
      return res.status(403).json({ success: false, error: error.message, code: 'SUB_TRIAL_EXPIRED', trialRequired: true });
    }
    // ADDED: Error code AUTH_EMAIL_NOT_VERIFIED for unverified email
    if (error.message.toLowerCase().includes('email verification required')) {
      return res.status(403).json({ success: false, error: error.message, code: 'AUTH_EMAIL_NOT_VERIFIED', verificationRequired: true });
    }

    // FIX: Use errorCode from service to distinguish user-not-found from wrong-password
    if (error.errorCode === 'AUTH_USER_NOT_FOUND') {
      return res.status(401).json({ success: false, error: error.message, code: 'AUTH_USER_NOT_FOUND' });
    }
    if (error.errorCode === 'AUTH_INVALID_CREDENTIALS') {
      return res.status(401).json({ success: false, error: error.message, code: 'AUTH_INVALID_CREDENTIALS' });
    }

    // ADDED: Fallback for any other auth error
    return res.status(401).json({ success: false, error: error.message, code: 'AUTH_INVALID_CREDENTIALS' });
  }
});

router.post("/trial/start", async (req, res) => {
  const { data, error } = parseSchema(trialStartSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const card = {
      cardNumber: data.cardNumber,
      cardExpMonth: data.cardExpMonth,
      cardExpYear: data.cardExpYear,
      cardCvc: data.cardCvc,
      name: data.cardName,
      billingPostalCode: data.cardPostalCode
    };
    const { user, token } = await authService.startTrial(data.email, data.password, card);
    // ADDED: generate refresh token on trial start
    const crypto = await import('crypto');
    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ip: req.ip,
        userAgent: req.get('user-agent') || null,
      },
    });
    return res.json({ success: true, user, account: user.account, token, refreshToken: rawRefreshToken });
  } catch (error) {
    logger.error('Trial start endpoint error', { error: error.message });

    // ADDED: Specific error codes for trial start failures
    if (error.message.toLowerCase().includes('card has already been used')) {
      return res.status(409).json({ error: error.message, code: 'SUB_CARD_REUSED' });
    }
    if (
      error.message.toLowerCase().includes('already active') ||
      error.message.toLowerCase().includes('already used')
    ) {
      return res.status(400).json({ error: error.message, code: 'SUB_TRIAL_ALREADY_USED' });
    }
    if (error.message.toLowerCase().includes('email verification required')) {
      return res.status(403).json({ error: error.message, code: 'AUTH_EMAIL_NOT_VERIFIED', verificationRequired: true });
    }
    if (
      error.message.toLowerCase().includes('payment information') ||
      error.message.toLowerCase().includes('card details')
    ) {
      return res.status(400).json({ error: error.message, code: 'SUB_PAYMENT_FAILED' });
    }

    return res.status(401).json({ error: error.message, code: 'AUTH_INVALID_CREDENTIALS' });
  }
});

router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.id);
    return res.json({ user, account: user.account });
  } catch (error) {
    logger.error('Get user endpoint error', { userId: req.user.id, error: error.message });
    return res.status(404).json({ error: error.message });
  }
});

router.post("/password/forgot", async (req, res) => {
  const { data, error } = parseSchema(forgotPasswordSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const normalizedEmail = data.email.trim().toLowerCase();
  const key = `${req.ip}|${normalizedEmail}`;
  const lastAt = resetThrottle.get(key) || 0;
  const now = Date.now();
  if (now - lastAt < resetThrottleMs) {
    return res.json({
      message: "If an account exists for that email, you'll receive a password reset code shortly."
    });
  }
  resetThrottle.set(key, now);

  try {
    const result = await authService.requestPasswordReset(normalizedEmail, { ip: req.ip });
    if (result?.unavailable) {
      return res.status(503).json({ error: "Password reset is temporarily unavailable." });
    }

    const response = {
      message: "If an account exists for that email, you'll receive a password reset code shortly."
    };

    if (result?.debugCode || result?.debugExpiresAt) {
      return res.json({ ...response, debugCode: result.debugCode, debugExpiresAt: result.debugExpiresAt });
    }

    return res.json(response);
  } catch (err) {
    logger.error("Forgot-password endpoint error", { email: normalizedEmail, error: err?.message });
    return res.json({
      message: "If an account exists for that email, you'll receive a password reset code shortly."
    });
  }
});

router.post("/password/reset", async (req, res) => {
  const { data, error } = parseSchema(resetPasswordSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    await authService.resetPasswordWithOtp(data.email, data.code, data.newPassword, { ip: req.ip });
    return res.json({ message: "Password reset successfully. Please log in with your new password." });
  } catch (err) {
    logger.warn("Password reset failed", { error: err?.message, ip: req.ip });
    // ADDED: Error codes for password reset failures
    const message = err instanceof Error ? err.message : "Password reset failed.";
    let code = 'SERVER_ERROR';
    if (message.toLowerCase().includes('expired')) code = 'AUTH_OTP_EXPIRED';
    if (message.toLowerCase().includes('invalid') || message.toLowerCase().includes('incorrect')) code = 'AUTH_OTP_INVALID';
    return res.status(400).json({ error: message, code });
  }
});

router.post("/password/change", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current password and new password are required." });
  }

  try {
    await authService.updatePassword(req.user.id, currentPassword, newPassword);
    return res.json({ message: "Password updated successfully." });
  } catch (error) {
    logger.error('Password change endpoint error', { userId: req.user.id, error: error.message });
    
    // ADDED: Error code for incorrect current password
    if (error.message.includes('incorrect')) {
      return res.status(401).json({ error: error.message, code: 'AUTH_INVALID_CREDENTIALS' });
    }

    return res.status(400).json({ error: error.message, code: 'SERVER_ERROR' });
  }
});

// ---------- generic OTP utility endpoints ----------

// request an OTP by email & purpose
router.post('/otp/request', async (req, res) => {
  const { email, purpose } = req.body;
  if (!email || !purpose) {
    return res.status(400).json({ error: 'Email and purpose are required.' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!normalizedEmail) {
    return res.status(400).json({ error: 'Invalid email.' });
  }

  try {
    const user = await authService.getUserByEmail(normalizedEmail);
    if (!user) {
      return res.json({ ok: true });
    }

    const { code, expiresAt } = await otpService.generateOtp(user.id, purpose, { ip: req.ip });
    if (purpose === 'password_reset') {
      await authService.sendPasswordResetEmail({ to: user.email, name: user.name, code, expiresAt });
    } else {
      await authService.sendVerificationEmail({ to: user.email, name: user.name, code, expiresAt });
    }
    return res.json({ ok: true, debugCode: process.env.NODE_ENV !== 'production' ? code : undefined });
  } catch (err) {
    logger.error('OTP request failed', { email, purpose, error: err?.message });
    return res.json({ ok: true });
  }
});

// verify an OTP; special handling for login & email_verification
router.post('/otp/verify', async (req, res) => {
  const { email, purpose, code } = req.body;
  if (!email || !purpose || !code) {
    return res.status(400).json({ error: 'Email, purpose and code are required.' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!normalizedEmail) {
    return res.status(400).json({ error: 'Invalid email.' });
  }

  try {
    const user = await authService.getUserByEmail(normalizedEmail);
    if (!user) {
      throw new Error('Invalid code.');
    }

    const deviceInfo = req.get("user-agent");

    if (purpose === 'email_verification') {
      const result = await authService.verifyEmailCode(normalizedEmail, code, {
        ip: req.ip,
        deviceInfo
      });
      return res.json({ ok: true, ...result });
    }

    await otpService.verifyOtp(user.id, purpose, code, { ip: req.ip, deviceInfo });

    if (purpose === 'login') {
      const token = authService.issueToken(user.id);
      // ADDED: generate refresh token on OTP login
      const crypto = await import('crypto');
      const rawRefreshToken = crypto.randomBytes(48).toString('hex');
      const refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: refreshTokenHash,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          ip: req.ip,
          userAgent: req.get('user-agent') || null,
        },
      });
      return res.json({ ok: true, token, refreshToken: rawRefreshToken });
    }

    // password_reset verification doesn't change password here
    return res.json({ ok: true });
  } catch (err) {
    // ADDED: Error codes for OTP verification failures
    const message = err instanceof Error ? err.message : 'Verification failed.';
    let code = 'AUTH_OTP_INVALID';
    if (message.toLowerCase().includes('expired')) code = 'AUTH_OTP_EXPIRED';
    if (message.toLowerCase().includes('maximum') || message.toLowerCase().includes('too many')) code = 'AUTH_OTP_MAX_ATTEMPTS';
    return res.status(400).json({ error: message, code });
  }
});

// ADDED: POST /api/auth/logout — invalidate refresh token
router.post("/logout", authenticate, async (req, res) => {
  try {
    // Delete all refresh tokens for this user
    await prisma.refreshToken.deleteMany({ where: { userId: req.user.id } });
    logger.info("User logged out", { userId: req.user.id });
  } catch (error) {
    logger.error("Logout cleanup error", { userId: req.user.id, error: error.message });
  }
  return res.json({ success: true, message: "Logged out." });
});

// ADDED: POST /api/auth/refresh — exchange refresh token for new access + refresh tokens
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken || typeof refreshToken !== "string") {
    return res.status(401).json({ error: "Refresh token is required.", code: "AUTH_REFRESH_MISSING" });
  }

  try {
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const stored = await prisma.refreshToken.findFirst({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true },
    });

    if (!stored) {
      return res.status(401).json({ error: "Invalid refresh token.", code: "AUTH_REFRESH_INVALID" });
    }

    if (stored.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});
      return res.status(401).json({ error: "Refresh token expired.", code: "AUTH_REFRESH_EXPIRED" });
    }

    // Delete used refresh token (rotate)
    await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});

    // Issue new access token
    const newAccessToken = authService.issueToken(stored.userId);

    // Issue new refresh token
    const newRawRefreshToken = crypto.randomBytes(48).toString('hex');
    const newRefreshTokenHash = crypto.createHash('sha256').update(newRawRefreshToken).digest('hex');
    await prisma.refreshToken.create({
      data: {
        userId: stored.userId,
        tokenHash: newRefreshTokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ip: req.ip,
        userAgent: req.get('user-agent') || null,
      },
    });

    logger.info("Token refreshed", { userId: stored.userId });
    return res.json({ token: newAccessToken, refreshToken: newRawRefreshToken });
  } catch (error) {
    logger.error("Token refresh error", { error: error.message });
    return res.status(500).json({ error: "Token refresh failed.", code: "SERVER_ERROR" });
  }
});

export default router;
