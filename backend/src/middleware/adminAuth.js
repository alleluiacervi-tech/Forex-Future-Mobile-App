import prisma from "../db/prisma.js";
import Logger from "../utils/logger.js";

const logger = new Logger("AdminAuth");

/**
 * Middleware: requires the authenticated user to be an active admin.
 * Must be placed after the `authenticate` middleware.
 */
export const requireAdmin = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isAdmin: true, suspendedAt: true, deletedAt: true },
    });

    if (!user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required." });
    }

    if (user.suspendedAt) {
      return res.status(403).json({ error: "Admin account is suspended." });
    }

    if (user.deletedAt) {
      return res.status(403).json({ error: "Admin account has been deleted." });
    }

    logger.debug("Admin access granted", { adminId: req.user.id, path: req.path });
    next();
  } catch (error) {
    logger.error("Admin check failed", { userId: req.user?.id, error: error?.message });
    return res.status(403).json({ error: "Admin access required." });
  }
};

/**
 * Create an immutable AdminAction audit log entry.
 */
export const logAdminAction = async ({ adminId, targetUserId, actionType, description, metadata, ipAddress }) => {
  try {
    await prisma.adminAction.create({
      data: {
        adminId,
        targetUserId: targetUserId || null,
        actionType,
        description,
        metadata: metadata || undefined,
        ipAddress: ipAddress || null,
      },
    });
    logger.debug("Admin action logged", { adminId, actionType, targetUserId });
  } catch (error) {
    logger.error("Failed to log admin action", { adminId, actionType, error: error?.message });
  }
};
