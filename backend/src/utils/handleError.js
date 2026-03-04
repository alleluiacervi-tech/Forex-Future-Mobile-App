import { Prisma } from "@prisma/client";
import Logger from "./logger.js";

const logger = new Logger("RouteError");

/**
 * Per-route error handler for catch blocks.
 * Maps Prisma and application errors to appropriate HTTP responses.
 */
const handleError = (error, res) => {
  // Application-level errors with explicit status codes
  if (Number.isInteger(error?.statusCode)) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  // Prisma known-request errors
  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    /^P\d{4}$/.test(String(error?.code || ""))
  ) {
    const code = String(error.code);
    logger.warn("Prisma request error in route", { code, message: error.message });

    if (code === "P2002") {
      return res.status(409).json({ error: "A record with these details already exists." });
    }
    if (code === "P2025") {
      return res.status(404).json({ error: "The requested resource was not found." });
    }
    if (["P1001", "P1002", "P1008", "P1017"].includes(code)) {
      return res.status(503).json({ error: "Database service is temporarily unavailable." });
    }
    return res.status(500).json({ error: "Database operation failed." });
  }

  // Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    logger.warn("Prisma validation error in route", { message: error.message });
    return res.status(400).json({ error: "Request payload failed validation." });
  }

  // Fallback
  logger.error("Unhandled route error", {
    name: error?.name,
    message: error?.message,
    stack: process.env.NODE_ENV === "production" ? undefined : error?.stack
  });

  return res.status(500).json({ error: "An unexpected error occurred." });
};

export default handleError;
