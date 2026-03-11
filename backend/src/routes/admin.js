import express from "express";
import authenticate from "../middleware/auth.js"; // ADDED: auth middleware for admin protection
import prisma from "../db/prisma.js"; // ADDED: for admin check
import { getRecentMarketAlerts } from "../services/marketRecorder.js";
import Logger from "../utils/logger.js";

const router = express.Router();
const logger = new Logger("AdminRoutes");

// ADDED: admin guard middleware — checks isAdmin flag from database
const requireAdmin = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isAdmin: true },
    });
    if (!user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required." });
    }
    next();
  } catch (error) {
    logger.error("Admin check failed", { userId: req.user?.id, error: error?.message });
    return res.status(403).json({ error: "Admin access required." });
  }
};

// return a single dashboard payload containing all data needed by the admin screen
router.get("/dashboard", authenticate, requireAdmin, async (req, res) => {
  try {
    // --- Real DB queries ---
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
      totalUsers,
      usersThisWeek,
      activeSubs,
      revenueThisMonth,
      revenueLastMonth,
      alertsToday,
      alertPairsToday,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
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
      {
        title: "Total Users",
        value: totalUsers.toLocaleString(),
        subtitle: `+${usersThisWeek} this week`,
        trend: usersThisWeek > 0 ? "up" : "neutral",
      },
      {
        title: "Active Subscribers",
        value: activeSubs.toLocaleString(),
        subtitle: `${conversionPct}% conversion`,
        trend: activeSubs > 0 ? "up" : "neutral",
      },
      {
        title: "Revenue This Month",
        value: `$${monthRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        subtitle: revenuePctChange >= 0 ? `+${revenuePctChange}% last month` : `${revenuePctChange}% last month`,
        trend: revenuePctChange >= 0 ? "up" : "down",
      },
      {
        title: "Alerts Today",
        value: alertsToday.toLocaleString(),
        subtitle: `${alertPairsToday.length} currency pairs`,
        trend: "neutral",
      },
    ];

    // Revenue chart — last 7 days of payment events
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

    // Bucket into days
    const dailyRevenue = last7Days.map((day) => {
      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);
      const total = revenueByDay
        .filter((r) => r.createdAt >= day && r.createdAt < nextDay)
        .reduce((sum, r) => sum + Number(r._sum.amount || 0), 0);
      return total;
    });

    const revenueData = {
      labels: dayLabels,
      datasets: [
        {
          data: dailyRevenue,
          color: () => "#4CAF50",
          strokeWidth: 2,
          name: "Daily Revenue",
        },
      ],
    };

    // Subscription breakdown pie chart
    const subsByPlan = await prisma.subscription.groupBy({
      by: ["plan"],
      where: { status: "active" },
      _count: true,
    });
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

    // Real users list
    const dbUsers = await prisma.user.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      select: {
        name: true,
        email: true,
        subscriptions: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { plan: true, status: true },
        },
      },
    });
    const users = dbUsers.map((u) => ({
      name: u.name,
      email: u.email,
      plan: u.subscriptions[0]?.plan || "None",
      status: u.subscriptions[0]?.status
        ? u.subscriptions[0].status.charAt(0).toUpperCase() + u.subscriptions[0].status.slice(1)
        : "No subscription",
    }));

    // Recent payment events as notifications
    const recentEvents = await prisma.paymentEvent.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
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

    // Real revenue metrics
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

    res.json({
      stats,
      revenueData,
      subscriptionPieData,
      alerts,
      ws,
      users,
      notifications,
      revenueMetrics,
    });
  } catch (err) {
    logger.error("Failed to build dashboard payload", { error: err?.message });
    res.status(500).json({ error: "Unable to build dashboard payload." });
  }
});

export default router;
