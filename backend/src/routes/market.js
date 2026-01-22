import express from "express";
import { buildFootprintSummary } from "../services/footprints.js";
import { getHistoricalRates, getLiveRates } from "../services/rates.js";

const router = express.Router();

const normalizePair = (pair) => pair.replace("-", "/");

router.get("/pairs", (req, res) => {
  const pairs = getLiveRates();
  return res.json({ pairs });
});

router.get("/history/:pair", (req, res) => {
  const pair = normalizePair(req.params.pair);
  if (!/^[A-Z]{3}\/[A-Z]{3}$/.test(pair)) {
    return res.status(400).json({ error: "Pair must be in the format XXX/YYY." });
  }
  const history = getHistoricalRates(pair);
  return res.json({ pair, history });
});

router.get("/footprints/:pair", (req, res) => {
  const pair = normalizePair(req.params.pair);
  if (!/^[A-Z]{3}\/[A-Z]{3}$/.test(pair)) {
    return res.status(400).json({ error: "Pair must be in the format XXX/YYY." });
  }

  const footprint = buildFootprintSummary(pair);
  return res.json(footprint);
});

export default router;
