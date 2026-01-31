import prisma from "../db/prisma.js";
import { requestRecommendation } from "../services/groq.js";
import { buildFootprintSummary } from "../services/footprints.js";
import { getPriceForPair } from "../services/rates.js";

const createRecommendation = async (req, res) => {
  const {
    pair,
    timeframe,
    currentPrice,
    accountBalance,
    riskPercent,
    notes
  } = req.body;

  try {
    const account = await prisma.account.findUnique({ where: { userId: req.user.id } });
    const pricing = currentPrice ? null : await getPriceForPair(pair);
    const resolvedPrice = currentPrice ?? pricing?.mid ?? pricing?.bid ?? pricing?.ask;
    const resolvedBalance = accountBalance ?? account?.balance;
    const resolvedTimeframe = timeframe || "1H";
    const resolvedRisk = riskPercent ?? 1;

    if (!resolvedPrice || !resolvedBalance) {
      return res.status(400).json({ error: "Missing pricing or account balance for recommendation." });
    }

    const footprint = await buildFootprintSummary(pair);
    const recommendation = await requestRecommendation({
      pair,
      timeframe: resolvedTimeframe,
      currentPrice: resolvedPrice,
      accountBalance: resolvedBalance,
      riskPercent: resolvedRisk,
      notes,
      lstmContext: footprint
    });

    const stored = await prisma.recommendation.create({
      data: {
        userId: req.user.id,
        pair,
        action: recommendation.action,
        confidence: recommendation.confidence,
        entry: recommendation.entry,
        stopLoss: recommendation.stopLoss,
        takeProfit1: recommendation.takeProfit1,
        takeProfit2: recommendation.takeProfit2,
        riskReward: recommendation.riskReward,
        positionSizeLots: recommendation.positionSizeLots,
        rationale: recommendation.rationale
      }
    });

    return res.status(201).json({ recommendation: stored, footprint });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
};

const listRecommendations = async (req, res) => {
  const recommendations = await prisma.recommendation.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" }
  });

  return res.json({ recommendations });
};

export { createRecommendation, listRecommendations };
