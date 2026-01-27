import express from "express";
import parseSchema from "../utils/validators.js";
import authenticate from "../middleware/auth.js";
import authService from "../services/auth.js";
import Logger from "../utils/logger.js";
import {
  loginSchema,
  registerSchema,
  trialStartSchema
} from "../utils/validators.js";

const router = express.Router();
const logger = new Logger('AuthRoutes');

router.post("/register", async (req, res) => {
  const { data, error } = parseSchema(registerSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const user = await authService.registerUser(data.name, data.email, data.password);
    return res.status(201).json({
      user,
      account: user.account,
      trialRequired: true
    });
  } catch (error) {
    logger.error('Registration endpoint error', { error: error.message });
    
    if (error.message.includes('already registered')) {
      return res.status(409).json({ error: error.message });
    }
    if (error.message.includes('must be')) {
      return res.status(400).json({ error: error.message });
    }
    
    return res.status(500).json({ error: "Registration failed." });
  }
});

router.post("/login", async (req, res) => {
  const { data, error } = parseSchema(loginSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const { user, token } = await authService.authenticateUser(data.email, data.password);
    return res.json({
      user,
      account: user.account,
      token
    });
  } catch (error) {
    logger.error('Login endpoint error', { error: error.message });
    
    if (error.message.includes('trial must be activated')) {
      return res.status(403).json({ error: error.message });
    }
    
    return res.status(401).json({ error: error.message });
  }
});

router.post("/trial/start", async (req, res) => {
  const { data, error } = parseSchema(trialStartSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const { user, token } = await authService.startTrial(data.email, data.password);
    return res.json({ user, account: user.account, token });
  } catch (error) {
    logger.error('Trial start endpoint error', { error: error.message });
    
    if (error.message.includes('already active')) {
      return res.status(400).json({ error: error.message });
    }
    
    return res.status(401).json({ error: error.message });
  }
});

router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.id);
    return res.json({ user, account: user.account });
  } catch (error) {
    logger.error('Get user endpoint error', { userId: req.user.id, error: error.message });
    return res.status(404).json({ error: error.message });
  }
});

router.post("/password/change", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current password and new password are required." });
  }

  try {
    await authService.updatePassword(req.user.id, currentPassword, newPassword);
    return res.json({ message: "Password updated successfully." });
  } catch (error) {
    logger.error('Password change endpoint error', { userId: req.user.id, error: error.message });
    
    if (error.message.includes('incorrect')) {
      return res.status(401).json({ error: error.message });
    }
    
    return res.status(400).json({ error: error.message });
  }
});

export default router;
