import prisma from "../db/prisma.js";
import { requestRecommendation } from "../services/gemini.js";

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
    const recommendation = await requestRecommendation({
      pair,
      timeframe,
      currentPrice,
      accountBalance,
      riskPercent,
      notes
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

    return res.status(201).json({ recommendation: stored });
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
