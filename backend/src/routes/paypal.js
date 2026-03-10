import express from "express";
import authenticate from "../middleware/auth.js";
import {
  createOrder,
  captureOrder,
  createSubscription,
  cancelSubscription,
  getSubscription,
  verifyWebhookSignature,
  handleWebhook,
  checkTrialEligibility,
  PAYPAL_PLAN_CATALOG,
} from "../services/paypal.js";
import prisma from "../db/prisma.js";
import Logger from "../utils/logger.js";

const router = express.Router();
const logger = new Logger("PayPalRoutes");

const getAdminAnnualSubscription = () => {
  const annualPlan = PAYPAL_PLAN_CATALOG.annual;
  return {
    id: "admin-annual",
    plan: annualPlan?.key || "annual",
    status: "active",
    amount: Number(annualPlan?.amount || 0),
    trialEnd: null,
    currentPeriodEnd: null,
    gracePeriodEnd: null,
    paypalSubscriptionId: null,
    createdAt: null,
    isAdminManaged: true,
  };
};

// GET /paypal/plans — public
router.get("/plans", (_req, res) => {
  const plans = Object.values(PAYPAL_PLAN_CATALOG).map((p) => ({
    key: p.key,
    name: p.name,
    priceDisplay: p.priceDisplay,
    amount: p.amount,
    interval: p.interval,
    perMonth: p.perMonth || null,
    originalPrice: p.originalPrice || null,
    savings: p.savings || null,
    discount: p.discount || null,
    label: p.label || null,
    trialDays: p.trialDays,
    features: p.features,
  }));
  return res.json({ plans });
});

// POST /paypal/create-order — authenticated (Orders API v2)
router.post("/create-order", authenticate, async (req, res) => {
  if (req.user?.isAdmin) {
    return res.status(409).json({
      error: "Admin accounts already include an active annual subscription.",
    });
  }

  const { planKey } = req.body;
  if (!planKey) {
    return res.status(400).json({ error: "Plan selection is required." });
  }

  try {
    const { orderId } = await createOrder(planKey, req.user.id);
    const clientId = String(process.env.PAYPAL_CLIENT_ID || "").trim();
    return res.json({ orderId, clientId });
  } catch (error) {
    logger.error("Create order failed", {
      userId: req.user.id,
      error: error?.message,
    });
    const status = error?.statusCode || 500;
    return res
      .status(status)
      .json({ error: error?.message || "Unable to create order. Please try again." });
  }
});

// POST /paypal/capture-order — authenticated (Orders API v2)
router.post("/capture-order", authenticate, async (req, res) => {
  const { orderId, planKey } = req.body;
  if (!orderId) {
    return res.status(400).json({ error: "Order ID is required." });
  }

  try {
    const captureData = await captureOrder(orderId);

    // Resolve plan details for subscription record
    const plan = PAYPAL_PLAN_CATALOG[String(planKey || "monthly").trim().toLowerCase()];
    const payerId =
      captureData?.payer?.payer_id ||
      captureData?.payment_source?.paypal?.account_id ||
      null;

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Determine period end based on plan interval
    let currentPeriodEnd = new Date(now);
    const interval = plan?.interval || "month";
    if (interval === "month") {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    } else if (interval === "3 months") {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 3);
    } else if (interval === "year") {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    }

    await prisma.subscription.create({
      data: {
        userId: req.user.id,
        plan: plan?.key || "monthly",
        status: "active",
        amount: Number(plan?.amount || 0),
        paypalSubscriptionId: orderId,
        payerId,
        cardFingerprint: payerId,
        trialEnd,
        currentPeriodEnd,
      },
    });

    // Activate user trial
    await prisma.user.update({
      where: { id: req.user.id },
      data: { trialActive: true, trialStartedAt: now },
      select: { id: true },
    });

    // Record fingerprint for trial abuse prevention
    if (payerId) {
      await prisma.trialFingerprint.upsert({
        where: { cardFingerprint: payerId },
        update: { userId: req.user.id },
        create: { cardFingerprint: payerId, userId: req.user.id },
      });
    }

    logger.info("Order captured and subscription created", {
      userId: req.user.id,
      orderId,
      plan: plan?.key,
    });

    return res.json({ success: true, orderId, status: "COMPLETED" });
  } catch (error) {
    logger.error("Capture order failed", {
      userId: req.user.id,
      orderId,
      error: error?.message,
    });
    const status = error?.statusCode || 500;
    return res
      .status(status)
      .json({ error: error?.message || "Unable to capture order. Please try again." });
  }
});

// POST /paypal/create-subscription — authenticated
router.post("/create-subscription", authenticate, async (req, res) => {
  if (req.user?.isAdmin) {
    return res.status(409).json({
      error: "Admin accounts already include an active annual subscription.",
    });
  }

  const { planKey } = req.body;
  if (!planKey) {
    return res.status(400).json({ error: "Plan selection is required." });
  }

  try {
    const { subscriptionId, approvalUrl } = await createSubscription(
      planKey,
      req.user.email,
      req.user.name
    );

    // Save pending subscription
    const plan = PAYPAL_PLAN_CATALOG[String(planKey).trim().toLowerCase()];
    await prisma.subscription.create({
      data: {
        userId: req.user.id,
        plan: plan?.key || planKey,
        status: "pending",
        amount: Number(plan?.amount || 0),
        paypalSubscriptionId: subscriptionId,
      },
    });

    return res.json({ subscriptionId, approvalUrl });
  } catch (error) {
    logger.error("Create subscription failed", {
      userId: req.user.id,
      error: error?.message,
    });
    const status = error?.statusCode || 500;
    return res
      .status(status)
      .json({ error: error?.message || "Unable to create subscription. Please try again." });
  }
});

// POST /paypal/webhook — no auth, PayPal calls this
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let event;
  try {
    const rawBody =
      typeof req.body === "string"
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body.toString("utf8")
          : JSON.stringify(req.body);

    event = typeof req.body === "object" && !Buffer.isBuffer(req.body)
      ? req.body
      : JSON.parse(rawBody);

    const valid = await verifyWebhookSignature(req.headers, event);
    if (!valid) {
      logger.warn("PayPal webhook signature verification failed", {
        eventType: event?.event_type,
      });
      return res.status(400).json({ error: "Invalid webhook signature." });
    }
  } catch (error) {
    logger.error("PayPal webhook parse/verify error", { error: error?.message });
    return res.status(400).json({ error: "Invalid webhook payload." });
  }

  // Return 200 immediately, process asynchronously
  res.status(200).json({ received: true });

  try {
    await handleWebhook(event);
  } catch (error) {
    logger.error("PayPal webhook processing error", {
      eventType: event?.event_type,
      error: error?.message,
    });
  }
});

// GET /paypal/subscription — authenticated
router.get("/subscription", authenticate, async (req, res) => {
  if (req.user?.isAdmin) {
    return res.json({
      subscription: getAdminAnnualSubscription(),
      paypalDetails: null,
    });
  }

  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user.id },
      orderBy: { updatedAt: "desc" },
    });

    if (!subscription) {
      return res.json({ subscription: null });
    }

    let paypalDetails = null;
    if (subscription.paypalSubscriptionId) {
      try {
        paypalDetails = await getSubscription(subscription.paypalSubscriptionId);
      } catch (error) {
        logger.warn("Failed to fetch PayPal subscription details", {
          subscriptionId: subscription.paypalSubscriptionId,
          error: error?.message,
        });
      }
    }

    return res.json({
      subscription: {
        id: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        amount: subscription.amount,
        trialEnd: subscription.trialEnd,
        currentPeriodEnd: subscription.currentPeriodEnd,
        gracePeriodEnd: subscription.gracePeriodEnd,
        paypalSubscriptionId: subscription.paypalSubscriptionId,
        createdAt: subscription.createdAt,
      },
      paypalDetails,
    });
  } catch (error) {
    logger.error("Get subscription failed", {
      userId: req.user.id,
      error: error?.message,
    });
    return res.status(500).json({ error: "Unable to retrieve subscription." });
  }
});

// POST /paypal/cancel — authenticated
router.post("/cancel", authenticate, async (req, res) => {
  if (req.user?.isAdmin) {
    return res.json({
      message: "Admin annual access is always enabled and cannot be cancelled.",
      accessUntil: null,
    });
  }

  const { reason } = req.body;

  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user.id },
      orderBy: { updatedAt: "desc" },
    });

    if (!subscription || !subscription.paypalSubscriptionId) {
      return res.status(404).json({ error: "No active subscription found." });
    }

    const result = await cancelSubscription(
      subscription.paypalSubscriptionId,
      reason || "Cancelled by user"
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error || "Unable to cancel subscription." });
    }

    return res.json({
      message: "Subscription cancelled successfully.",
      accessUntil: subscription.currentPeriodEnd || subscription.trialEnd,
    });
  } catch (error) {
    logger.error("Cancel subscription failed", {
      userId: req.user.id,
      error: error?.message,
    });
    return res.status(500).json({ error: "Unable to cancel subscription." });
  }
});

// POST /paypal/check-trial — authenticated
router.post("/check-trial", authenticate, async (req, res) => {
  const { cardFingerprint } = req.body;
  if (!cardFingerprint) {
    return res.status(400).json({ error: "Card fingerprint is required." });
  }

  try {
    const eligible = await checkTrialEligibility(cardFingerprint);
    return res.json({ eligible });
  } catch (error) {
    logger.error("Check trial eligibility failed", {
      userId: req.user.id,
      error: error?.message,
    });
    return res.status(500).json({ error: "Unable to check trial eligibility." });
  }
});

export default router;
