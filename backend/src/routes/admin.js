import express from "express";
import { getRecentMarketAlerts } from "../services/marketRecorder.js";

const router = express.Router();

// return a single dashboard payload containing all data needed by the admin screen
router.get("/dashboard", async (req, res) => {
  try {
    // static data that mirrors what the front end currently hardcodes
    const stats = [
      {
        title: "Total Users",
        value: "1,240",
        subtitle: "+28 this week",
        trend: "up",
      },
      {
        title: "Active Subscribers",
        value: "847",
        subtitle: "68% conversion",
        trend: "up",
      },
      {
        title: "Revenue This Month",
        value: "$16,940",
        subtitle: "+12% last month",
        trend: "up",
      },
      {
        title: "Alerts Today",
        value: "342",
        subtitle: "6 currency pairs",
        trend: "neutral",
      },
    ];

    const revenueData = {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      datasets: [
        {
          data: [12000, 13200, 15000, 14000, 15500, 16000, 16940],
          color: () => "#4CAF50",
          strokeWidth: 2,
          name: "Monthly",
        },
        {
          data: [40000, 42000, 44000, 43000, 45000, 46000, 47000],
          color: () => "#FFC107",
          strokeWidth: 2,
          name: "3 Month",
        },
        {
          data: [200000, 202000, 205000, 203000, 206000, 208000, 203280],
          color: () => "#2196F3",
          strokeWidth: 2,
          name: "Annual",
        },
      ],
    };

    const subscriptionPieData = [
      { name: "Monthly", population: 42, color: "#4CAF50" },
      { name: "3 Months", population: 31, color: "#FFC107" },
      { name: "Annual", population: 27, color: "#2196F3" },
    ];

    const alerts = getRecentMarketAlerts({ limit: 6 });

    const ws = {
      provider: "FCS API",
      ticks: 342,
      lastTick: new Date().toISOString(),
      uptime: "99.8%",
      reconnections: 0,
    };

    const users = [
      { name: "Alice Baker", email: "alice@example.com", plan: "Monthly", status: "Active" },
      { name: "Bob Carter", email: "bob@example.com", plan: "3 Months", status: "Trial" },
      { name: "Cara Diaz", email: "cara@example.com", plan: "Annual", status: "Active" },
      { name: "Dan Evans", email: "dan@example.com", plan: "Monthly", status: "Cancelled" },
      { name: "Eva Ford", email: "eva@example.com", plan: "3 Months", status: "Active" },
      { name: "Frank Green", email: "frank@example.com", plan: "Annual", status: "Active" },
      { name: "Gina Hall", email: "gina@example.com", plan: "Monthly", status: "Trial" },
      { name: "Hank Ivy", email: "hank@example.com", plan: "Annual", status: "Active" },
    ];

    const notifications = [
      { type: "danger", message: "Card declined for user@email.com", time: "2m ago" },
      { type: "info", message: "New user joined — Trial started", time: "5m ago" },
      { type: "warning", message: "FCS API reconnected after 3s", time: "10m ago" },
      { type: "warning", message: "342 alerts sent in last hour", time: "30m ago" },
      { type: "accent", message: "New annual subscription — $192", time: "1h ago" },
    ];

    const revenueMetrics = {
      newSubscribersToday: 14,
      cancelledToday: 3,
      trialConversionsThisWeek: "67%",
      churnRate: "2.3%",
      mrr: "$16,940",
      arr: "$203,280",
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
    console.error(err);
    res.status(500).json({ error: "Unable to build dashboard payload." });
  }
});

export default router;
