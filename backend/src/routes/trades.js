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

  try {
    const { pair, side, units } = data;
    const pricing = await getPriceForPair(pair);
    const price = side === "buy" ? pricing.ask : pricing.bid;
    const notional = units * price;
    const requiredMargin = notional * 0.02;

    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({
        where: { userId: req.user.id },
        select: { id: true, balance: true }
      });

      if (!account) {
        const err = new Error("Account not found.");
        err.statusCode = 404;
        throw err;
      }

      if (account.balance < requiredMargin) {
        const err = new Error("Insufficient margin to open this trade.");
        err.statusCode = 400;
        throw err;
      }

      const order = await tx.order.create({
        data: {
          userId: req.user.id,
          pair,
          side,
          units,
          price,
          status: "filled"
        }
      });

      const position = await tx.position.create({
        data: {
          userId: req.user.id,
          pair,
          side,
          units,
          entryPrice: price,
          unrealizedPnl: 0
        }
      });

      const transaction = await tx.transaction.create({
        data: {
          userId: req.user.id,
          type: "trade",
          pair,
          side,
          units,
          price
        }
      });

      const updatedAccount = await tx.account.update({
        where: { id: account.id },
        data: {
          marginUsed: {
            increment: requiredMargin
          }
        }
      });

      return { order, position, transaction, account: updatedAccount };
    });

    return res.status(201).json(result);
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? Number(error.statusCode) : 502;
    return res.status(statusCode).json({ error: error.message });
  }
});

export default router;
