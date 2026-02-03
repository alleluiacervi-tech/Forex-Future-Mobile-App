import express from "express";
import prisma from "../db/prisma.js";
import { buildFootprintSummary } from "../services/footprints.js";
import { requestRecommendation } from "../services/groq.js";
import { getHistoricalRates, getLiveRates, getPriceForPair } from "../services/rates.js";
import { symbolToPair } from "../services/marketSymbols.js";
import {
  computePipValuePerLot,
  defaultFootprintPointsForInterval,
  extractKeyLevelsHint,
  getSessionUtc,
  normalizeTimeframeToInterval
} from "../services/recommendationContext.js";
import { parseSchema, recommendationSchema } from "../utils/validators.js";

const router = express.Router();

const normalizePair = (pair) => pair.replace("-", "/");

router.get("/pairs", async (req, res) => {
  try {
    const pairs = await getLiveRates();
    return res.json({ pairs });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
});

router.get("/history/:pair", async (req, res) => {
  const pair = normalizePair(req.params.pair);
  if (!/^[A-Z]{3}\/[A-Z]{3}$/.test(pair)) {
    return res.status(400).json({ error: "Pair must be in the format XXX/YYY." });
  }
  try {
    const interval = typeof req.query.interval === "string" ? req.query.interval : "1h";
    const points = Number.isFinite(Number(req.query.points)) ? Number(req.query.points) : 60;
    const history = await getHistoricalRates(pair, points, { interval });
    return res.json({ pair, history });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
});

router.get("/alerts", async (req, res) => {
  const rawPair = typeof req.query.pair === "string" ? req.query.pair : "";
  const pair = rawPair ? normalizePair(rawPair) : null;
  const limit = Number.isFinite(Number(req.query.limit)) ? Number(req.query.limit) : 50;
  const since = typeof req.query.since === "string" ? req.query.since : null;

  try {
    if (!prisma.marketAlert) {
      return res.json({ alerts: [] });
    }

    const where = {};
    if (pair) where.pair = pair;
    if (since) where.triggeredAt = { gte: new Date(since) };

    const alerts = await prisma.marketAlert.findMany({
      where,
      orderBy: { triggeredAt: "desc" },
      take: Math.max(1, Math.min(200, limit))
    });

    return res.json({ alerts });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
});

router.get("/footprints/:pair", async (req, res) => {
  const pair = normalizePair(req.params.pair);
  if (!/^[A-Z]{3}\/[A-Z]{3}$/.test(pair)) {
    return res.status(400).json({ error: "Pair must be in the format XXX/YYY." });
  }

  try {
    const footprint = await buildFootprintSummary(pair);
    return res.json(footprint);
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
});

router.post("/recommendations", async (req, res) => {
  const { data, error } = parseSchema(recommendationSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const { pair, timeframe, currentPrice, accountBalance, riskPercent, notes } = data;

  try {
    const pricing = currentPrice ? null : await getPriceForPair(pair);
    const resolvedPrice = currentPrice ?? pricing?.mid ?? pricing?.bid ?? pricing?.ask;
    const resolvedBalance = accountBalance ?? 10000;
    const resolvedTimeframe = timeframe || "1H";
    const resolvedRisk = riskPercent ?? 1;

    if (!resolvedPrice) {
      return res.status(400).json({ error: "Missing pricing for recommendation." });
    }

    const interval = normalizeTimeframeToInterval(resolvedTimeframe) || "1h";
    const points = defaultFootprintPointsForInterval(interval);
    const footprint = await buildFootprintSummary(pair, { points, candleOpts: { interval } });
    const accountCurrency = "USD";
    const keyLevelsHint = extractKeyLevelsHint({ footprint, pair });
    const pipValuePerLot = computePipValuePerLot({ pair, price: resolvedPrice, accountCurrency });
    const recommendation = await requestRecommendation({
      pair,
      timeframe: resolvedTimeframe,
      currentPrice: resolvedPrice,
      accountBalance: resolvedBalance,
      accountCurrency,
      riskPercent: resolvedRisk,
      notes,
      pipValuePerLot,
      session: getSessionUtc(),
      keyLevelsHint,
      lstmContext: footprint
    });

    return res.json({ recommendation, footprint });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
});

// Mock quote endpoint for fallback when WebSocket is unavailable
router.post("/quote", async (req, res) => {
  try {
    const { symbol, pair: rawPair } = req.body || {};

    const pair =
      typeof rawPair === "string" && rawPair
        ? normalizePair(rawPair)
        : typeof symbol === "string" && symbol
          ? symbolToPair[symbol]
          : null;

    if (!pair) {
      return res.status(400).json({ error: "Missing pair or symbol." });
    }

    const pricing = await getPriceForPair(pair);
    const currentPrice = pricing?.mid ?? pricing?.bid ?? pricing?.ask;

    return res.json({
      pair,
      currentPrice,
      bid: pricing?.bid,
      ask: pricing?.ask,
      timestamp: pricing?.timestamp ?? new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch quote" });
  }
});

export default router;
