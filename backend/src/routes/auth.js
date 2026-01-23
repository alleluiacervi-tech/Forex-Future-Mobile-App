import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import config from "../config.js";
import prisma from "../db/prisma.js";
import authenticate from "../middleware/auth.js";
import {
  loginSchema,
  parseSchema,
  registerSchema,
  trialStartSchema
} from "../utils/validators.js";

const router = express.Router();

const issueToken = (userId) =>
  jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

const userSelect = {
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
};

const normalizeEmail = (email) => email.trim().toLowerCase();
const normalizeName = (name) => name.trim();
const DEMO_EMAIL = "demo@forex.app";

router.post("/register", async (req, res) => {
  const { data, error } = parseSchema(registerSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const email = normalizeEmail(data.email);
  const name = normalizeName(data.name);
  const { password } = data;
  if (name.length < 2) {
    return res.status(400).json({ error: "Name must be at least 2 characters." });
  }

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } }
  });
  if (existing) {
    return res.status(409).json({ error: "Email already registered." });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        account: {
          create: {
            balance: 100000,
            equity: 100000,
            marginUsed: 0,
            currency: "USD"
          }
        },
        watchlist: {
          create: {
            pairs: ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD"]
          }
        }
      },
      select: userSelect
    });

    return res.status(201).json({
      user,
      account: user.account,
      trialRequired: true
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({ error: "Email already registered." });
    }
    return res.status(500).json({ error: "Registration failed." });
  }
});

router.post("/login", async (req, res) => {
  const { data, error } = parseSchema(loginSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const email = normalizeEmail(data.email);
  const { password } = data;
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { ...userSelect, passwordHash: true }
  });

  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  if (user.email.toLowerCase() !== DEMO_EMAIL && !user.trialActive) {
    return res.status(403).json({ error: "Free trial must be activated before login." });
  }

  const { passwordHash: _passwordHash, ...safeUser } = user;
  return res.json({
    user: safeUser,
    account: updatedUser.account,
    token: issueToken(updatedUser.id)
  });
});

router.post("/trial/start", async (req, res) => {
  const { data, error } = parseSchema(trialStartSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const email = normalizeEmail(data.email);
  const { password } = data;
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { ...userSelect, passwordHash: true }
  });

  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  let updatedUser = user;
  if (user.email.toLowerCase() !== DEMO_EMAIL && !user.trialActive) {
    updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { trialActive: true, trialStartedAt: new Date() },
      select: { ...userSelect, passwordHash: true }
    });
  }

  const { passwordHash: _passwordHash, ...safeUser } = updatedUser;
  return res.json({ user: safeUser, account: user.account, token: issueToken(user.id) });
});

router.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: userSelect
  });

  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  return res.json({ user, account: user.account });
});

export default router;
