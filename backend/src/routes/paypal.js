import express from "express";
import authenticate from "../middleware/auth.js";
import {
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

// POST /paypal/create-subscription — authenticated
router.post("/create-subscription", authenticate, async (req, res) => {
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
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user.id },
      orderBy: { updatedAt: "desc" },
    });

    if (!subscription || !subscription.paypalSubscriptionId) {
      return res.json({ subscription: null });
    }

    let paypalDetails = null;
    try {
      paypalDetails = await getSubscription(subscription.paypalSubscriptionId);
    } catch (error) {
      logger.warn("Failed to fetch PayPal subscription details", {
        subscriptionId: subscription.paypalSubscriptionId,
        error: error?.message,
      });
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
