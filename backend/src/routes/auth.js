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
import Logger from "../utils/logger.js";

const router = express.Router();
const logger = new Logger('AuthRoutes');

const resetThrottle = new Map();
const resetThrottleMs = Number(process.env.PASSWORD_RESET_THROTTLE_MS || 60_000);
const verifyThrottle = new Map();
const verifyThrottleMs = Number(process.env.EMAIL_VERIFICATION_THROTTLE_MS || 60_000);

router.post("/register", async (req, res) => {
  const { data, error } = parseSchema(registerSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const result = await authService.registerUser(data.name, data.email, data.password);
    const user = result?.user || result;
    return res.status(201).json({
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
    
    if (error.message.includes('already registered')) {
      return res.status(409).json({ error: error.message });
    }
    if (error.message.includes('must be')) {
      return res.status(400).json({ error: error.message });
    }
    
    return res.status(500).json({ error: "Registration failed." });
  }
});

router.post("/email/verify", async (req, res) => {
  const { data, error } = parseSchema(verifyEmailSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const normalizedEmail = data.email.trim().toLowerCase();
  const key = `verify:${req.ip}|${normalizedEmail}`;
  const lastAt = verifyThrottle.get(key) || 0;
  const now = Date.now();
  if (now - lastAt < verifyThrottleMs) {
    return res.status(429).json({ error: "Too many attempts. Please wait a moment and try again." });
  }
  verifyThrottle.set(key, now);

  try {
    const result = await authService.verifyEmailCode(normalizedEmail, data.code);
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Email verification failed." });
  }
});

router.post("/email/resend", async (req, res) => {
  const { data, error } = parseSchema(resendVerificationSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const normalizedEmail = data.email.trim().toLowerCase();
  const key = `resend:${req.ip}|${normalizedEmail}`;
  const lastAt = verifyThrottle.get(key) || 0;
  const now = Date.now();
  if (now - lastAt < verifyThrottleMs) {
    return res.json({ message: "If the account exists, a new verification code will be sent shortly." });
  }
  verifyThrottle.set(key, now);

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
    return res.status(400).json({ error });
  }

  try {
    const { user, token } = await authService.authenticateUser(data.email, data.password);
    return res.json({
      user,
      account: user.account,
      token
    });
  } catch (error) {
    logger.error('Login endpoint error', { error: error.message });
    
    if (error.message.includes('trial must be activated')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message.toLowerCase().includes('email verification required')) {
      return res.status(403).json({ error: error.message, verificationRequired: true });
    }
    
    return res.status(401).json({ error: error.message });
  }
});

router.post("/trial/start", async (req, res) => {
  const { data, error } = parseSchema(trialStartSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const { user, token } = await authService.startTrial(data.email, data.password);
    return res.json({ user, account: user.account, token });
  } catch (error) {
    logger.error('Trial start endpoint error', { error: error.message });
    
    if (error.message.includes('already active')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.toLowerCase().includes('email verification required')) {
      return res.status(403).json({ error: error.message, verificationRequired: true });
    }
    
    return res.status(401).json({ error: error.message });
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
      message: "If an account exists for that email, you'll receive password reset instructions shortly."
    });
  }
  resetThrottle.set(key, now);

  try {
    const result = await authService.requestPasswordReset(normalizedEmail, { ip: req.ip });
    if (result?.unavailable) {
      return res.status(503).json({ error: "Password reset is temporarily unavailable." });
    }

    const response = {
      message: "If an account exists for that email, you'll receive password reset instructions shortly."
    };

    if (result?.debugToken || result?.debugLink) {
      return res.json({ ...response, debugToken: result.debugToken, debugLink: result.debugLink });
    }

    return res.json(response);
  } catch (err) {
    logger.error("Forgot-password endpoint error", { email: normalizedEmail, error: err?.message });
    return res.json({
      message: "If an account exists for that email, you'll receive password reset instructions shortly."
    });
  }
});

router.post("/password/reset", async (req, res) => {
  const { data, error } = parseSchema(resetPasswordSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    await authService.resetPasswordWithToken(data.token, data.newPassword);
    return res.json({ message: "Password reset successfully. Please log in with your new password." });
  } catch (err) {
    logger.warn("Password reset failed", { error: err?.message, ip: req.ip });
    return res.status(400).json({ error: err instanceof Error ? err.message : "Password reset failed." });
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
    
    if (error.message.includes('incorrect')) {
      return res.status(401).json({ error: error.message });
    }
    
    return res.status(400).json({ error: error.message });
  }
});

export default router;
