import jwt from "jsonwebtoken";
import config from "../config.js";
import prisma from "../db/prisma.js";
import Logger from "../utils/logger.js";

const logger = new Logger('AuthMiddleware');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      logger.warn('Missing authentication token', { ip: req.ip, path: req.path });
      return res.status(401).json({ error: "Missing authentication token." });
    }

    // Verify token
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch (error) {
      logger.warn('Token verification failed', { error: error.message, ip: req.ip });
      return res.status(401).json({ error: "Invalid token." });
    }

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        baseCurrency: true,
        riskLevel: true,
        notifications: true,
        trialActive: true,
        trialStartedAt: true
      }
    });

    if (!user) {
      logger.warn('User not found for valid token', { userId: payload.sub });
      return res.status(401).json({ error: "User not found." });
    }

    // Check if trial is still active (if not demo account)
    if (user.email.toLowerCase() !== "demo@forex.app" && !user.trialActive) {
      logger.warn('Trial not active for user', { userId: user.id, email: user.email });
      return res.status(403).json({ error: "Trial has expired. Please renew your subscription." });
    }

    // Attach user to request
    req.user = user;
    logger.debug('User authenticated', { userId: user.id, email: user.email });
    
    return next();
  } catch (error) {
    logger.error('Authentication middleware error', { error: error.message, ip: req.ip });
    return res.status(500).json({ error: "Authentication error." });
  }
};

export default authenticate;
