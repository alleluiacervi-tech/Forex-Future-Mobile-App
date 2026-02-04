import nodemailer from "nodemailer";
import Logger from "../utils/logger.js";

const logger = new Logger("EmailService");

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));

const normalizeAppPassword = (value) => String(value || "").replace(/\s+/g, "");

const parseBoolean = (value, defaultValue) => {
  if (typeof value !== "string") return defaultValue;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return defaultValue;
};

const readEmailEnv = () => {
  const user = String(process.env.EMAIL_USER || "").trim();
  const appPassword = normalizeAppPassword(process.env.EMAIL_APP_PASSWORD);
  const from = String(process.env.EMAIL_FROM || user).trim();

  const host = String(process.env.EMAIL_SMTP_HOST || "smtp.gmail.com").trim();
  const portRaw = process.env.EMAIL_SMTP_PORT;
  const port = Number.isFinite(Number(portRaw)) ? Number(portRaw) : 465;
  const secure = parseBoolean(process.env.EMAIL_SMTP_SECURE, port === 465);

  return {
    user,
    appPassword,
    from,
    host,
    port,
    secure,
    enabled: Boolean(user && appPassword)
  };
};

const getEmailConfigPublic = () => {
  const cfg = readEmailEnv();
  return {
    enabled: cfg.enabled,
    user: cfg.user || null,
    from: cfg.from || null,
    host: cfg.host || null,
    port: cfg.port,
    secure: cfg.secure
  };
};

const validateEmailConfig = () => {
  const cfg = readEmailEnv();
  const errors = [];
  const warnings = [];

  if (!cfg.user) errors.push("Missing EMAIL_USER.");
  if (!cfg.appPassword) errors.push("Missing EMAIL_APP_PASSWORD.");
  if (cfg.user && !isEmail(cfg.user)) errors.push("EMAIL_USER must be a valid email address.");
  if (cfg.from && !isEmail(cfg.from)) errors.push("EMAIL_FROM must be a valid email address.");
  if (!cfg.host) errors.push("Missing EMAIL_SMTP_HOST.");
  if (!Number.isFinite(cfg.port) || cfg.port <= 0) errors.push("EMAIL_SMTP_PORT must be a positive number.");

  if (cfg.appPassword) {
    if (cfg.appPassword.length < 12) warnings.push("EMAIL_APP_PASSWORD looks short (double-check your app password).");
    if (cfg.appPassword.length === 16 && /^[a-z0-9]+$/i.test(cfg.appPassword)) {
      warnings.push("EMAIL_APP_PASSWORD matches common 16-char app-password format.");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    config: getEmailConfigPublic()
  };
};

let transporterSingleton = null;

const getTransporter = () => {
  if (transporterSingleton) return transporterSingleton;

  const cfg = readEmailEnv();
  const validation = validateEmailConfig();
  if (!validation.ok) {
    throw new Error(`Email not configured: ${validation.errors.join(" ")}`);
  }

  transporterSingleton = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.appPassword
    }
  });

  return transporterSingleton;
};

const verifyEmailTransport = async () => {
  const transport = getTransporter();
  await transport.verify();
  return true;
};

const sendEmail = async ({ to, subject, text, html }) => {
  const cfg = readEmailEnv();
  const transport = getTransporter();

  const info = await transport.sendMail({
    from: cfg.from,
    to,
    subject,
    text,
    html
  });

  return {
    messageId: info?.messageId || null,
    accepted: Array.isArray(info?.accepted) ? info.accepted : [],
    rejected: Array.isArray(info?.rejected) ? info.rejected : []
  };
};

const logEmailConfigStatus = () => {
  const validation = validateEmailConfig();
  if (validation.ok) {
    logger.info("Email SMTP configured.", {
      host: validation.config.host,
      port: validation.config.port,
      secure: validation.config.secure,
      user: validation.config.user
    });
    if (validation.warnings.length > 0) {
      logger.warn("Email SMTP config warnings.", { warnings: validation.warnings });
    }
    return;
  }

  // Only warn if the user looks like they're trying to enable email.
  const cfg = readEmailEnv();
  if (cfg.user || cfg.appPassword || process.env.EMAIL_VALIDATION_TOKEN) {
    logger.warn("Email SMTP not configured.", { errors: validation.errors });
  }
};

export {
  getEmailConfigPublic,
  logEmailConfigStatus,
  sendEmail,
  validateEmailConfig,
  verifyEmailTransport
};

