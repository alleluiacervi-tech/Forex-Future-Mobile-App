import express from "express";
import authenticate from "../middleware/auth.js";
import prisma from "../db/prisma.js";
import { parseSchema, updateUserSchema } from "../utils/validators.js";
import handleError from "../utils/handleError.js";

const router = express.Router();

router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { preferences: true }
    });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    return res.json({ user });
  } catch (error) {
    return handleError(error, res);
  }
});

router.put("/me", authenticate, async (req, res) => {
  const { data, error } = parseSchema(updateUserSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const updates = data || {};
    const userUpdates = {};
    if (updates.name) userUpdates.name = updates.name;

    // Settings go to UserPreference (upsert)
    const settingsPayload = updates.settings;
    const hasSettings =
      settingsPayload &&
      (settingsPayload.baseCurrency !== undefined ||
        settingsPayload.riskLevel !== undefined ||
        settingsPayload.notifications !== undefined);

    const [user] = await Promise.all([
      Object.keys(userUpdates).length > 0
        ? prisma.user.update({
            where: { id: req.user.id },
            data: userUpdates,
            include: { preferences: true }
          })
        : prisma.user.findUnique({
            where: { id: req.user.id },
            include: { preferences: true }
          }),
      hasSettings
        ? prisma.userPreference.upsert({
            where: { userId: req.user.id },
            create: {
              userId: req.user.id,
              ...(settingsPayload.baseCurrency && { baseCurrency: settingsPayload.baseCurrency }),
              ...(settingsPayload.riskLevel && { riskLevel: settingsPayload.riskLevel }),
              ...(settingsPayload.notifications !== undefined && { notifications: settingsPayload.notifications })
            },
            update: {
              ...(settingsPayload.baseCurrency && { baseCurrency: settingsPayload.baseCurrency }),
              ...(settingsPayload.riskLevel && { riskLevel: settingsPayload.riskLevel }),
              ...(settingsPayload.notifications !== undefined && { notifications: settingsPayload.notifications })
            }
          })
        : Promise.resolve(null)
    ]);

    // Re-fetch to include updated preferences in response
    const freshUser = hasSettings
      ? await prisma.user.findUnique({
          where: { id: req.user.id },
          include: { preferences: true }
        })
      : user;

    return res.json({ user: freshUser });
  } catch (error) {
    return handleError(error, res);
  }
});

export default router;
