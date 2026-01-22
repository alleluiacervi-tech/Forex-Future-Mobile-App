import express from "express";
import authenticate from "../middleware/auth.js";
import { createRecommendation, listRecommendations } from "../controllers/recommendations.js";
import { parseSchema, recommendationSchema } from "../utils/validators.js";

const router = express.Router();

router.get("/", authenticate, listRecommendations);

router.post("/", authenticate, (req, res, next) => {
  const { error } = parseSchema(recommendationSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  return next();
}, createRecommendation);

export default router;
