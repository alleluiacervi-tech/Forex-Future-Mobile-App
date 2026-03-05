import express from "express";
import authenticate from "../middleware/auth.js";
import prisma from "../db/prisma.js";
import Logger from "../utils/logger.js";

const router = express.Router();
const logger = new Logger("NotificationRoutes");

// GET /api/notifications — paginated user notifications
router.get("/", authenticate, async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);

  logger.debug("Fetched notifications", { userId, page, limit, total });

  return res.success(
    { notifications, total, page, limit, pages: Math.ceil(total / limit) }
  );
});

// GET /api/notifications/unread-count
router.get("/unread-count", authenticate, async (req, res) => {
  const count = await prisma.notification.count({
    where: { userId: req.user.id, read: false },
  });

  return res.success({ count });
});

// PUT /api/notifications/read-all — mark all notifications as read
router.put("/read-all", authenticate, async (req, res) => {
  const { count } = await prisma.notification.updateMany({
    where: { userId: req.user.id, read: false },
    data: { read: true },
  });

  logger.debug("Marked all notifications read", { userId: req.user.id, count });

  return res.success({ updated: count });
});

// PUT /api/notifications/:id/read — mark single notification as read
router.put("/:id/read", authenticate, async (req, res) => {
  const notification = await prisma.notification.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });

  if (!notification) {
    return res.status(404).json({ error: "Notification not found." });
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { read: true },
  });

  return res.success({ id: notification.id, read: true });
});

export default router;
