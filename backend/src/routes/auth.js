import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import config from "../config.js";
import prisma from "../db/prisma.js";
import authenticate from "../middleware/auth.js";
import { loginSchema, parseSchema, registerSchema } from "../utils/validators.js";

const router = express.Router();

const issueToken = (userId) =>
  jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

router.post("/register", async (req, res) => {
  const { data, error } = parseSchema(registerSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const { email, password, name } = data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already registered." });
  }

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
    include: {
      account: true,
      watchlist: true
    }
  });

  return res.status(201).json({ user, account: user.account, token: issueToken(user.id) });
});

router.post("/login", async (req, res) => {
  const { data, error } = parseSchema(loginSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const { email, password } = data;
  const user = await prisma.user.findUnique({
    where: { email },
    include: { account: true, watchlist: true }
  });

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  return res.json({ user, account: user.account, token: issueToken(user.id) });
});

router.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { account: true, watchlist: true }
  });

  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  return res.json({ user, account: user.account });
});

export default router;
