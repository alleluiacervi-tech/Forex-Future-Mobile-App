import { Prisma } from "@prisma/client";
import Logger from "../utils/logger.js";

const logger = new Logger("ErrorHandler");

const prismaCodeToResponse = (code) => {
  switch (code) {
    case "P2002":
      return {
        status: 409,
        code: "CONFLICT",
        message: "A record with these details already exists."
      };
    case "P2003":
      return {
        status: 409,
        code: "RELATION_CONSTRAINT_FAILED",
        message: "The request conflicts with related records."
      };
    case "P2025":
      return {
        status: 404,
        code: "NOT_FOUND",
        message: "The requested resource was not found."
      };
    case "P1001":
    case "P1002":
    case "P1008":
    case "P1017":
      return {
        status: 503,
        code: "DATABASE_UNAVAILABLE",
        message: "Database service is temporarily unavailable."
      };
    default:
      return {
        status: 500,
        code: "DATABASE_ERROR",
        message: "Database operation failed."
      };
  }
};

const serializeError = (error) => {
  if (!error) return { message: "Unknown error" };
  return {
    name: error.name,
    message: error.message,
    code: error.code,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack
  };
};

const errorHandler = (error, req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError || /^P\d{4}$/.test(String(error?.code || ""))) {
    const mapped = prismaCodeToResponse(String(error.code));

    logger.warn("Prisma request error", {
      requestId: req.requestId,
      path: req.originalUrl,
      method: req.method,
      prismaCode: error.code,
      error: serializeError(error)
    });

    return res.status(mapped.status).json({
      error: {
        code: mapped.code,
        message: mapped.message
      }
    });
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    logger.warn("Prisma validation error", {
      requestId: req.requestId,
      path: req.originalUrl,
      method: req.method,
      error: serializeError(error)
    });

    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request payload failed validation."
      }
    });
  }

  if (error?.name === "ZodError") {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request payload failed validation.",
        details: error.issues
      }
    });
  }

  logger.error("Unhandled request error", {
    requestId: req.requestId,
    path: req.originalUrl,
    method: req.method,
    error: serializeError(error)
  });

  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred."
    }
  });
};

const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "Route not found."
    }
  });
};

export { errorHandler, notFoundHandler };
