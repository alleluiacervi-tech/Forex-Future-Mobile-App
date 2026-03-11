import prisma from "../db/prisma.js";
import Logger from "../utils/logger.js";
import { pipSizeForPair } from "./marketValidator.js";

const logger = new Logger("AlertOutcomeTracker");

// In-memory cache of pending outcomes: Map<pair, AlertOutcome[]>
const pendingOutcomes = new Map();
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
let lastDbRefreshAt = 0;
const DB_REFRESH_INTERVAL = 60 * 1000; // 60 seconds

/**
 * Create an outcome record when an alert fires.
 */
export async function createOutcome(alert) {
  if (!alert?.levels || !alert.pair) return;

  const data = {
    pair: alert.pair,
    direction: alert.direction,
    entryPrice: alert.levels.entry,
    slPrice: alert.levels.stopLoss,
    tp1Price: alert.levels.tp1,
    tp2Price: alert.levels.tp2,
    tp3Price: alert.levels.tp3,
  };

  try {
    if (prisma.alertOutcome) {
      const record = await prisma.alertOutcome.create({ data });
      addToPending(alert.pair, record);
    } else {
      // DB model not migrated yet — track in-memory only
      addToPending(alert.pair, { ...data, id: `mem-${Date.now()}`, createdAt: new Date() });
    }
  } catch (err) {
    logger.warn("Failed to create AlertOutcome", { error: err?.message });
    addToPending(alert.pair, { ...data, id: `mem-${Date.now()}`, createdAt: new Date() });
  }
}

function addToPending(pair, outcome) {
  if (!pendingOutcomes.has(pair)) pendingOutcomes.set(pair, []);
  pendingOutcomes.get(pair).push(outcome);
}

/**
 * Check pending outcomes against current price. Called on each tick.
 */
export function checkOutcomes(pair, currentPrice) {
  const outcomes = pendingOutcomes.get(pair);
  if (!outcomes || !outcomes.length) return;

  const pipSize = pipSizeForPair(pair);
  const now = Date.now();
  const resolved = [];

  for (let i = outcomes.length - 1; i >= 0; i--) {
    const o = outcomes[i];
    const createdMs = o.createdAt instanceof Date ? o.createdAt.getTime() : Date.parse(o.createdAt);
    let result = null;
    let pnlPips = null;

    if (o.direction === 'BUY') {
      if (currentPrice <= o.slPrice) {
        result = 'SL_HIT';
        pnlPips = (currentPrice - o.entryPrice) / pipSize;
      } else if (currentPrice >= o.tp3Price) {
        result = 'TP3_HIT';
        pnlPips = (currentPrice - o.entryPrice) / pipSize;
      } else if (currentPrice >= o.tp2Price) {
        result = 'TP2_HIT';
        pnlPips = (currentPrice - o.entryPrice) / pipSize;
      } else if (currentPrice >= o.tp1Price) {
        result = 'TP1_HIT';
        pnlPips = (currentPrice - o.entryPrice) / pipSize;
      }
    } else {
      if (currentPrice >= o.slPrice) {
        result = 'SL_HIT';
        pnlPips = (o.entryPrice - currentPrice) / pipSize;
      } else if (currentPrice <= o.tp3Price) {
        result = 'TP3_HIT';
        pnlPips = (o.entryPrice - currentPrice) / pipSize;
      } else if (currentPrice <= o.tp2Price) {
        result = 'TP2_HIT';
        pnlPips = (o.entryPrice - currentPrice) / pipSize;
      } else if (currentPrice <= o.tp1Price) {
        result = 'TP1_HIT';
        pnlPips = (o.entryPrice - currentPrice) / pipSize;
      }
    }

    // Expire after 24 hours
    if (!result && now - createdMs > EXPIRY_MS) {
      result = 'EXPIRED';
      pnlPips = o.direction === 'BUY'
        ? (currentPrice - o.entryPrice) / pipSize
        : (o.entryPrice - currentPrice) / pipSize;
    }

    if (result) {
      outcomes.splice(i, 1);
      resolved.push({ id: o.id, outcome: result, exitPrice: currentPrice, pnlPips });
    }
  }

  // Persist resolved outcomes to DB asynchronously
  for (const r of resolved) {
    if (r.id.startsWith('mem-')) continue;
    if (!prisma.alertOutcome) continue;
    prisma.alertOutcome.update({
      where: { id: r.id },
      data: { outcome: r.outcome, exitPrice: r.exitPrice, pnlPips: r.pnlPips, exitedAt: new Date() },
    }).catch(() => {});
  }
}

/**
 * Refresh pending outcomes from DB periodically.
 */
export async function refreshFromDb() {
  if (!prisma.alertOutcome) return;
  const now = Date.now();
  if (now - lastDbRefreshAt < DB_REFRESH_INTERVAL) return;
  lastDbRefreshAt = now;

  try {
    const pending = await prisma.alertOutcome.findMany({
      where: { outcome: null },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    pendingOutcomes.clear();
    for (const o of pending) {
      addToPending(o.pair, o);
    }
  } catch (err) {
    logger.warn("Failed to refresh AlertOutcomes from DB", { error: err?.message });
  }
}

/**
 * Get track record stats.
 */
export async function getTrackRecord() {
  if (!prisma.alertOutcome) {
    return { total: 0, wins: 0, losses: 0, winRate: 0, recent: [] };
  }

  try {
    const resolved = await prisma.alertOutcome.findMany({
      where: { outcome: { not: null } },
      orderBy: { exitedAt: 'desc' },
      take: 200,
    });

    const wins = resolved.filter(o => o.outcome?.startsWith('TP')).length;
    const losses = resolved.filter(o => o.outcome === 'SL_HIT').length;
    const expired = resolved.filter(o => o.outcome === 'EXPIRED').length;
    const total = resolved.length;
    const winRate = (wins + losses) > 0 ? wins / (wins + losses) : 0;
    const avgPnlPips = total > 0
      ? resolved.reduce((sum, o) => sum + (o.pnlPips || 0), 0) / total
      : 0;

    return {
      total,
      wins,
      losses,
      expired,
      winRate: Math.round(winRate * 1000) / 10,
      avgPnlPips: Math.round(avgPnlPips * 10) / 10,
      recent: resolved.slice(0, 20),
    };
  } catch (err) {
    logger.warn("Failed to get track record", { error: err?.message });
    return { total: 0, wins: 0, losses: 0, winRate: 0, recent: [] };
  }
}
