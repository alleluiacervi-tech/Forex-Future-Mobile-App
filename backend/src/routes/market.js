import express from "express";
import { buildFootprintSummary } from "../services/footprints.js";
import { getHistoricalRates, getLiveRates } from "../services/rates.js";

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

export default router;
