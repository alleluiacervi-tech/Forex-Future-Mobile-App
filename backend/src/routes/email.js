import express from "express";
import { z } from "zod";
import {
  getEmailConfigPublic,
  sendEmail,
  validateEmailConfig,
  verifyEmailTransport
} from "../services/email.js";

const router = express.Router();

const tokenSchema = z.object({
  token: z.string().min(8)
});

const emailTestSchema = z.object({
  to: z.string().email().optional()
});

const requireValidationToken = (req, res, next) => {
  const configured = process.env.EMAIL_VALIDATION_TOKEN;
  if (!configured) {
    // Hide the endpoint unless explicitly enabled.
    return res.status(404).json({ error: "Not found." });
  }

  const provided = req.header("x-email-validation-token");
  const { data } = tokenSchema.safeParse({ token: provided || "" });
  if (!data || data.token !== configured) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  return next();
};

router.use(requireValidationToken);

router.get("/config", (req, res) => {
  return res.json({
    config: getEmailConfigPublic(),
    validation: validateEmailConfig()
  });
});

router.post("/validate", async (req, res) => {
  const validation = validateEmailConfig();
  if (!validation.ok) {
    return res.status(400).json(validation);
  }

  try {
    await verifyEmailTransport();
    return res.json({ ok: true, ...validation });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      errors: [error?.message || "SMTP verification failed."],
      warnings: validation.warnings,
      config: validation.config
    });
  }
});

router.post("/send-test", async (req, res) => {
  const { data, error } = (() => {
    const parsed = emailTestSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join(", ") };
    }
    return { data: parsed.data };
  })();

  if (error) {
    return res.status(400).json({ error });
  }

  const cfg = getEmailConfigPublic();
  const defaultRecipient = process.env.EMAIL_TEST_RECIPIENT || cfg.user || "";
  const to = String(data?.to || defaultRecipient || "").trim();

  if (!to) {
    return res.status(400).json({ error: "Missing recipient. Set EMAIL_TEST_RECIPIENT or provide { to }." });
  }

  const allowAny = process.env.EMAIL_ALLOW_TEST_TO_ANY === "true";
  if (!allowAny && cfg.user && to.toLowerCase() !== cfg.user.toLowerCase()) {
    return res.status(403).json({
      error: "Recipient not allowed. Omit { to } or set EMAIL_ALLOW_TEST_TO_ANY=true for arbitrary recipients."
    });
  }

  try {
    const info = await sendEmail({
      to,
      subject: "Forex App: Email validation test",
      text: `Email validation test succeeded.\n\nTimestamp: ${new Date().toISOString()}\nRecipient: ${to}\n`,
      html: `<p>Email validation test succeeded.</p><p><strong>Timestamp:</strong> ${new Date().toISOString()}</p><p><strong>Recipient:</strong> ${to}</p>`
    });
    return res.json({ ok: true, to, info });
  } catch (error) {
    return res.status(502).json({ error: error?.message || "Failed to send test email." });
  }
});

export default router;

