import express from "express";
import authenticate from "../middleware/auth.js";
import prisma from "../db/prisma.js";
import { getPriceForPair } from "../services/rates.js";

const router = express.Router();

const calculateEquity = (account, positions) => {
  const pnl = positions.reduce((sum, position) => {
    const pricing = getPriceForPair(position.pair);
    const current = position.side === "buy" ? pricing.bid : pricing.ask;
    const delta = (current - position.entryPrice) * (position.side === "buy" ? 1 : -1);
    return sum + delta * position.units;
  }, 0);

  return {
    equity: account.balance + pnl,
    unrealizedPnl: pnl
  };
};

router.get("/summary", authenticate, async (req, res) => {
  const account = await prisma.account.findUnique({ where: { userId: req.user.id } });
  const positions = await prisma.position.findMany({ where: { userId: req.user.id } });
  const { equity, unrealizedPnl } = calculateEquity(account, positions);

  const updatedAccount = await prisma.account.update({
    where: { id: account.id },
    data: { equity }
  });

  return res.json({
    account: updatedAccount,
    unrealizedPnl,
    openPositions: positions.length
  });
});

router.get("/positions", authenticate, async (req, res) => {
  const positions = await prisma.position.findMany({ where: { userId: req.user.id } });
  const enriched = positions.map((position) => {
    const pricing = getPriceForPair(position.pair);
    const current = position.side === "buy" ? pricing.bid : pricing.ask;
    const delta = (current - position.entryPrice) * (position.side === "buy" ? 1 : -1);
    return {
      ...position,
      currentPrice: current,
      unrealizedPnl: Number((delta * position.units).toFixed(2))
    };
  });

  return res.json({ positions: enriched });
});

router.get("/transactions", authenticate, async (req, res) => {
  const transactions = await prisma.transaction.findMany({
    where: { userId: req.user.id },
    orderBy: { timestamp: "desc" }
  });

  return res.json({ transactions });
});

export default router;
