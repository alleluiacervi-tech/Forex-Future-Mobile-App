import express from "express";
import authenticate from "../middleware/auth.js";
import prisma from "../db/prisma.js";
import { getPriceForPair } from "../services/rates.js";

const router = express.Router();

const calculateEquity = async (account, positions) => {
  const pnlValues = await Promise.all(
    positions.map(async (position) => {
      const pricing = await getPriceForPair(position.pair);
      const current = position.side === "buy" ? pricing.bid : pricing.ask;
      const delta = (current - position.entryPrice) * (position.side === "buy" ? 1 : -1);
      return delta * position.units;
    })
  );

  const pnl = pnlValues.reduce((sum, value) => sum + value, 0);

  return {
    equity: account.balance + pnl,
    unrealizedPnl: pnl
  };
};

router.get("/summary", authenticate, async (req, res) => {
  const account = await prisma.account.findUnique({ where: { userId: req.user.id } });
  const positions = await prisma.position.findMany({ where: { userId: req.user.id } });
  const { equity, unrealizedPnl } = await calculateEquity(account, positions);

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
  const enriched = await Promise.all(positions.map(async (position) => {
    const pricing = await getPriceForPair(position.pair);
    const current = position.side === "buy" ? pricing.bid : pricing.ask;
    const delta = (current - position.entryPrice) * (position.side === "buy" ? 1 : -1);
    return {
      ...position,
      currentPrice: current,
      unrealizedPnl: Number((delta * position.units).toFixed(2))
    };
  }));

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
