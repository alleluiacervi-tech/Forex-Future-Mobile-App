import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import config from '../config.js';
import prisma from '../db/prisma.js';
import Logger from '../utils/logger.js';
import { sendEmail, validateEmailConfig } from "./email.js";

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

const hashToken = (value) =>
  crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");

const randomSixDigitCode = () => String(Math.floor(100000 + Math.random() * 900000));

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

  async issueAndStoreEmailVerificationCode(userId) {
    const code = randomSixDigitCode();
    const expiresMinutes = Number(process.env.EMAIL_VERIFICATION_EXPIRES_MIN || 10);
    const expiresAt = new Date(Date.now() + (Number.isFinite(expiresMinutes) ? expiresMinutes : 10) * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationCodeHash: hashToken(code),
        emailVerificationExpiresAt: expiresAt,
        emailVerificationSentAt: new Date(),
        emailVerified: false,
        emailVerifiedAt: null
      },
      select: { id: true }
    });

    return { code, expiresAt };
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

    const { code, expiresAt } = await this.issueAndStoreEmailVerificationCode(user.id);

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

  async verifyEmailCode(email, code) {
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
      select: {
        id: true,
        emailVerified: true,
        emailVerificationCodeHash: true,
        emailVerificationExpiresAt: true
      }
    });

    if (!user) {
      throw new Error("Invalid verification code.");
    }
    if (user.emailVerified) {
      return { ok: true, alreadyVerified: true };
    }

    const expiresAtMs = user.emailVerificationExpiresAt ? user.emailVerificationExpiresAt.getTime() : 0;
    if (!expiresAtMs || Date.now() > expiresAtMs) {
      throw new Error("Verification code expired. Please request a new code.");
    }

    const expected = String(user.emailVerificationCodeHash || "");
    if (!expected || hashToken(submitted) !== expected) {
      throw new Error("Invalid verification code.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationCodeHash: null,
        emailVerificationExpiresAt: null
      },
      select: { id: true }
    });

    return { ok: true };
  }

  async requestPasswordReset(email, { ip } = {}) {
    logger.info("Password reset requested", { email, ip });

    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !this.validateEmail(normalizedEmail)) {
      // Keep message generic to avoid enumeration.
      return { ok: true };
    }

    const emailValidation = validateEmailConfig();
    const emailAvailable = emailValidation.ok;
    const allowDebugReturn =
      process.env.NODE_ENV !== "production" &&
      process.env.PASSWORD_RESET_DEBUG_RETURN_TOKEN !== "false";
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

    const token = this.issuePasswordResetToken(user);
    const link = this.buildPasswordResetLink(token);

    if (!emailAvailable) {
      if (allowDebugReturn) {
        return { ok: true, debugToken: token, debugLink: link };
      }
      return { ok: true };
    }

    try {
      const brandName = String(process.env.EMAIL_BRAND_NAME || "Forex Future").trim() || "Forex Future";
      const greeting = user.name ? `Hi ${user.name},` : "Hi,";
      const safeGreeting = escapeHtml(greeting);
      const safeBrand = escapeHtml(brandName);
      const safeLink = link ? escapeHtml(link) : "";
      const safeToken = escapeHtml(token);

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
        `We received a request to reset your ${brandName} password.`,
        "",
        link ? `Reset link: ${link}` : `Reset token: ${token}`,
        "",
        "Do not share this token with anyone.",
        "If you didn't request this, you can safely ignore this email."
      ];

      await sendEmail({
        to: user.email,
        subject: `${brandName} password reset`,
        text: lines.join("\n"),
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
            <div style="padding: 0 0 12px 0; text-align: center;">
              ${
                logoPath
                  ? `<img src="cid:${EMAIL_LOGO_CID}" width="72" height="72" alt="${safeBrand} logo" style="display:inline-block; width:72px; height:72px; border-radius: 16px;" />`
                  : `<div style="font-weight: 800; font-size: 20px; letter-spacing: 0.5px;">${safeBrand}</div>`
              }
            </div>
            <p>${safeGreeting}</p>
            <p>We received a request to reset your ${safeBrand} password.</p>
            ${
              link
                ? `<p><a href="${safeLink}">Reset your password</a></p>`
                : `<p><strong>Reset token:</strong> <code>${safeToken}</code></p>`
            }
            <p>Do not share this token with anyone.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
        attachments
      });
    } catch (error) {
      logger.error("Password reset email failed", { email: normalizedEmail, error: error.message });
      if (allowDebugReturn) {
        return { ok: true, debugToken: token, debugLink: link };
      }
    }

    return { ok: true };
  }

  async resetPasswordWithToken(token, newPassword) {
    const { userId } = await this.verifyPasswordResetToken(token);

    const passwordValidation = this.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.error);
    }

    const newPasswordHash = await this.hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    });

    logger.info("Password reset completed", { userId });
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
        const result = await this.requestEmailVerification(normalizedEmail);
        return {
          user,
          verificationRequired: true,
          debugCode: result?.debugCode,
          debugExpiresAt: result?.debugExpiresAt
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

      if (normalizedEmail !== "demo@forex.app" && !user.emailVerified) {
        logger.warn("Authentication blocked - email not verified", { userId: user.id, email: normalizedEmail });
        throw new Error("Email verification required.");
      }

      // Check trial status
      if (email.toLowerCase() !== 'demo@forex.app' && !user.trialActive) {
        logger.warn('Authentication failed - trial not activated', { userId: user.id, email });
        throw new Error('Free trial must be activated before login.');
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

      if (normalizedEmail !== "demo@forex.app" && !user.emailVerified) {
        logger.warn("Trial start blocked - email not verified", { userId: user.id, email: normalizedEmail });
        throw new Error("Email verification required.");
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
