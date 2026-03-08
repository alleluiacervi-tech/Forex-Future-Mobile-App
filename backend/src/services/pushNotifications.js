import { Expo } from "expo-server-sdk";
import prisma from "../db/prisma.js";
import Logger from "../utils/logger.js";

const logger = new Logger("PushNotifications");
const expo = new Expo();

// Throttle: max 1 push per pair per 5 minutes
const lastPushByPair = new Map();
const PUSH_THROTTLE_MS = 5 * 60 * 1000;

// Store ticket IDs for receipt checking
// Map<ticketId, { token, userId, createdAt }>
const pendingTickets = new Map();

/**
 * Send push notifications for a market alert to all users with pushAlerts enabled.
 */
export async function sendPushForAlert(alert) {
  try {
    const pair = alert?.pair;
    if (!pair) return;

    // Throttle per pair
    const lastSent = lastPushByPair.get(pair) || 0;
    if (Date.now() - lastSent < PUSH_THROTTLE_MS) return;
    lastPushByPair.set(pair, Date.now());

    // Query active push tokens for users who have pushAlerts enabled
    const tokens = await prisma.pushToken.findMany({
      where: {
        active: true,
        user: {
          preferences: { pushAlerts: true },
          isActive: true,
        },
      },
      select: { token: true, id: true, userId: true },
    });

    if (!tokens.length) return;

    const title = `${alert.severity?.name || "ALERT"}: ${pair} ${alert.direction}`;
    const body = `${Math.round(alert.pips)} pip move detected. Entry: ${alert.levels?.entry ?? "N/A"}`;

    const messages = [];
    for (const { token, userId } of tokens) {
      if (!Expo.isExpoPushToken(token)) continue;
      messages.push({
        to: token,
        sound: "default",
        title,
        body,
        data: {
          pair,
          direction: alert.direction,
          severity: alert.severity?.name,
          levels: alert.levels,
        },
        priority: alert.severity?.level >= 3 ? "high" : "default",
        _userId: userId,
      });
    }

    if (!messages.length) return;

    // Batch send via Expo
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk.map((t, i) => ({ ...t, _userId: chunk[i]._userId })));
      } catch (err) {
        logger.error("Expo push chunk failed", { error: err?.message });
      }
    }

    // Store ticket IDs for later receipt checking
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket.id) {
        pendingTickets.set(ticket.id, {
          token: messages[i]?.to,
          userId: ticket._userId,
          createdAt: Date.now(),
        });
      }
      // Handle immediate errors (e.g. DeviceNotRegistered)
      if (ticket.status === "error") {
        if (ticket.details?.error === "DeviceNotRegistered" && messages[i]?.to) {
          deactivateToken(messages[i].to).catch(() => {});
        }
      }
    }

    // Create Notification DB records
    const notifData = tokens
      .filter(({ token }) => Expo.isExpoPushToken(token))
      .map(({ userId }) => ({
        userId,
        title,
        body,
        type: "alert",
        data: { pair, direction: alert.direction, severity: alert.severity?.name },
      }));

    if (notifData.length && prisma.notification) {
      prisma.notification.createMany({ data: notifData }).catch(() => {});
    }

    logger.info(`Push sent for ${pair}`, { recipients: messages.length, tickets: tickets.length });
  } catch (err) {
    logger.error("sendPushForAlert failed", { error: err?.message });
  }
}

/**
 * Check push receipts and deactivate invalid tokens.
 * Runs on a 15-minute interval.
 */
export async function checkPushReceipts() {
  try {
    // 1. Check receipts for stored ticket IDs
    const ticketIds = [...pendingTickets.keys()];
    if (ticketIds.length > 0) {
      const receiptIdChunks = expo.chunkPushNotificationReceiptIds(ticketIds);
      for (const chunk of receiptIdChunks) {
        try {
          const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
          for (const [receiptId, receipt] of Object.entries(receipts)) {
            const ticketInfo = pendingTickets.get(receiptId);
            pendingTickets.delete(receiptId);

            if (receipt.status === "error") {
              logger.warn("Push receipt error", {
                receiptId,
                error: receipt.details?.error,
                token: ticketInfo?.token,
              });
              // Deactivate token on permanent errors
              if (
                receipt.details?.error === "DeviceNotRegistered" ||
                receipt.details?.error === "InvalidCredentials"
              ) {
                if (ticketInfo?.token) {
                  await deactivateToken(ticketInfo.token);
                }
              }
            }
          }
        } catch (err) {
          logger.error("Failed to fetch receipts chunk", { error: err?.message });
        }
      }
    }

    // 2. Expire old pending tickets (>24h) to prevent memory leak
    const expiryCutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [id, info] of pendingTickets) {
      if (info.createdAt < expiryCutoff) pendingTickets.delete(id);
    }

    // 3. Deactivate tokens not updated in 30 days
    const staleCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (prisma.pushToken) {
      await prisma.pushToken.updateMany({
        where: { updatedAt: { lt: staleCutoff }, active: true },
        data: { active: false },
      });
    }
  } catch (err) {
    logger.error("checkPushReceipts failed", { error: err?.message });
  }
}

/**
 * Deactivate a specific push token in the database.
 */
async function deactivateToken(token) {
  try {
    if (prisma.pushToken) {
      await prisma.pushToken.updateMany({
        where: { token },
        data: { active: false },
      });
      logger.info("Deactivated push token", { token: token.slice(0, 20) + "..." });
    }
  } catch (err) {
    logger.error("Failed to deactivate token", { error: err?.message });
  }
}

// Start receipt checker interval (15 min)
setInterval(() => checkPushReceipts().catch(() => {}), 15 * 60 * 1000);
