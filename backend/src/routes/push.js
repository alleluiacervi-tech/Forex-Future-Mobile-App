import express from "express";
import authenticate from "../middleware/auth.js";
import prisma from "../db/prisma.js";
import Logger from "../utils/logger.js";

const router = express.Router();
const logger = new Logger("PushRoutes");

const VALID_PLATFORMS = ["ios", "android", "web"];

// POST /api/push/register — register a push token
router.post("/register", authenticate, async (req, res) => {
  const { token, platform } = req.body;

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Push token is required." });
  }

  if (!platform || !VALID_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: `Platform must be one of: ${VALID_PLATFORMS.join(", ")}` });
  }

  const pushToken = await prisma.pushToken.upsert({
    where: { token },
    create: {
      userId: req.user.id,
      token,
      platform,
      active: true,
    },
    update: {
      userId: req.user.id,
      platform,
      active: true,
    },
  });

  logger.debug("Push token registered", { userId: req.user.id, platform });

  return res.success({ pushToken });
});

export default router;
