import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import config from '../config.js';
import prisma from '../db/prisma.js';
import Logger from '../utils/logger.js';
import { sendEmail, validateEmailConfig } from "./email.js";
import otpService from './otp.js';
import paymentService from './payment.js';

const logger = new Logger('AuthService');

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EMAIL_LOGO_CID = "forex-future-logo";

const resolveEmailLogoPath = () => {
  const envPath = String(process.env.EMAIL_LOGO_PATH || "").trim();

  const candidates = [
    envPath,
    envPath ? path.resolve(process.cwd(), envPath) : "",
    path.resolve(process.cwd(), "assets", "logo.png"),
    path.resolve(process.cwd(), "assets", "image.png"),
    path.resolve(process.cwd(), "../assets", "logo.png"),
    path.resolve(process.cwd(), "../assets", "image.png"),
    path.join(__dirname, "..", "..", "..", "assets", "logo.png"),
    path.join(__dirname, "..", "..", "..", "assets", "image.png")
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }
  return null;
};

const buildVerificationEmailHtml = ({ brandName, greeting, codeDisplay, codeRaw, link, expiresMinutes, hasLogo }) => {
  const safeBrand = escapeHtml(brandName);
  const safeGreeting = escapeHtml(greeting);
  const safeCodeDisplay = escapeHtml(codeDisplay);
  const safeCodeRaw = escapeHtml(codeRaw);
  const safeLink = link ? escapeHtml(link) : "";

  const preheader = `Your ${safeBrand} verification code is ${safeCodeRaw}.`;

  const buttonHtml = link
    ? `
      <tr>
        <td align="center" style="padding: 8px 0 0 0;">
          <a href="${safeLink}"
             style="display: inline-block; background: #00D1FF; color: #041018; text-decoration: none; font-weight: 700; padding: 12px 18px; border-radius: 12px;">
            Verify Email
          </a>
        </td>
      </tr>
    `
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${safeBrand} – Verify Email</title>
  </head>
  <body style="margin:0; padding:0; background-color:#070E17;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
      ${preheader}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#070E17; padding: 24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:560px; max-width:560px;">
            <tr>
              <td style="padding: 0 14px 14px 14px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #0B1B2B; border: 1px solid #13314A; border-radius: 18px; overflow: hidden;">
                  <tr>
                    <td style="padding: 18px 18px 10px 18px; background: linear-gradient(135deg, #0B1B2B 0%, #071A2A 60%, #0B1B2B 100%);">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td align="center" style="padding: 0 0 8px 0;">
                            ${
                              hasLogo
                                ? `<img src="cid:${EMAIL_LOGO_CID}" width="72" height="72" alt="${safeBrand} logo" style="display:block; width:72px; height:72px; border-radius: 16px;" />`
                                : `<div style="font-weight:800; font-size:20px; letter-spacing:0.5px; color:#E6F0FF;">${safeBrand}</div>`
                            }
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color:#E6F0FF; font-weight:800; font-size: 20px; letter-spacing: 0.2px;">
                            Verify your email
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 18px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color:#E6F0FF; font-size: 14px; line-height: 20px;">
                            ${safeGreeting}<br />
                            Use the one‑time code below to verify your email address.
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 14px 0 6px 0;">
                            <div style="background:#071A2A; border: 1px solid #13314A; border-radius: 14px; padding: 16px 18px; text-align: center;">
                              <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color:#00D1FF;">
                                ${safeCodeDisplay}
                              </div>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color:#9FB2C8; font-size: 12px; line-height: 18px;">
                            This code expires in <strong style="color:#E6F0FF;">${escapeHtml(expiresMinutes)}</strong> minutes. Do not share it with anyone.
                          </td>
                        </tr>
                        ${buttonHtml}
                        <tr>
                          <td style="padding-top: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color:#9FB2C8; font-size: 12px; line-height: 18px;">
                            If you didn’t request this, you can safely ignore this email.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color:#5E7894; font-size: 11px; line-height: 16px; text-align:center; padding: 14px 0 0 0;">
                  © ${new Date().getFullYear()} ${safeBrand}. All rights reserved.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const FREE_TRIAL_DAYS = Number.isFinite(Number(process.env.FREE_TRIAL_DAYS))
  ? Math.max(1, Math.floor(Number(process.env.FREE_TRIAL_DAYS)))
  : 7;
const FREE_TRIAL_DURATION_MS = FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000;

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

  isTrialExpired(trialStartedAt) {
    if (!(trialStartedAt instanceof Date)) return true;
    return Date.now() - trialStartedAt.getTime() >= FREE_TRIAL_DURATION_MS;
  }

  async deactivateTrial(userId) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { trialActive: false },
        select: { id: true },
      });
    } catch (error) {
      logger.error("Failed to deactivate expired trial", { userId, error: error.message });
    }
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

  passwordResetSecretFor(passwordHash) {
    return `${config.jwtSecret}|password-reset|${passwordHash}`;
  }

  issuePasswordResetToken(user) {
    const expiresIn = process.env.PASSWORD_RESET_EXPIRES_IN || "15m";
    const secret = this.passwordResetSecretFor(user.passwordHash);
    return jwt.sign(
      { sub: user.id, purpose: "password_reset" },
      secret,
      { expiresIn }
    );
  }

  async verifyPasswordResetToken(token) {
    if (!token || typeof token !== "string") {
      throw new Error("Missing reset token.");
    }

    const decoded = jwt.decode(token);
    const userId = decoded && typeof decoded === "object" ? decoded.sub : null;
    if (typeof userId !== "string" || !userId) {
      throw new Error("Invalid or expired reset token.");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true }
    });
    if (!user?.passwordHash) {
      throw new Error("Invalid or expired reset token.");
    }

    try {
      const secret = this.passwordResetSecretFor(user.passwordHash);
      const payload = jwt.verify(token, secret);
      if (!payload || typeof payload !== "object" || payload.purpose !== "password_reset") {
        throw new Error("Invalid or expired reset token.");
      }
      return { userId: user.id, email: user.email };
    } catch {
      throw new Error("Invalid or expired reset token.");
    }
  }

  buildPasswordResetLink(token) {
    const defaultResetUrl = "forexapp://reset-password?token={token}";
    const base =
      process.env.PASSWORD_RESET_URL ||
      process.env.PASSWORD_RESET_LINK_BASE ||
      defaultResetUrl;

    if (base.includes("{token}")) {
      return base.replace("{token}", encodeURIComponent(token));
    }

    const joiner = base.includes("?") ? "&" : "?";
    const needsJoiner = !(base.endsWith("?") || base.endsWith("&"));
    return `${base}${needsJoiner ? joiner : ""}token=${encodeURIComponent(token)}`;
  }

  buildEmailVerificationLink({ email, code }) {
    const base = process.env.EMAIL_VERIFY_URL || "forexapp://verify-email?email={email}&code={code}";

    const encodedEmail = encodeURIComponent(String(email || ""));
    const encodedCode = encodeURIComponent(String(code || ""));

    // Supports templates: ...?email={email}&code={code}
    if (base.includes("{email}") || base.includes("{code}")) {
      return base.replace("{email}", encodedEmail).replace("{code}", encodedCode);
    }

    // Fallback: append as query params.
    const joiner = base.includes("?") ? "&" : "?";
    const needsJoiner = !(base.endsWith("?") || base.endsWith("&"));
    return `${base}${needsJoiner ? joiner : ""}email=${encodedEmail}&code=${encodedCode}`;
  }

  emailVerificationPolicy() {
    const emailValidation = validateEmailConfig();
    const emailAvailable = emailValidation.ok;
    const allowDebugReturn =
      process.env.NODE_ENV !== "production" &&
      process.env.EMAIL_VERIFICATION_DEBUG_RETURN_CODE !== "false";
    const requireEmail =
      process.env.EMAIL_VERIFICATION_REQUIRE_EMAIL === "true" ||
      process.env.NODE_ENV === "production";

    return { emailAvailable, allowDebugReturn, requireEmail, emailValidation };
  }

  // legacy: moved to otpService. kept for backward compatibility if needed.
  async issueAndStoreEmailVerificationCode(userId) {
    // delegate to otpService with purpose "email_verification"
    return otpService.generateOtp(userId, 'email_verification');
  }

  async sendVerificationEmail({ to, name, code, expiresAt }) {
    const brandName = String(process.env.EMAIL_BRAND_NAME || "Forex Future").trim() || "Forex Future";
    const link = this.buildEmailVerificationLink({ email: to, code });

    const cleanedCode = String(code || "").replace(/\s+/g, "");
    const codeDisplay = cleanedCode.length === 6 ? `${cleanedCode.slice(0, 3)} ${cleanedCode.slice(3)}` : cleanedCode;

    const greetingName = String(name || "").trim();
    const greeting = greetingName ? `Hi ${greetingName},` : "Hi,";

    const fallbackMinutes = Number(process.env.EMAIL_VERIFICATION_EXPIRES_MIN || 10);
    const expiresMinutesRaw = expiresAt instanceof Date ? Math.ceil((expiresAt.getTime() - Date.now()) / 60_000) : fallbackMinutes;
    const expiresMinutes = Number.isFinite(expiresMinutesRaw) && expiresMinutesRaw > 0 ? expiresMinutesRaw : fallbackMinutes;

    const logoPath = resolveEmailLogoPath();
    const attachments = logoPath
      ? [
          {
            filename: path.basename(logoPath),
            path: logoPath,
            cid: EMAIL_LOGO_CID
          }
        ]
      : undefined;

    const lines = [
      greeting,
      "",
      `Your ${brandName} verification code is: ${cleanedCode}`,
      `This code expires in ${expiresMinutes} minutes.`,
      "",
      link ? `Verify link: ${link}` : "",
      "",
      "Do not share this code with anyone.",
      "If you didn't request this, you can safely ignore this email."
    ].filter(Boolean);

    const html = buildVerificationEmailHtml({
      brandName,
      greeting,
      codeDisplay,
      codeRaw: cleanedCode,
      link,
      expiresMinutes,
      hasLogo: Boolean(logoPath)
    });

    await sendEmail({
      to,
      subject: `${brandName} verification code`,
      text: lines.join("\n"),
      html,
      attachments
    });
  }

  async requestEmailVerification(email, { ip } = {}) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !this.validateEmail(normalizedEmail)) {
      return { ok: true };
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, email: true, name: true, emailVerified: true }
    });

    if (!user || user.emailVerified) {
      // Keep response generic.
      return { ok: true };
    }

    const policy = this.emailVerificationPolicy();
    if (!policy.emailAvailable && policy.requireEmail) {
      logger.warn("Email verification unavailable (email not configured)", { errors: policy.emailValidation.errors });
      return { ok: false, unavailable: true };
    }

    const { code, expiresAt } = await otpService.generateOtp(user.id, 'email_verification', { ip });

    if (!policy.emailAvailable) {
      if (policy.allowDebugReturn) {
        return { ok: true, debugCode: code, debugExpiresAt: expiresAt.toISOString() };
      }
      return { ok: true };
    }

    try {
      await this.sendVerificationEmail({ to: user.email, name: user.name, code, expiresAt });
      return { ok: true };
    } catch (error) {
      logger.error("Verification email send failed", { email: normalizedEmail, ip, error: error.message });
      if (policy.allowDebugReturn) {
        return { ok: true, debugCode: code, debugExpiresAt: expiresAt.toISOString() };
      }
      return { ok: true };
    }
  }

  // verify OTP code for email verification; also activate trial if necessary.
  async verifyEmailCode(email, code, { ip, deviceInfo } = {}) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const submitted = String(code || "").replace(/\D/g, "");
    if (!normalizedEmail || !this.validateEmail(normalizedEmail)) {
      throw new Error("Invalid email.");
    }
    if (!submitted || submitted.length < 4) {
      throw new Error("Invalid verification code.");
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, emailVerified: true, trialActive: true, trialStartedAt: true }
    });

    if (!user) {
      throw new Error("Invalid verification code.");
    }
    if (user.emailVerified) {
      return { ok: true, alreadyVerified: true };
    }

    // delegate to otpService, will throw on failure
    await otpService.verifyOtp(user.id, 'email_verification', submitted, { ip, deviceInfo });

    // mark user verified
    const updates = {
      emailVerified: true,
      emailVerifiedAt: new Date()
    };

    // if trial not yet active, start it
    if (!user.trialActive) {
      updates.trialActive = true;
      updates.trialStartedAt = new Date();
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updates
    });

    return { ok: true };
  }

  async sendPasswordResetEmail({ to, name, code, expiresAt }) {
    const brandName = String(process.env.EMAIL_BRAND_NAME || "Forex Future").trim() || "Forex Future";
    const greeting = name ? `Hi ${name},` : "Hi,";

    const cleanedCode = String(code || "").replace(/\s+/g, "");
    const codeDisplay = cleanedCode.length === 6 ? `${cleanedCode.slice(0, 3)} ${cleanedCode.slice(3)}` : cleanedCode;

    const fallbackMinutes = Number(process.env.PASSWORD_RESET_EXPIRES_MIN || 5);
    const expiresMinutesRaw = expiresAt instanceof Date ? Math.ceil((expiresAt.getTime() - Date.now()) / 60_000) : fallbackMinutes;
    const expiresMinutes = Number.isFinite(expiresMinutesRaw) && expiresMinutesRaw > 0 ? expiresMinutesRaw : fallbackMinutes;

    const logoPath = resolveEmailLogoPath();
    const attachments = logoPath
      ? [
          {
            filename: path.basename(logoPath),
            path: logoPath,
            cid: EMAIL_LOGO_CID
          }
        ]
      : undefined;

    const lines = [
      greeting,
      "",
      `Use the code below to reset your ${brandName} password:`,
      `Code: ${cleanedCode}`,
      `This code expires in ${expiresMinutes} minutes.`,
      "",
      "Do not share this code with anyone.",
      "If you didn't request this, you can safely ignore this email."
    ].filter(Boolean);

    const html = buildVerificationEmailHtml({
      brandName,
      greeting,
      codeDisplay,
      codeRaw: cleanedCode,
      expiresMinutes,
      hasLogo: Boolean(logoPath)
    });

    await sendEmail({
      to,
      subject: `${brandName} password reset code`,
      text: lines.join("\n"),
      html,
      attachments
    });
  }

  async requestPasswordReset(email, { ip } = {}) {
    logger.info("Password reset requested", { email, ip });

    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !this.validateEmail(normalizedEmail)) {
      return { ok: true };
    }

    const emailValidation = validateEmailConfig();
    const emailAvailable = emailValidation.ok;
    const allowDebugReturn =
      process.env.NODE_ENV !== "production";
    const requireEmail =
      process.env.PASSWORD_RESET_REQUIRE_EMAIL === "true" ||
      process.env.NODE_ENV === "production";

    if (!emailAvailable && requireEmail) {
      logger.warn("Password reset unavailable (email not configured)", { errors: emailValidation.errors });
      return { ok: false, unavailable: true };
    }

    let user = null;
    try {
      user = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        select: { id: true, email: true, name: true, passwordHash: true }
      });
    } catch (error) {
      logger.error("Password reset lookup failed", { email: normalizedEmail, error: error.message });
    }

    if (!user?.passwordHash) {
      return { ok: true };
    }

    // create OTP record
    const { code, expiresAt } = await otpService.generateOtp(user.id, 'password_reset', { ip });

    if (!emailAvailable) {
      if (allowDebugReturn) {
        return { ok: true, debugCode: code, debugExpiresAt: expiresAt.toISOString() };
      }
      return { ok: true };
    }

    try {
      await this.sendPasswordResetEmail({ to: user.email, name: user.name, code, expiresAt });
    } catch (error) {
      logger.error("Password reset email failed", { email: normalizedEmail, error: error.message });
      if (allowDebugReturn) {
        return { ok: true, debugCode: code, debugExpiresAt: expiresAt.toISOString() };
      }
    }

    return { ok: true };
  }

  // verify OTP and set new password
  async resetPasswordWithOtp(email, code, newPassword, { ip, deviceInfo } = {}) {
    if (!email || !code) {
      throw new Error('Email and code are required.');
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: { id: true }
    });
    if (!user) {
      throw new Error('Invalid email or code.');
    }

    await otpService.verifyOtp(user.id, 'password_reset', code, { ip, deviceInfo });

    const passwordValidation = this.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.error);
    }

    const newPasswordHash = await this.hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash }
    });

    logger.info("Password reset completed", { userId: user.id });
    return true;
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
  async registerUser(name, email, password, card) {
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

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } }
    });

    if (existingUser) {
      logger.warn('Registration failed - email already registered', { email });
      throw new Error('Email already registered.');
    }

    let stripeToken = null;
    if (card) {
      try {
        stripeToken = await paymentService.tokenizeCard(card);
      } catch (err) {
        logger.error('Card tokenization failed', { error: err.message });
        throw new Error('Payment information is invalid.');
      }
    }

    try {
      const passwordHash = await this.hashPassword(password);

      const userData = {
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
      };

      if (stripeToken) {
        userData.paymentMethods = {
          create: {
            provider: 'stripe',
            token: stripeToken.id,
            fingerprint: stripeToken.card?.fingerprint,
            brand: stripeToken.card?.brand,
            last4: stripeToken.card?.last4,
            expMonth: stripeToken.card?.exp_month,
            expYear: stripeToken.card?.exp_year,
            holderName: stripeToken.card?.name,
            billingPostalCode: stripeToken.card?.address_zip,
            isDefault: true
          }
        };
      }

      const user = await prisma.user.create({
        data: userData,
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          emailVerifiedAt: true,
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

      const policy = this.emailVerificationPolicy();
      if (!policy.emailAvailable && policy.requireEmail) {
        return { user, verificationRequired: true, verificationUnavailable: true };
      }

      try {
        const result = await otpService.generateOtp(user.id, 'email_verification');
        if (policy.emailAvailable) {
          await this.sendVerificationEmail({ to: user.email, name: user.name, code: result.code, expiresAt: result.expiresAt });
        }
        return {
          user,
          verificationRequired: true,
          debugCode: policy.emailAvailable ? undefined : result.code,
          debugExpiresAt: policy.emailAvailable ? undefined : result.expiresAt
        };
      } catch (error) {
        logger.error("Failed to start email verification", { email: normalizedEmail, error: error.message });
        return { user, verificationRequired: true };
      }
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
      // ADDED: Debug logging for 401 investigation
      console.log('[LOGIN] Attempt for:', normalizedEmail);

      // Find user
      const user = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          emailVerifiedAt: true,
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

      // ADDED: Debug logging for 401 investigation
      console.log('[LOGIN] User found:', !!user);
      console.log('[LOGIN] Is verified:', user?.emailVerified);
      console.log('[LOGIN] Is active (trial):', user?.trialActive);

      if (!user || !user.passwordHash) {
        logger.warn('Authentication failed - user not found', { email });
        throw new Error('Invalid email or password.');
      }

      // Verify password
      const passwordMatch = await this.comparePassword(password, user.passwordHash);
      // ADDED: Debug logging for 401 investigation
      console.log('[LOGIN] Password match:', passwordMatch);
      if (!passwordMatch) {
        logger.warn('Authentication failed - incorrect password', { email });
        throw new Error('Invalid email or password.');
      }

      if (normalizedEmail !== "demo@forex.app" && !user.emailVerified) {
        logger.warn("Authentication blocked - email not verified", { userId: user.id, email: normalizedEmail });
        throw new Error("Email verification required.");
      }

      // optional OTP on login
      const loginOtpRequired = process.env.LOGIN_OTP_REQUIRED === 'true';
      if (loginOtpRequired) {
        // issue a one‑time code and ask the client to verify it before issuing JWT
        const { code, expiresAt } = await otpService.generateOtp(user.id, 'login');
        await this.sendVerificationEmail({ to: user.email, name: user.name, code, expiresAt });
        // FIXED: only return debug code in non-production to prevent OTP bypass
        const allowDebug = process.env.NODE_ENV !== 'production';
        return {
          otpRequired: true,
          debugCode: allowDebug ? code : undefined,
          debugExpiresAt: allowDebug ? expiresAt : undefined,
        };
      }

      // Check trial status
      if (normalizedEmail !== 'demo@forex.app') {
        if (!user.trialActive) {
          logger.warn('Authentication failed - trial not activated', { userId: user.id, email: normalizedEmail });
          throw new Error('Free trial must be activated before login.');
        }

        if (this.isTrialExpired(user.trialStartedAt)) {
          await this.deactivateTrial(user.id);
          logger.warn('Authentication failed - trial expired', { userId: user.id, email: normalizedEmail });
          throw new Error(`Free trial has expired after ${FREE_TRIAL_DAYS} days. Please subscribe to continue.`);
        }
      }

      // Remove passwordHash from response
      const safeUser = { ...user };
      delete safeUser.passwordHash;

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
  async startTrial(email, password, card) {
    logger.info('Trial start attempt', { email });

    const normalizedEmail = email.trim().toLowerCase();
    const requiresCard = normalizedEmail !== 'demo@forex.app';

    if (
      requiresCard &&
      (!card ||
        !card.cardNumber ||
        !card.cardExpMonth ||
        !card.cardExpYear ||
        !card.cardCvc ||
        !card.name ||
        !card.billingPostalCode)
    ) {
      logger.warn('Trial start failed - missing card details', { email: normalizedEmail });
      throw new Error('Card details are required to start the free trial.');
    }

    try {
      const user = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          emailVerifiedAt: true,
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

      if (requiresCard && !user.emailVerified) {
        logger.warn("Trial start blocked - email not verified", { userId: user.id, email: normalizedEmail });
        throw new Error("Email verification required.");
      }

      // Enforce one-time 7-day free trial.
      if (requiresCard) {
        if (user.trialActive) {
          if (this.isTrialExpired(user.trialStartedAt)) {
            await this.deactivateTrial(user.id);
            logger.warn('Trial already used and expired', { userId: user.id, email: normalizedEmail });
            throw new Error(`Free trial already used. The ${FREE_TRIAL_DAYS}-day trial cannot be restarted.`);
          }
          logger.warn('Trial already active', { userId: user.id, email: normalizedEmail });
          throw new Error('Trial already active.');
        }

        if (user.trialStartedAt) {
          logger.warn('Trial already used', { userId: user.id, email: normalizedEmail });
          throw new Error(`Free trial already used. The ${FREE_TRIAL_DAYS}-day trial cannot be restarted.`);
        }
      }

      let stripeToken = null;
      let cardFingerprint = null;

      if (requiresCard) {
        try {
          stripeToken = await paymentService.tokenizeCard(card);
          cardFingerprint = stripeToken?.card?.fingerprint || null;
          if (!cardFingerprint) {
            throw new Error('Missing card fingerprint');
          }
        } catch (err) {
          logger.error('Card tokenization failed during trial start', { error: err.message });
          throw new Error('Payment information is invalid.');
        }

        const reusedTrialCard = await prisma.paymentMethod.findFirst({
          where: {
            fingerprint: cardFingerprint,
            userId: { not: user.id },
            user: {
              trialStartedAt: { not: null }
            }
          },
          select: { id: true, userId: true }
        });

        if (reusedTrialCard) {
          logger.warn('Trial blocked - card already used for trial', {
            userId: user.id,
            email: normalizedEmail,
            paymentMethodId: reusedTrialCard.id
          });
          throw new Error('This card has already been used to redeem a free trial.');
        }
      }

      const trialStartedAt = new Date();
      const updatedUser = await prisma.$transaction(async (tx) => {
        if (requiresCard && stripeToken && cardFingerprint) {
          const existingCard = await tx.paymentMethod.findFirst({
            where: {
              userId: user.id,
              fingerprint: cardFingerprint
            },
            select: { id: true }
          });

          if (!existingCard) {
            const hasDefaultCard = await tx.paymentMethod.findFirst({
              where: {
                userId: user.id,
                isDefault: true
              },
              select: { id: true }
            });

            await tx.paymentMethod.create({
              data: {
                userId: user.id,
                provider: 'stripe',
                token: stripeToken.id,
                fingerprint: cardFingerprint,
                brand: stripeToken.card?.brand,
                last4: stripeToken.card?.last4 || String(card.cardNumber).slice(-4),
                expMonth: stripeToken.card?.exp_month || card.cardExpMonth,
                expYear: stripeToken.card?.exp_year || card.cardExpYear,
                holderName: stripeToken.card?.name || card.name,
                billingPostalCode: stripeToken.card?.address_zip || card.billingPostalCode,
                isDefault: !hasDefaultCard
              }
            });
          }
        }

        return tx.user.update({
          where: { id: user.id },
          data: {
            trialActive: true,
            trialStartedAt
          },
          select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            emailVerifiedAt: true,
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

  // Get user by email (case-insensitive)
  async getUserByEmail(email) {
    try {
      const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          emailVerifiedAt: true,
          trialActive: true,
          trialStartedAt: true
        }
      });
      if (!user) {
        logger.warn('User not found by email', { email });
        return null;
      }
      return user;
    } catch (error) {
      logger.error('Failed to fetch user by email', { email, error: error.message });
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
          emailVerified: true,
          emailVerifiedAt: true,
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
