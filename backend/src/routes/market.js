import express from "express";
import { buildFootprintSummary } from "../services/footprints.js";
import { requestRecommendation } from "../services/gemini.js";
import { getHistoricalRates, getLiveRates, getPriceForPair } from "../services/rates.js";
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
    const history = await getHistoricalRates(pair);
    return res.json({ pair, history });
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

    return res.json({ recommendation, footprint });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
});

export default router;
