import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Expo } from "expo-server-sdk";
import authenticate from "../middleware/auth.js";
import { requireAdmin, logAdminAction } from "../middleware/adminAuth.js";
import prisma from "../db/prisma.js";
import { sendEmail } from "../services/email.js";
import { getRecentMarketAlerts } from "../services/marketRecorder.js";
import Logger from "../utils/logger.js";

const router = express.Router();
const logger = new Logger("AdminRoutes");
const expo = new Expo();

// All admin routes require authentication + admin check
router.use(authenticate, requireAdmin);

// ─── Helpers ────────────────────────────────────────────────────────────────

const clientIp = (req) => req.ip || req.connection?.remoteAddress || null;

const safeSendEmail = async (opts) => {
  try {
    await sendEmail(opts);
  } catch (err) {
    logger.warn("Admin email send failed (non-fatal)", { to: opts.to, error: err?.message });
  }
};

const parseIntParam = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// ─── Dashboard & Stats ──────────────────────────────────────────────────────

// GET /dashboard — original dashboard payload (kept for backwards compat)
router.get("/dashboard", async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [
      totalUsers, usersThisWeek, activeSubs,
      revenueThisMonth, revenueLastMonth,
      alertsToday, alertPairsToday,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { createdAt: { gte: startOfWeek }, deletedAt: null } }),
      prisma.subscription.count({ where: { status: "active" } }),
      prisma.paymentEvent.aggregate({
        where: { eventType: "PAYMENT.SALE.COMPLETED", createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      prisma.paymentEvent.aggregate({
        where: { eventType: "PAYMENT.SALE.COMPLETED", createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        _sum: { amount: true },
      }),
      prisma.marketAlert.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.marketAlert.groupBy({ by: ["pair"], where: { createdAt: { gte: startOfDay } } }),
    ]);

    const monthRevenue = Number(revenueThisMonth._sum.amount || 0);
    const lastMonthRevenue = Number(revenueLastMonth._sum.amount || 0);
    const revenuePctChange = lastMonthRevenue > 0
      ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : 0;
    const conversionPct = totalUsers > 0 ? Math.round((activeSubs / totalUsers) * 100) : 0;

    const stats = [
      { title: "Total Users", value: totalUsers.toLocaleString(), subtitle: `+${usersThisWeek} this week`, trend: usersThisWeek > 0 ? "up" : "neutral" },
      { title: "Active Subscribers", value: activeSubs.toLocaleString(), subtitle: `${conversionPct}% conversion`, trend: activeSubs > 0 ? "up" : "neutral" },
      { title: "Revenue This Month", value: `$${monthRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, subtitle: revenuePctChange >= 0 ? `+${revenuePctChange}% last month` : `${revenuePctChange}% last month`, trend: revenuePctChange >= 0 ? "up" : "down" },
      { title: "Alerts Today", value: alertsToday.toLocaleString(), subtitle: `${alertPairsToday.length} currency pairs`, trend: "neutral" },
    ];

    // Revenue chart — last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });
    const dayLabels = last7Days.map((d) => d.toLocaleDateString("en-US", { weekday: "short" }));

    const revenueByDay = await prisma.paymentEvent.groupBy({
      by: ["createdAt"],
      where: { eventType: "PAYMENT.SALE.COMPLETED", createdAt: { gte: last7Days[0] } },
      _sum: { amount: true },
    });

    const dailyRevenue = last7Days.map((day) => {
      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);
      return revenueByDay
        .filter((r) => r.createdAt >= day && r.createdAt < nextDay)
        .reduce((sum, r) => sum + Number(r._sum.amount || 0), 0);
    });

    const revenueData = {
      labels: dayLabels,
      datasets: [{ data: dailyRevenue, color: () => "#4CAF50", strokeWidth: 2, name: "Daily Revenue" }],
    };

    const subsByPlan = await prisma.subscription.groupBy({ by: ["plan"], where: { status: "active" }, _count: true });
    const planColors = { monthly: "#4CAF50", "3months": "#FFC107", annual: "#2196F3" };
    const subscriptionPieData = subsByPlan.map((s) => ({
      name: s.plan.charAt(0).toUpperCase() + s.plan.slice(1),
      population: s._count,
      color: planColors[s.plan] || "#9BB3BD",
    }));

    const alerts = await getRecentMarketAlerts({ limit: 6 });

    const ws = {
      provider: "FCS API",
      ticks: alertsToday,
      lastTick: new Date().toISOString(),
      uptime: "99.8%",
      reconnections: 0,
    };

    const dbUsers = await prisma.user.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      where: { deletedAt: null },
      select: {
        name: true, email: true,
        subscriptions: { take: 1, orderBy: { createdAt: "desc" }, select: { plan: true, status: true } },
      },
    });
    const users = dbUsers.map((u) => ({
      name: u.name, email: u.email,
      plan: u.subscriptions[0]?.plan || "None",
      status: u.subscriptions[0]?.status ? u.subscriptions[0].status.charAt(0).toUpperCase() + u.subscriptions[0].status.slice(1) : "No subscription",
    }));

    const recentEvents = await prisma.paymentEvent.findMany({
      take: 5, orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true } } },
    });
    const notifications = recentEvents.map((e) => {
      const mins = Math.round((now.getTime() - new Date(e.createdAt).getTime()) / 60000);
      const time = mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
      if (e.eventType === "PAYMENT.SALE.COMPLETED") {
        return { type: "accent", message: `Payment $${Number(e.amount || 0).toFixed(2)} — ${e.user?.email || "unknown"}`, time };
      }
      return { type: "info", message: `${e.eventType} — ${e.user?.email || "unknown"}`, time };
    });

    const [newSubsToday, cancelledToday] = await Promise.all([
      prisma.subscription.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.subscription.count({ where: { status: "cancelled", updatedAt: { gte: startOfDay } } }),
    ]);
    const totalSubsEver = await prisma.subscription.count();
    const churnRate = totalSubsEver > 0 ? ((cancelledToday / totalSubsEver) * 100).toFixed(1) : "0.0";
    const arr = monthRevenue * 12;

    const revenueMetrics = {
      newSubscribersToday: newSubsToday,
      cancelledToday,
      trialConversionsThisWeek: totalSubsEver > 0 ? `${Math.round((activeSubs / totalSubsEver) * 100)}%` : "0%",
      churnRate: `${churnRate}%`,
      mrr: `$${monthRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      arr: `$${arr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    };

    res.json({ stats, revenueData, subscriptionPieData, alerts, ws, users, notifications, revenueMetrics });
  } catch (err) {
    logger.error("Failed to build dashboard payload", { error: err?.message });
    res.status(500).json({ error: "Unable to build dashboard payload." });
  }
});

// GET /stats — comprehensive platform statistics
router.get("/stats", async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers, activeUsers, newUsersToday, newUsersWeek, suspendedUsers,
      totalSubs, activeSubs, trialSubs, expiredSubs, cancelledSubs, failedSubs,
      revenueToday, revenueMonth, revenueAllTime,
      alertsToday, alertsWeek, alertsTotal,
      totalNotifications,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { isActive: true, deletedAt: null } }),
      prisma.user.count({ where: { createdAt: { gte: startOfDay }, deletedAt: null } }),
      prisma.user.count({ where: { createdAt: { gte: startOfWeek }, deletedAt: null } }),
      prisma.user.count({ where: { suspendedAt: { not: null }, deletedAt: null } }),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: "active" } }),
      prisma.subscription.count({ where: { status: "trial" } }),
      prisma.subscription.count({ where: { status: "expired" } }),
      prisma.subscription.count({ where: { status: "cancelled" } }),
      prisma.subscription.count({ where: { status: "past_due" } }),
      prisma.paymentEvent.aggregate({ where: { eventType: "PAYMENT.SALE.COMPLETED", createdAt: { gte: startOfDay } }, _sum: { amount: true } }),
      prisma.paymentEvent.aggregate({ where: { eventType: "PAYMENT.SALE.COMPLETED", createdAt: { gte: startOfMonth } }, _sum: { amount: true } }),
      prisma.paymentEvent.aggregate({ where: { eventType: "PAYMENT.SALE.COMPLETED" }, _sum: { amount: true } }),
      prisma.marketAlert.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.marketAlert.count({ where: { createdAt: { gte: startOfWeek } } }),
      prisma.marketAlert.count(),
      prisma.notification.count(),
    ]);

    const monthRevenue = Number(revenueMonth._sum.amount || 0);
    const avgAlertsPerDay = alertsTotal > 0 ? Math.round(alertsTotal / Math.max(1, Math.ceil((now.getTime() - new Date("2024-01-01").getTime()) / 86400000))) : 0;

    res.json({
      users: { total: totalUsers, active: activeUsers, newToday: newUsersToday, newThisWeek: newUsersWeek, suspended: suspendedUsers },
      subscriptions: { total: totalSubs, active: activeSubs, trial: trialSubs, expired: expiredSubs, cancelled: cancelledSubs, failed: failedSubs },
      revenue: {
        today: Number(revenueToday._sum.amount || 0),
        month: monthRevenue,
        allTime: Number(revenueAllTime._sum.amount || 0),
        mrr: monthRevenue,
      },
      alerts: { today: alertsToday, week: alertsWeek, total: alertsTotal, avgPerDay: avgAlertsPerDay },
      notifications: { total: totalNotifications },
    });
  } catch (err) {
    logger.error("Failed to build stats", { error: err?.message });
    res.status(500).json({ error: "Unable to build stats." });
  }
});

// ─── User Management ────────────────────────────────────────────────────────

// GET /users — paginated user list with search, filter, sort
router.get("/users", async (req, res) => {
  try {
    const page = parseIntParam(req.query.page, 1);
    const limit = Math.min(parseIntParam(req.query.limit, 20), 100);
    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const filter = String(req.query.filter || "all").toLowerCase();
    const sortBy = String(req.query.sortBy || "createdAt");
    const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";
    const includeDeleted = req.query.includeDeleted === "true";

    const where = {};
    if (!includeDeleted) where.deletedAt = null;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    switch (filter) {
      case "active":
        where.isActive = true;
        where.suspendedAt = null;
        break;
      case "trial":
        where.trialActive = true;
        break;
      case "suspended":
        where.suspendedAt = { not: null };
        break;
      case "deleted":
        where.deletedAt = { not: null };
        break;
      case "admin":
        where.isAdmin = true;
        break;
    }

    const allowedSort = ["createdAt", "name", "email", "lastLogin"];
    const orderField = allowedSort.includes(sortBy) ? sortBy : "createdAt";

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderField]: sortOrder },
        select: {
          id: true, name: true, email: true, isActive: true, isAdmin: true,
          emailVerified: true, trialActive: true, trialStartedAt: true,
          lastLogin: true, createdAt: true,
          suspendedAt: true, suspendedReason: true, deletedAt: true, adminCreated: true,
          subscriptions: {
            take: 1, orderBy: { createdAt: "desc" },
            select: { plan: true, status: true, currentPeriodEnd: true, isFree: true, discountPercent: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const items = users.map((u) => {
      const sub = u.subscriptions[0] || null;
      let statusLabel = "No subscription";
      if (u.deletedAt) statusLabel = "Deleted";
      else if (u.suspendedAt) statusLabel = "Suspended";
      else if (sub?.status) statusLabel = sub.status.charAt(0).toUpperCase() + sub.status.slice(1);

      return {
        id: u.id, name: u.name, email: u.email,
        isActive: u.isActive, isAdmin: u.isAdmin, emailVerified: u.emailVerified,
        trialActive: u.trialActive, lastLogin: u.lastLogin, createdAt: u.createdAt,
        suspendedAt: u.suspendedAt, deletedAt: u.deletedAt, adminCreated: u.adminCreated,
        plan: sub?.plan || null, subStatus: sub?.status || null, statusLabel,
        isFree: sub?.isFree || false, discountPercent: sub?.discountPercent || null,
      };
    });

    res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error("Failed to list users", { error: err?.message });
    res.status(500).json({ error: "Unable to list users." });
  }
});

// GET /users/:id — full user detail
router.get("/users/:id", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, email: true, isActive: true, isAdmin: true,
        emailVerified: true, emailVerifiedAt: true, trialActive: true, trialStartedAt: true,
        lastLogin: true, createdAt: true, updatedAt: true, baseCurrency: true, riskLevel: true,
        suspendedAt: true, suspendedReason: true, suspendedBy: true,
        deletedAt: true, deletedBy: true, notes: true, adminCreated: true,
        subscriptions: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true, plan: true, status: true, amount: true, currentPeriodEnd: true,
            trialStart: true, trialEnd: true, gracePeriodEnd: true, cancelReason: true,
            discountPercent: true, discountReason: true, discountAppliedAt: true,
            isFree: true, overrideReason: true, trialExtendCount: true,
            createdAt: true, updatedAt: true,
          },
        },
        pushTokens: { where: { active: true }, select: { id: true, platform: true } },
      },
    });

    if (!user) return res.status(404).json({ error: "User not found." });

    // Fetch recent alerts delivered to this user
    const recentAlerts = await prisma.notification.findMany({
      where: { userId: user.id, type: "alert" },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, body: true, createdAt: true },
    });

    // Fetch admin actions on this user
    const adminActions = await prisma.adminAction.findMany({
      where: { targetUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, actionType: true, description: true, createdAt: true, adminId: true },
    });

    res.json({ user, recentAlerts, adminActions });
  } catch (err) {
    logger.error("Failed to get user detail", { error: err?.message, userId: req.params.id });
    res.status(500).json({ error: "Unable to get user details." });
  }
});

// POST /users/create — admin creates a user
router.post("/users/create", async (req, res) => {
  try {
    const { name, email, password, startTrial } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) return res.status(409).json({ error: "Email already in use." });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        isActive: true,
        adminCreated: true,
        trialActive: !!startTrial,
        trialStartedAt: startTrial ? new Date() : null,
      },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    await logAdminAction({
      adminId: req.user.id,
      targetUserId: user.id,
      actionType: "USER_CREATED",
      description: `Admin created user ${user.email}`,
      metadata: { startTrial: !!startTrial },
      ipAddress: clientIp(req),
    });

    safeSendEmail({
      to: user.email,
      subject: "Welcome to Forex Future",
      text: `Hello ${user.name},\n\nAn account has been created for you on Forex Future.\n\nEmail: ${user.email}\nPassword: ${password}\n\nPlease change your password after logging in.\n\nBest regards,\nForex Future Team`,
      html: `<p>Hello ${user.name},</p><p>An account has been created for you on Forex Future.</p><p><strong>Email:</strong> ${user.email}<br/><strong>Password:</strong> ${password}</p><p>Please change your password after logging in.</p><p>Best regards,<br/>Forex Future Team</p>`,
    });

    res.status(201).json({ success: true, user });
  } catch (err) {
    logger.error("Failed to create user", { error: err?.message });
    res.status(500).json({ error: "Unable to create user." });
  }
});

// PUT /users/:id — update user fields
router.put("/users/:id", async (req, res) => {
  try {
    const { name, email, baseCurrency, riskLevel } = req.body;
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (email !== undefined) data.email = email.toLowerCase().trim();
    if (baseCurrency !== undefined) data.baseCurrency = baseCurrency;
    if (riskLevel !== undefined) data.riskLevel = riskLevel;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No fields to update." });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true },
    });

    await logAdminAction({
      adminId: req.user.id,
      targetUserId: user.id,
      actionType: "USER_UPDATED",
      description: `Admin updated user ${user.email}`,
      metadata: { fields: Object.keys(data) },
      ipAddress: clientIp(req),
    });

    res.json({ success: true, user });
  } catch (err) {
    logger.error("Failed to update user", { error: err?.message });
    res.status(500).json({ error: "Unable to update user." });
  }
});

// POST /users/:id/suspend
router.post("/users/:id/suspend", async (req, res) => {
  try {
    const { reason } = req.body;
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "Cannot suspend yourself." });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { suspendedAt: new Date(), suspendedReason: reason || null, suspendedBy: req.user.id, isActive: false },
      select: { id: true, name: true, email: true },
    });

    await logAdminAction({
      adminId: req.user.id,
      targetUserId: user.id,
      actionType: "USER_SUSPENDED",
      description: `Admin suspended user ${user.email}. Reason: ${reason || "None"}`,
      ipAddress: clientIp(req),
    });

    safeSendEmail({
      to: user.email,
      subject: "Account Suspended - Forex Future",
      text: `Hello ${user.name},\n\nYour Forex Future account has been suspended.\n${reason ? `Reason: ${reason}\n` : ""}\nIf you believe this is an error, please contact support.\n\nForex Future Team`,
    });

    res.json({ success: true, message: `User ${user.email} suspended.` });
  } catch (err) {
    logger.error("Failed to suspend user", { error: err?.message });
    res.status(500).json({ error: "Unable to suspend user." });
  }
});

// POST /users/:id/unsuspend
router.post("/users/:id/unsuspend", async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { suspendedAt: null, suspendedReason: null, suspendedBy: null, isActive: true },
      select: { id: true, name: true, email: true },
    });

    await logAdminAction({
      adminId: req.user.id,
      targetUserId: user.id,
      actionType: "USER_UNSUSPENDED",
      description: `Admin unsuspended user ${user.email}`,
      ipAddress: clientIp(req),
    });

    safeSendEmail({
      to: user.email,
      subject: "Account Restored - Forex Future",
      text: `Hello ${user.name},\n\nYour Forex Future account has been restored. You can now log in again.\n\nForex Future Team`,
    });

    res.json({ success: true, message: `User ${user.email} unsuspended.` });
  } catch (err) {
    logger.error("Failed to unsuspend user", { error: err?.message });
    res.status(500).json({ error: "Unable to unsuspend user." });
  }
});

// DELETE /users/:id — soft delete
router.delete("/users/:id", async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "Cannot delete yourself." });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), deletedBy: req.user.id, isActive: false },
      select: { id: true, name: true, email: true },
    });

    await logAdminAction({
      adminId: req.user.id,
      targetUserId: user.id,
      actionType: "USER_DELETED",
      description: `Admin soft-deleted user ${user.email}`,
      ipAddress: clientIp(req),
    });

    safeSendEmail({
      to: user.email,
      subject: "Account Closed - Forex Future",
      text: `Hello ${user.name},\n\nYour Forex Future account has been closed. If you believe this is an error, please contact support.\n\nForex Future Team`,
    });

    res.json({ success: true, message: `User ${user.email} deleted.` });
  } catch (err) {
    logger.error("Failed to delete user", { error: err?.message });
    res.status(500).json({ error: "Unable to delete user." });
  }
});

// POST /users/:id/restore
router.post("/users/:id/restore", async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { deletedAt: null, deletedBy: null, isActive: true },
      select: { id: true, name: true, email: true },
    });

    await logAdminAction({
      adminId: req.user.id,
      targetUserId: user.id,
      actionType: "USER_RESTORED",
      description: `Admin restored user ${user.email}`,
      ipAddress: clientIp(req),
    });

    res.json({ success: true, message: `User ${user.email} restored.` });
  } catch (err) {
    logger.error("Failed to restore user", { error: err?.message });
    res.status(500).json({ error: "Unable to restore user." });
  }
});

// POST /users/:id/reset-password
router.post("/users/:id/reset-password", async (req, res) => {
  try {
    const tempPassword = crypto.randomBytes(6).toString("hex");
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash },
      select: { id: true, name: true, email: true },
    });

    await logAdminAction({
      adminId: req.user.id,
      targetUserId: user.id,
      actionType: "PASSWORD_RESET",
      description: `Admin reset password for ${user.email}`,
      ipAddress: clientIp(req),
    });

    safeSendEmail({
      to: user.email,
      subject: "Password Reset - Forex Future",
      text: `Hello ${user.name},\n\nYour password has been reset by an administrator.\n\nNew temporary password: ${tempPassword}\n\nPlease change it after logging in.\n\nForex Future Team`,
    });

    res.json({ success: true, message: `Password reset for ${user.email}. Temporary password emailed.` });
  } catch (err) {
    logger.error("Failed to reset password", { error: err?.message });
    res.status(500).json({ error: "Unable to reset password." });
  }
});

// PUT /users/:id/notes
router.put("/users/:id/notes", async (req, res) => {
  try {
    const { notes } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { notes: notes || null },
      select: { id: true, email: true, notes: true },
    });

    await logAdminAction({
      adminId: req.user.id,
      targetUserId: user.id,
      actionType: "NOTES_UPDATED",
      description: `Admin updated notes for ${user.email}`,
      ipAddress: clientIp(req),
    });

    res.json({ success: true, notes: user.notes });
  } catch (err) {
    logger.error("Failed to update notes", { error: err?.message });
    res.status(500).json({ error: "Unable to update notes." });
  }
});

// ─── Subscription Management ────────────────────────────────────────────────

// POST /users/:id/activate-trial
router.post("/users/:id/activate-trial", async (req, res) => {
  try {
    const { days, reason } = req.body;
    const trialDays = parseIntParam(days, 7);
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + trialDays);

    // Update user trial fields
    await prisma.user.update({
      where: { id: req.params.id },
      data: { trialActive: true, trialStartedAt: new Date() },
    });

    // Upsert subscription
    const existing = await prisma.subscription.findFirst({
      where: { userId: req.params.id },
      orderBy: { createdAt: "desc" },
    });

    let sub;
    if (existing) {
      sub = await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          status: "trial", trialStart: new Date(), trialEnd,
          trialExtendedBy: req.user.id, trialExtendedAt: new Date(),
          trialExtendCount: { increment: 1 },
        },
      });
    } else {
      sub = await prisma.subscription.create({
        data: {
          userId: req.params.id, plan: "monthly", status: "trial", amount: 0,
          trialStart: new Date(), trialEnd,
          trialExtendedBy: req.user.id, trialExtendedAt: new Date(),
          trialExtendCount: 1,
        },
      });
    }

    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { name: true, email: true } });

    await logAdminAction({
      adminId: req.user.id,
      targetUserId: req.params.id,
      actionType: "TRIAL_ACTIVATED",
      description: `Admin activated ${trialDays}-day trial for ${user?.email}. Reason: ${reason || "None"}`,
      metadata: { days: trialDays, reason },
      ipAddress: clientIp(req),
    });

    safeSendEmail({
      to: user?.email,
      subject: "Trial Extended - Forex Future",
      text: `Hello ${user?.name},\n\nYour trial has been extended by ${trialDays} days.\n${reason ? `Reason: ${reason}\n` : ""}\nEnjoy the app!\n\nForex Future Team`,
    });

    res.json({ success: true, subscription: sub });
  } catch (err) {
    logger.error("Failed to activate trial", { error: err?.message });
    res.status(500).json({ error: "Unable to activate trial." });
  }
});

// POST /users/:id/activate-subscription
router.post("/users/:id/activate-subscription", async (req, res) => {
  try {
    const { plan, months, reason } = req.body;
    const subPlan = plan || "monthly";
    const duration = parseIntParam(months, 1);
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + duration);

    const existing = await prisma.subscription.findFirst({
      where: { userId: req.params.id },
      orderBy: { createdAt: "desc" },
    });

    let sub;
    if (existing) {
      sub = await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          plan: subPlan, status: "active", amount: 0, currentPeriodEnd: periodEnd,
          isFree: true, overriddenBy: req.user.id, overrideReason: reason || "Admin granted",
        },
      });
    } else {
      sub = await prisma.subscription.create({
        data: {
          userId: req.params.id, plan: subPlan, status: "active", amount: 0,
          currentPeriodEnd: periodEnd, isFree: true,
          overriddenBy: req.user.id, overrideReason: reason || "Admin granted",
        },
      });
    }

    // Also activate trial flags so auth middleware doesn't block
    await prisma.user.update({
      where: { id: req.params.id },
      data: { trialActive: true, trialStartedAt: new Date() },
    });

    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { name: true, email: true } });

    await logAdminAction({
      adminId: req.user.id,
      targetUserId: req.params.id,
      actionType: "SUBSCRIPTION_ACTIVATED",
      description: `Admin activated ${subPlan} subscription for ${user?.email} (${duration} months). Reason: ${reason || "None"}`,
      metadata: { plan: subPlan, months: duration, reason },
      ipAddress: clientIp(req),
    });

    res.json({ success: true, subscription: sub });
  } catch (err) {
    logger.error("Failed to activate subscription", { error: err?.message });
    res.status(500).json({ error: "Unable to activate subscription." });
  }
});

// POST /users/:id/apply-discount
router.post("/users/:id/apply-discount", async (req, res) => {
  try {
    const { discountPercent, reason } = req.body;
    const pct = parseIntParam(discountPercent, 0);
    if (pct < 1 || pct > 100) return res.status(400).json({ error: "Discount must be 1-100%." });

    const sub = await prisma.subscription.findFirst({
      where: { userId: req.params.id },
      orderBy: { createdAt: "desc" },
    });
    if (!sub) return res.status(404).json({ error: "No subscription found for this user." });

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        discountPercent: pct, discountReason: reason || null,
        discountAppliedBy: req.user.id, discountAppliedAt: new Date(),
      },
    });

    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { name: true, email: true } });

    await logAdminAction({
      adminId: req.user.id,
      targetUserId: req.params.id,
      actionType: "DISCOUNT_APPLIED",
      description: `Admin applied ${pct}% discount for ${user?.email}. Reason: ${reason || "None"}`,
      metadata: { discountPercent: pct, reason },
      ipAddress: clientIp(req),
    });

    safeSendEmail({
      to: user?.email,
      subject: "Discount Applied - Forex Future",
      text: `Hello ${user?.name},\n\nA ${pct}% discount has been applied to your subscription.\n${reason ? `Reason: ${reason}\n` : ""}\nForex Future Team`,
    });

    res.json({ success: true, subscription: updated });
  } catch (err) {
    logger.error("Failed to apply discount", { error: err?.message });
    res.status(500).json({ error: "Unable to apply discount." });
  }
});

// POST /users/:id/remove-discount
router.post("/users/:id/remove-discount", async (req, res) => {
  try {
    const sub = await prisma.subscription.findFirst({
      where: { userId: req.params.id },
      orderBy: { createdAt: "desc" },
    });
    if (!sub) return res.status(404).json({ error: "No subscription found." });

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: { discountPercent: null, discountReason: null, discountAppliedBy: null, discountAppliedAt: null },
    });

    await logAdminAction({
      adminId: req.user.id,
      targetUserId: req.params.id,
      actionType: "DISCOUNT_REMOVED",
      description: `Admin removed discount for user ${req.params.id}`,
      ipAddress: clientIp(req),
    });

    res.json({ success: true, subscription: updated });
  } catch (err) {
    logger.error("Failed to remove discount", { error: err?.message });
    res.status(500).json({ error: "Unable to remove discount." });
  }
});

// POST /users/:id/cancel-subscription
router.post("/users/:id/cancel-subscription", async (req, res) => {
  try {
    const { reason } = req.body;
    const sub = await prisma.subscription.findFirst({
      where: { userId: req.params.id },
      orderBy: { createdAt: "desc" },
    });
    if (!sub) return res.status(404).json({ error: "No subscription found." });

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "cancelled", cancelReason: reason || "Cancelled by admin" },
    });

    await logAdminAction({
      adminId: req.user.id,
      targetUserId: req.params.id,
      actionType: "SUBSCRIPTION_CANCELLED",
      description: `Admin cancelled subscription for user ${req.params.id}. Reason: ${reason || "None"}`,
      metadata: { reason },
      ipAddress: clientIp(req),
    });

    res.json({ success: true, subscription: updated });
  } catch (err) {
    logger.error("Failed to cancel subscription", { error: err?.message });
    res.status(500).json({ error: "Unable to cancel subscription." });
  }
});

// POST /users/:id/grant-free-access
router.post("/users/:id/grant-free-access", async (req, res) => {
  try {
    const { reason } = req.body;
    const farFuture = new Date("2099-12-31T23:59:59.999Z");

    const existing = await prisma.subscription.findFirst({
      where: { userId: req.params.id },
      orderBy: { createdAt: "desc" },
    });

    let sub;
    if (existing) {
      sub = await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          status: "active", currentPeriodEnd: farFuture, isFree: true,
          overriddenBy: req.user.id, overrideReason: reason || "Admin granted free access",
        },
      });
    } else {
      sub = await prisma.subscription.create({
        data: {
          userId: req.params.id, plan: "annual", status: "active", amount: 0,
          currentPeriodEnd: farFuture, isFree: true,
          overriddenBy: req.user.id, overrideReason: reason || "Admin granted free access",
        },
      });
    }

    await prisma.user.update({
      where: { id: req.params.id },
      data: { trialActive: true, trialStartedAt: new Date() },
    });

    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { name: true, email: true } });

    await logAdminAction({
      adminId: req.user.id,
      targetUserId: req.params.id,
      actionType: "FREE_ACCESS_GRANTED",
      description: `Admin granted free access to ${user?.email}. Reason: ${reason || "None"}`,
      metadata: { reason },
      ipAddress: clientIp(req),
    });

    safeSendEmail({
      to: user?.email,
      subject: "Special Access Granted - Forex Future",
      text: `Hello ${user?.name},\n\nYou have been granted special free access to Forex Future.\n${reason ? `Reason: ${reason}\n` : ""}\nEnjoy the platform!\n\nForex Future Team`,
    });

    res.json({ success: true, subscription: sub });
  } catch (err) {
    logger.error("Failed to grant free access", { error: err?.message });
    res.status(500).json({ error: "Unable to grant free access." });
  }
});

// POST /users/:id/revoke-free-access
router.post("/users/:id/revoke-free-access", async (req, res) => {
  try {
    const sub = await prisma.subscription.findFirst({
      where: { userId: req.params.id, isFree: true },
      orderBy: { createdAt: "desc" },
    });
    if (!sub) return res.status(404).json({ error: "No free subscription found." });

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: { isFree: false, status: "expired", overriddenBy: null, overrideReason: null },
    });

    await logAdminAction({
      adminId: req.user.id,
      targetUserId: req.params.id,
      actionType: "FREE_ACCESS_REVOKED",
      description: `Admin revoked free access for user ${req.params.id}`,
      ipAddress: clientIp(req),
    });

    res.json({ success: true, subscription: updated });
  } catch (err) {
    logger.error("Failed to revoke free access", { error: err?.message });
    res.status(500).json({ error: "Unable to revoke free access." });
  }
});

// ─── Alerts & Audit ─────────────────────────────────────────────────────────

// GET /alerts — paginated market alerts
router.get("/alerts", async (req, res) => {
  try {
    const page = parseIntParam(req.query.page, 1);
    const limit = Math.min(parseIntParam(req.query.limit, 20), 100);
    const skip = (page - 1) * limit;
    const pair = req.query.pair;
    const severity = req.query.severity;

    const where = {};
    if (pair) where.pair = pair;
    if (severity) where.severity = severity;

    const [items, total] = await Promise.all([
      prisma.marketAlert.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      prisma.marketAlert.count({ where }),
    ]);

    res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error("Failed to list alerts", { error: err?.message });
    res.status(500).json({ error: "Unable to list alerts." });
  }
});

// GET /alerts/stats — alert performance
router.get("/alerts/stats", async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);

    const [todayCount, weekCount, totalCount, bySeverity, byPair, outcomes] = await Promise.all([
      prisma.marketAlert.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.marketAlert.count({ where: { createdAt: { gte: startOfWeek } } }),
      prisma.marketAlert.count(),
      prisma.marketAlert.groupBy({ by: ["severity"], _count: true, orderBy: { _count: { severity: "desc" } } }),
      prisma.marketAlert.groupBy({ by: ["pair"], _count: true, orderBy: { _count: { pair: "desc" } }, take: 10 }),
      prisma.alertOutcome.groupBy({ by: ["outcome"], _count: true }),
    ]);

    res.json({
      today: todayCount, week: weekCount, total: totalCount,
      bySeverity: bySeverity.map((s) => ({ severity: s.severity, count: s._count })),
      byPair: byPair.map((p) => ({ pair: p.pair, count: p._count })),
      outcomes: outcomes.map((o) => ({ outcome: o.outcome, count: o._count })),
    });
  } catch (err) {
    logger.error("Failed to get alert stats", { error: err?.message });
    res.status(500).json({ error: "Unable to get alert stats." });
  }
});

// GET /audit-log — immutable admin action log
router.get("/audit-log", async (req, res) => {
  try {
    const page = parseIntParam(req.query.page, 1);
    const limit = Math.min(parseIntParam(req.query.limit, 20), 100);
    const skip = (page - 1) * limit;
    const actionType = req.query.actionType;

    const where = {};
    if (actionType) where.actionType = actionType;

    const [items, total] = await Promise.all([
      prisma.adminAction.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: "desc" },
        include: { admin: { select: { name: true, email: true } } },
      }),
      prisma.adminAction.count({ where }),
    ]);

    res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error("Failed to list audit log", { error: err?.message });
    res.status(500).json({ error: "Unable to list audit log." });
  }
});

// ─── Platform Controls ──────────────────────────────────────────────────────

// POST /broadcast-notification — push notification to all/filtered users
router.post("/broadcast-notification", async (req, res) => {
  try {
    const { title, body, targetGroup } = req.body;
    if (!title || !body) return res.status(400).json({ error: "Title and body are required." });

    const tokenWhere = { active: true };
    if (targetGroup === "trial") {
      tokenWhere.user = { trialActive: true, subscriptions: { none: { status: "active" } } };
    } else if (targetGroup === "active") {
      tokenWhere.user = { subscriptions: { some: { status: "active" } } };
    } else if (targetGroup === "expired") {
      tokenWhere.user = { trialActive: false };
    }

    const tokens = await prisma.pushToken.findMany({
      where: tokenWhere,
      select: { token: true, userId: true },
    });

    const messages = [];
    for (const { token, userId } of tokens) {
      if (!Expo.isExpoPushToken(token)) continue;
      messages.push({
        to: token,
        sound: "default",
        title,
        body,
        data: { type: "broadcast" },
        _userId: userId,
      });
    }

    let sentCount = 0;
    if (messages.length > 0) {
      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
          sentCount += chunk.length;
        } catch (err) {
          logger.error("Broadcast push chunk failed", { error: err?.message });
        }
      }

      // Create notification records
      const uniqueUserIds = [...new Set(tokens.map((t) => t.userId))];
      const notifData = uniqueUserIds.map((userId) => ({
        userId, title, body, type: "system",
      }));
      await prisma.notification.createMany({ data: notifData }).catch(() => {});
    }

    await logAdminAction({
      adminId: req.user.id,
      actionType: "BROADCAST_NOTIFICATION",
      description: `Admin sent broadcast notification to ${sentCount} devices. Title: ${title}`,
      metadata: { title, targetGroup: targetGroup || "all", sentCount },
      ipAddress: clientIp(req),
    });

    res.json({ success: true, sentCount, totalTokens: tokens.length });
  } catch (err) {
    logger.error("Failed to broadcast notification", { error: err?.message });
    res.status(500).json({ error: "Unable to broadcast notification." });
  }
});

// POST /broadcast-email — send email to all/filtered users
router.post("/broadcast-email", async (req, res) => {
  try {
    const { subject, body, targetGroup } = req.body;
    if (!subject || !body) return res.status(400).json({ error: "Subject and body are required." });

    const userWhere = { deletedAt: null, isActive: true };
    if (targetGroup === "trial") {
      userWhere.trialActive = true;
    } else if (targetGroup === "active") {
      userWhere.subscriptions = { some: { status: "active" } };
    } else if (targetGroup === "expired") {
      userWhere.trialActive = false;
    }

    const users = await prisma.user.findMany({
      where: userWhere,
      select: { email: true, name: true },
    });

    let sentCount = 0;
    for (const user of users) {
      try {
        await sendEmail({
          to: user.email,
          subject,
          text: `Hello ${user.name},\n\n${body}\n\nForex Future Team`,
          html: `<p>Hello ${user.name},</p><p>${body.replace(/\n/g, "<br/>")}</p><p>Forex Future Team</p>`,
        });
        sentCount++;
      } catch (err) {
        logger.warn("Broadcast email failed for user", { email: user.email, error: err?.message });
      }
    }

    await logAdminAction({
      adminId: req.user.id,
      actionType: "BROADCAST_EMAIL",
      description: `Admin sent broadcast email to ${sentCount}/${users.length} users. Subject: ${subject}`,
      metadata: { subject, targetGroup: targetGroup || "all", sentCount, totalUsers: users.length },
      ipAddress: clientIp(req),
    });

    res.json({ success: true, sentCount, totalUsers: users.length });
  } catch (err) {
    logger.error("Failed to broadcast email", { error: err?.message });
    res.status(500).json({ error: "Unable to broadcast email." });
  }
});

// GET /system-health — server, DB, push, market health
router.get("/system-health", async (req, res) => {
  try {
    const uptime = process.uptime();
    const mem = process.memoryUsage();

    // DB health check
    let dbConnected = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
    } catch { /* db is down */ }

    const [totalTokens, activeTokens] = await Promise.all([
      prisma.pushToken.count(),
      prisma.pushToken.count({ where: { active: true } }),
    ]);

    res.json({
      server: {
        uptime: Math.floor(uptime),
        uptimeFormatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        nodeVersion: process.version,
        memoryMB: {
          rss: Math.round(mem.rss / 1048576),
          heapUsed: Math.round(mem.heapUsed / 1048576),
          heapTotal: Math.round(mem.heapTotal / 1048576),
        },
        env: process.env.NODE_ENV || "development",
      },
      database: { connected: dbConnected },
      push: { totalTokens, activeTokens, inactiveTokens: totalTokens - activeTokens },
      market: { provider: "FCS API" },
    });
  } catch (err) {
    logger.error("Failed to get system health", { error: err?.message });
    res.status(500).json({ error: "Unable to get system health." });
  }
});

export default router;
