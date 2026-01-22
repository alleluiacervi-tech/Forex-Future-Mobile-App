import express from "express";
import authenticate from "../middleware/auth.js";
import prisma from "../db/prisma.js";
import { parseSchema, updateUserSchema } from "../utils/validators.js";

const router = express.Router();

router.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }
  return res.json({ user });
});

router.put("/me", authenticate, async (req, res) => {
  const { data, error } = parseSchema(updateUserSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const updates = data || {};

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      name: updates.name,
      baseCurrency: updates.settings?.baseCurrency,
      riskLevel: updates.settings?.riskLevel,
      notifications: updates.settings?.notifications
    }
  });

  return res.json({ user });
});

export default router;
