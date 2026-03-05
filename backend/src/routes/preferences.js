import express from "express";
import authenticate from "../middleware/auth.js";
import prisma from "../db/prisma.js";
import Logger from "../utils/logger.js";

const router = express.Router();
const logger = new Logger("PreferenceRoutes");

const ALLOWED_FIELDS = [
  "baseCurrency",
  "riskLevel",
  "notifications",
  "emailAlerts",
  "pushAlerts",
  "theme",
  "language",
];

// GET /api/preferences — get user preferences (create defaults if none)
router.get("/", authenticate, async (req, res) => {
  const userId = req.user.id;

  let preferences = await prisma.userPreference.findUnique({
    where: { userId },
  });

  if (!preferences) {
    preferences = await prisma.userPreference.create({
      data: { userId },
    });
    logger.debug("Created default preferences", { userId });
  }

  return res.success({ preferences });
});

// PUT /api/preferences — update user preferences
router.put("/", authenticate, async (req, res) => {
  const userId = req.user.id;
  const updates = {};

  for (const field of ALLOWED_FIELDS) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid fields to update." });
  }

  const preferences = await prisma.userPreference.upsert({
    where: { userId },
    create: { userId, ...updates },
    update: updates,
  });

  logger.debug("Updated preferences", { userId, fields: Object.keys(updates) });

  return res.success({ preferences });
});

export default router;
