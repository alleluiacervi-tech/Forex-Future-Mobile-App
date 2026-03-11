import prisma from "../db/prisma.js";
import { sendEmail } from "./email.js";
import Logger from "../utils/logger.js";

const logger = new Logger("PayPalService");

const TOKEN_CACHE_MS = 8 * 60 * 60 * 1000;
const TRIAL_DAYS = 7;
const GRACE_DAYS = 3;

const PLAN_FEATURES = [
  "Real-time velocity alerts",
  "Institutional footprint detection",
  "Smart money signals",
  "All currency pairs",
  "Push notifications",
  "Entry SL TP on every alert",
  "Full alert history",
  "Email support",
];

export const PAYPAL_PLAN_CATALOG = {
  monthly: {
    key: "monthly",
    name: "Monthly Plan",
    priceDisplay: "$20/month",
    amount: "20.00",
    interval: "month",
    trialDays: TRIAL_DAYS,
    planEnvKey: "PAYPAL_PLAN_MONTHLY",
    features: PLAN_FEATURES,
  },
  quarterly: {
    key: "quarterly",
    name: "Quarterly Plan",
    priceDisplay: "$54 / 3 months",
    amount: "54.00",
    interval: "3 months",
    perMonth: "$18/month",
    originalPrice: "$60",
    discount: "10%",
    trialDays: TRIAL_DAYS,
    planEnvKey: "PAYPAL_PLAN_QUARTERLY",
    features: PLAN_FEATURES,
  },
  annual: {
    key: "annual",
    name: "Annual Plan",
    priceDisplay: "$192/year",
    amount: "192.00",
    interval: "year",
    perMonth: "$16/month",
    originalPrice: "$240",
    savings: "$48",
    discount: "20%",
    label: "BEST VALUE",
    trialDays: TRIAL_DAYS,
    planEnvKey: "PAYPAL_PLAN_ANNUAL",
    features: PLAN_FEATURES,
  },
};

let tokenCache = {
  token: null,
  expiresAt: 0,
};

const getPaypalBaseUrl = () => {
  const explicitBase = String(process.env.PAYPAL_BASE_URL || "").trim();
  if (explicitBase) return explicitBase.replace(/\/$/, "");
  if ((process.env.NODE_ENV || "").toLowerCase() === "production") {
    return "https://api-m.paypal.com";
  }
  return "https://api-m.sandbox.paypal.com";
};

const jsonHeaders = (token) => ({
  "Content-Type": "application/json",
  Accept: "application/json",
  Authorization: `Bearer ${token}`,
});

const parseJsonSafe = async (response) => {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const paypalRequest = async (path, options = {}) => {
  const url = `${getPaypalBaseUrl()}${path}`;
  const response = await fetch(url, options);
  if (response.status === 204) {
    return { ok: true, status: response.status, data: null };
  }

  const data = await parseJsonSafe(response);
  if (!response.ok) {
    const message =
      data?.message ||
      data?.error_description ||
      data?.details?.[0]?.description ||
      `PayPal API request failed (${response.status})`;
    const error = new Error(message);
    error.statusCode = response.status;
    error.payload = data;
    throw error;
  }

  return { ok: true, status: response.status, data };
};

const resolvePlan = (planKey) => {
  const normalized = String(planKey || "").trim().toLowerCase();
  const plan = PAYPAL_PLAN_CATALOG[normalized];
  if (!plan) {
    const error = new Error("Invalid plan selected.");
    error.statusCode = 400;
    throw error;
  }

  const planId = String(process.env[plan.planEnvKey] || "").trim();
  if (!planId) {
    const error = new Error(`PayPal plan is not configured for '${normalized}'.`);
    error.statusCode = 500;
    throw error;
  }

  return { ...plan, planId };
};

const getHeaderValue = (headers, key) => {
  if (!headers) return "";
  const target = key.toLowerCase();
  for (const [headerName, headerValue] of Object.entries(headers)) {
    if (String(headerName).toLowerCase() === target) {
      return String(headerValue || "");
    }
  }
  return "";
};

const extractSubscriptionId = (event) => {
  const resource = event?.resource || {};
  return (
    resource?.id ||
    resource?.billing_agreement_id ||
    resource?.supplementary_data?.related_ids?.subscription_id ||
    resource?.supplementary_data?.related_ids?.billing_agreement_id ||
    ""
  );
};

const extractAmount = (event) => {
  const resource = event?.resource || {};
  const raw =
    resource?.amount?.total ||
    resource?.amount?.value ||
    resource?.billing_info?.last_payment?.amount?.value ||
    resource?.billing_info?.outstanding_balance?.value ||
    null;
  if (raw === null || raw === undefined || raw === "") return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  return num.toFixed(2);
};

const recordPaymentEvent = async ({
  userId,
  eventType,
  paypalEventId,
  paypalSubscriptionId,
  amount,
  status,
  rawEvent,
}) => {
  try {
    await prisma.paymentEvent.create({
      data: {
        userId: userId || null,
        eventType,
        paypalEventId: paypalEventId || null,
        paypalSubscriptionId: paypalSubscriptionId || null,
        amount: amount ? Number(amount) : null,
        status: status || null,
        rawEvent: rawEvent || {},
      },
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return { duplicate: true };
    }
    throw error;
  }
  return { duplicate: false };
};

// ADDED: create in-app notification for webhook events
const createUserNotification = async (userId, title, body, type = "system") => {
  if (!userId) return;
  try {
    await prisma.notification.create({
      data: { userId, title, body, type },
    });
  } catch (error) {
    logger.warn("Failed to create webhook notification", { userId, error: error?.message });
  }
};

const ensureTrialFingerprint = async (cardFingerprint, userId) => {
  if (!cardFingerprint) return;
  await prisma.trialFingerprint.upsert({
    where: { cardFingerprint },
    update: { userId: userId || null },
    create: {
      cardFingerprint,
      userId: userId || null,
    },
  });
};

const upsertSubscriptionByPayPalId = async (paypalSubscriptionId, data) => {
  if (!paypalSubscriptionId) return null;

  const existing = await prisma.subscription.findFirst({
    where: { paypalSubscriptionId },
    select: { id: true },
  });

  if (existing) {
    return prisma.subscription.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.subscription.create({
    data: {
      plan: "monthly",
      status: "pending",
      amount: Number(PAYPAL_PLAN_CATALOG.monthly.amount),
      paypalSubscriptionId,
      ...data,
    },
  });
};

const shouldUserAccessBeActive = async (userId) => {
  const now = new Date();
  const latest = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      status: true,
      trialEnd: true,
      currentPeriodEnd: true,
      gracePeriodEnd: true,
    },
  });

  if (!latest) return false;

  if (latest.status === "active") return true;
  if (latest.status === "trial" && latest.trialEnd && latest.trialEnd > now) return true;
  if (latest.status === "cancelled" && latest.currentPeriodEnd && latest.currentPeriodEnd > now) return true;
  if (latest.status === "past_due" && latest.gracePeriodEnd && latest.gracePeriodEnd > now) return true;
  return false;
};

export async function getAccessToken() {
  if (tokenCache.token && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const clientId = String(process.env.PAYPAL_CLIENT_ID || "").trim();
  const secret = String(process.env.PAYPAL_SECRET || "").trim();

  if (!clientId || !secret) {
    throw new Error("PayPal credentials are not configured.");
  }

  const basicAuth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const response = await fetch(`${getPaypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });

  const data = await parseJsonSafe(response);
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || "Unable to authenticate with PayPal.");
  }

  const ttlMs = Math.max(
    60_000,
    Math.min(
      TOKEN_CACHE_MS,
      Number.isFinite(Number(data.expires_in)) ? Number(data.expires_in) * 1000 : TOKEN_CACHE_MS
    )
  );

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + ttlMs,
  };

  return tokenCache.token;
}

export async function createOrder(planKey, userId) {
  const plan = resolvePlan(planKey);
  const token = await getAccessToken();

  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: `${plan.key}_${userId}`,
        description: `Forex Future – ${plan.name}`,
        amount: {
          currency_code: "USD",
          value: plan.amount,
        },
      },
    ],
    application_context: {
      brand_name: "Forex Future",
      shipping_preference: "NO_SHIPPING",
      user_action: "PAY_NOW",
    },
  };

  const { data } = await paypalRequest("/v2/checkout/orders", {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!data?.id) {
    throw new Error("PayPal did not return an order ID.");
  }

  logger.info("PayPal order created", { userId, plan: plan.key, orderId: data.id });
  return { orderId: data.id, plan };
}

export async function captureOrder(orderId) {
  if (!orderId) {
    const error = new Error("Missing order ID.");
    error.statusCode = 400;
    throw error;
  }

  const token = await getAccessToken();
  const { data } = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: jsonHeaders(token),
  });

  if (data?.status !== "COMPLETED") {
    const error = new Error(`Order capture not completed (status: ${data?.status || "unknown"}).`);
    error.statusCode = 400;
    throw error;
  }

  logger.info("PayPal order captured", { orderId, status: data.status });
  return data;
}

export async function createSubscription(planKey, userEmail, userName) {
  const plan = resolvePlan(planKey);
  const token = await getAccessToken();
  const returnUrl = String(process.env.PAYPAL_RETURN_URL || "").trim();
  const cancelUrl = String(process.env.PAYPAL_CANCEL_URL || "").trim();

  if (!returnUrl || !cancelUrl) {
    throw new Error("PayPal return and cancel URLs are not configured.");
  }

  const trimmedName = String(userName || "").trim();
  const nameParts = trimmedName.split(/\s+/).filter(Boolean);
  const givenName = nameParts[0] || "Forex";
  const surname = nameParts.slice(1).join(" ") || "Future";

  const payload = {
    plan_id: plan.planId,
    subscriber: {
      email_address: String(userEmail || "").trim(),
      name: {
        given_name: givenName,
        surname,
      },
    },
    application_context: {
      brand_name: "Forex Future",
      user_action: "SUBSCRIBE_NOW",
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  };

  const { data } = await paypalRequest("/v1/billing/subscriptions", {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });

  const approvalUrl = Array.isArray(data?.links)
    ? data.links.find((link) => link.rel === "approve")?.href
    : null;
  const subscriptionId = data?.id;

  if (!subscriptionId || !approvalUrl) {
    throw new Error("PayPal did not return an approval URL.");
  }

  logger.info("PayPal subscription created", {
    userEmail,
    plan: plan.key,
    subscriptionId,
  });

  return { subscriptionId, approvalUrl };
}

export async function cancelSubscription(subscriptionId, reason = "Cancelled by user") {
  if (!subscriptionId) {
    return { success: false, error: "Missing subscription ID." };
  }

  try {
    const token = await getAccessToken();
    await paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ reason: String(reason || "Cancelled by user").slice(0, 120) }),
    });

    await prisma.subscription.updateMany({
      where: { paypalSubscriptionId: subscriptionId },
      data: { status: "cancelled" },
    });

    return { success: true };
  } catch (error) {
    logger.error("PayPal cancel subscription failed", {
      subscriptionId,
      error: error?.message,
    });
    return { success: false, error: error?.message || "Unable to cancel subscription." };
  }
}

export async function getSubscription(subscriptionId) {
  if (!subscriptionId) {
    throw new Error("Missing subscription ID.");
  }
  const token = await getAccessToken();
  const { data } = await paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "GET",
    headers: jsonHeaders(token),
  });
  return data;
}

export async function verifyWebhookSignature(headers, body) {
  try {
    const webhookId = String(process.env.PAYPAL_WEBHOOK_ID || "").trim();
    if (!webhookId) {
      logger.warn("PayPal webhook rejected: missing PAYPAL_WEBHOOK_ID");
      return false;
    }

    const transmissionId = getHeaderValue(headers, "paypal-transmission-id");
    const transmissionTime = getHeaderValue(headers, "paypal-transmission-time");
    const certUrl = getHeaderValue(headers, "paypal-cert-url");
    const authAlgo = getHeaderValue(headers, "paypal-auth-algo");
    const transmissionSig = getHeaderValue(headers, "paypal-transmission-sig");

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      logger.warn("PayPal webhook rejected: missing signature headers");
      return false;
    }

    const token = await getAccessToken();
    const payload = {
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: body,
    };

    const { data } = await paypalRequest("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify(payload),
    });

    const valid = data?.verification_status === "SUCCESS";
    if (!valid) {
      logger.warn("PayPal webhook signature verification failed", {
        verificationStatus: data?.verification_status,
      });
    }
    return valid;
  } catch (error) {
    logger.warn("PayPal webhook signature verification errored", {
      error: error?.message,
    });
    return false;
  }
}

export async function checkTrialEligibility(cardFingerprint) {
  const fingerprint = String(cardFingerprint || "").trim();
  if (!fingerprint) return false;
  const existing = await prisma.trialFingerprint.findUnique({
    where: { cardFingerprint: fingerprint },
    select: { id: true },
  });
  return !existing;
}

export async function handleWebhook(event) {
  const eventType = String(event?.event_type || "").trim();
  const eventId = String(event?.id || "").trim();
  const subscriptionId = extractSubscriptionId(event);
  const amount = extractAmount(event);
  const resource = event?.resource || {};

  const existingSubscription = subscriptionId
    ? await prisma.subscription.findFirst({
        where: { paypalSubscriptionId: subscriptionId },
        select: { id: true, userId: true, plan: true },
      })
    : null;

  const userId = existingSubscription?.userId || null;
  const status = String(resource?.status || "").toLowerCase() || null;

  if (eventId) {
    const rec = await recordPaymentEvent({
      userId,
      eventType,
      paypalEventId: eventId,
      paypalSubscriptionId: subscriptionId || null,
      amount,
      status,
      rawEvent: event,
    });
    if (rec.duplicate) {
      logger.info("PayPal webhook duplicate ignored", { eventId, eventType });
      return { ok: true, duplicate: true };
    }
  }

  switch (eventType) {
    case "BILLING.SUBSCRIPTION.ACTIVATED": {
      const payerId = String(resource?.subscriber?.payer_id || "").trim() || null;
      const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      await upsertSubscriptionByPayPalId(subscriptionId, {
        userId,
        status: "active",
        trialEnd,
        payerId,
        cardFingerprint: payerId,
      });

      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: { trialActive: true, trialStartedAt: new Date() },
          select: { id: true },
        });
      }

      if (payerId) {
        await ensureTrialFingerprint(payerId, userId);
      }

      // ADDED: notify user of activation
      await createUserNotification(userId, "Subscription Active", "Your subscription is now active. Enjoy full access to all features.", "system");
      logger.info("PayPal subscription activated for user", { userId, subscriptionId });
      break;
    }

    case "BILLING.SUBSCRIPTION.CANCELLED": {
      await upsertSubscriptionByPayPalId(subscriptionId, {
        userId,
        status: "cancelled",
      });
      // ADDED: notify user of cancellation
      await createUserNotification(userId, "Subscription Cancelled", "Your subscription has been cancelled. You will retain access until the end of your current billing period.", "system");
      logger.info("PayPal subscription cancelled", { userId, subscriptionId });
      break;
    }

    case "BILLING.SUBSCRIPTION.EXPIRED": {
      await upsertSubscriptionByPayPalId(subscriptionId, {
        userId,
        status: "expired",
      });
      if (userId) {
        const accessActive = await shouldUserAccessBeActive(userId);
        if (!accessActive) {
          await prisma.user.update({
            where: { id: userId },
            data: { trialActive: false },
            select: { id: true },
          });
        }
      }
      // ADDED: notify user of expiry
      await createUserNotification(userId, "Subscription Expired", "Your subscription has expired. Renew to continue receiving alerts.", "system");
      logger.info("PayPal subscription expired", { userId, subscriptionId });
      break;
    }

    case "BILLING.SUBSCRIPTION.SUSPENDED": {
      await upsertSubscriptionByPayPalId(subscriptionId, {
        userId,
        status: "suspended",
      });
      logger.info("PayPal subscription suspended", { userId, subscriptionId });
      break;
    }

    case "PAYMENT.SALE.COMPLETED": {
      let currentPeriodEnd = null;
      try {
        if (subscriptionId) {
          const remoteSubscription = await getSubscription(subscriptionId);
          const nextBilling = remoteSubscription?.billing_info?.next_billing_time;
          if (nextBilling) {
            const parsed = new Date(nextBilling);
            if (!Number.isNaN(parsed.getTime())) {
              currentPeriodEnd = parsed;
            }
          }
        }
      } catch (error) {
        logger.warn("PayPal get subscription failed during payment completed handling", {
          subscriptionId,
          error: error?.message,
        });
      }

      await upsertSubscriptionByPayPalId(subscriptionId, {
        userId,
        status: "active",
        currentPeriodEnd,
      });

      // ADDED: notify user of successful payment
      await createUserNotification(userId, "Payment Received", `Payment of $${amount || "0.00"} received. Thank you.`, "system");
      logger.info("PayPal payment received", {
        userId,
        subscriptionId,
        amount,
      });
      break;
    }

    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
      const gracePeriodEnd = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000);
      await upsertSubscriptionByPayPalId(subscriptionId, {
        userId,
        status: "past_due",
        gracePeriodEnd,
      });

      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });

        if (user?.email) {
          const firstName = String(user.name || "Trader").split(" ")[0];
          const graceDate = gracePeriodEnd.toISOString().slice(0, 10);
          await sendEmail({
            to: user.email,
            subject: "Action required: subscription payment failed",
            text:
              `Hi ${firstName},\n\n` +
              "We could not process your latest subscription payment.\n" +
              `Please update your PayPal billing details before ${graceDate} to avoid service interruption.\n\n` +
              "Forex Future Team",
            html:
              `<p>Hi ${firstName},</p>` +
              "<p>We could not process your latest subscription payment.</p>" +
              `<p>Please update your PayPal billing details before <strong>${graceDate}</strong> to avoid service interruption.</p>` +
              "<p>Forex Future Team</p>",
          });
        }
      }

      // ADDED: notify user of payment failure
      await createUserNotification(userId, "Payment Failed", "We could not process your subscription payment. Please update your billing details to keep access.", "alert");
      logger.warn("PayPal payment failed", { userId, subscriptionId, amount });
      break;
    }

    case "CHECKOUT.ORDER.APPROVED": {
      const orderId = resource?.id || "";
      logger.info("PayPal order approved via webhook", { orderId, userId });
      break;
    }

    default:
      logger.info("PayPal webhook ignored", { eventType, subscriptionId });
      break;
  }

  return { ok: true };
}
