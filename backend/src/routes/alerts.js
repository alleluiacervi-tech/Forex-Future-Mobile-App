import express from "express";
import authenticate from "../middleware/auth.js";
import prisma from "../db/prisma.js";
import Logger from "../utils/logger.js";

const router = express.Router();
const logger = new Logger("AlertRoutes");

// GET /api/alerts — paginated user alerts
router.get("/", authenticate, async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const [userAlerts, total] = await Promise.all([
    prisma.userAlert.findMany({
      where: { userId },
      include: { alert: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.userAlert.count({ where: { userId } }),
  ]);

  logger.debug("Fetched user alerts", { userId, page, limit, total });

  return res.success(
    { alerts: userAlerts, total, page, limit, pages: Math.ceil(total / limit) }
  );
});

// GET /api/alerts/recent — last 5 alerts
router.get("/recent", authenticate, async (req, res) => {
  const userAlerts = await prisma.userAlert.findMany({
    where: { userId: req.user.id },
    include: { alert: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return res.success({ alerts: userAlerts });
});

// GET /api/alerts/:id — single alert detail
router.get("/:id", authenticate, async (req, res) => {
  const userAlert = await prisma.userAlert.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: { alert: true },
  });

  if (!userAlert) {
    return res.status(404).json({ error: "Alert not found." });
  }

  return res.success({ alert: userAlert });
});

// POST /api/alerts/:id/read — mark alert as read (disable)
router.post("/:id/read", authenticate, async (req, res) => {
  const userAlert = await prisma.userAlert.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });

  if (!userAlert) {
    return res.status(404).json({ error: "Alert not found." });
  }

  await prisma.userAlert.update({
    where: { id: userAlert.id },
    data: { enabled: false },
  });

  return res.success({ id: userAlert.id, enabled: false });
});

export default router;
