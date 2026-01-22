import express from "express";
import authenticate from "../middleware/auth.js";
import prisma from "../db/prisma.js";
import { getPriceForPair } from "../services/rates.js";
import { orderSchema, parseSchema } from "../utils/validators.js";

const router = express.Router();

router.get("/orders", authenticate, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" }
  });

  return res.json({ orders });
});

router.post("/orders", authenticate, async (req, res) => {
  const { data, error } = parseSchema(orderSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const { pair, side, units } = data;
  const account = await prisma.account.findUnique({ where: { userId: req.user.id } });
  if (!account) {
    return res.status(404).json({ error: "Account not found." });
  }

  const pricing = getPriceForPair(pair);
  const price = side === "buy" ? pricing.ask : pricing.bid;
  const notional = units * price;

  if (account.balance < notional * 0.02) {
    return res.status(400).json({ error: "Insufficient margin to open this trade." });
  }

  const [order, position, transaction] = await prisma.$transaction([
    prisma.order.create({
      data: {
        userId: req.user.id,
        pair,
        side,
        units,
        price,
        status: "filled"
      }
    }),
    prisma.position.create({
      data: {
        userId: req.user.id,
        pair,
        side,
        units,
        entryPrice: price,
        unrealizedPnl: 0
      }
    }),
    prisma.transaction.create({
      data: {
        userId: req.user.id,
        type: "trade",
        pair,
        side,
        units,
        price
      }
    })
  ]);

  const updatedAccount = await prisma.account.update({
    where: { id: account.id },
    data: {
      marginUsed: account.marginUsed + notional * 0.02,
      updatedAt: new Date()
    }
  });

  return res.status(201).json({ order, position, transaction, account: updatedAccount });
});

export default router;
