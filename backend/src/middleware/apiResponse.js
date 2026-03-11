import crypto from "crypto";

const asObject = (value) => (value && typeof value === "object" ? value : null);

const resolveRequestId = (req) => {
  const headerId = req.header("x-request-id") || req.header("x-correlation-id");
  const normalized = String(headerId || "").trim();
  if (normalized) return normalized;
  return crypto.randomUUID();
};

const normalizeError = (body, fallbackMessage = "Request failed") => {
  if (typeof body === "string" && body.trim()) {
    return { code: "REQUEST_FAILED", message: body.trim() };
  }

  const payload = asObject(body);
  if (!payload) {
    return { code: "REQUEST_FAILED", message: fallbackMessage };
  }

  if (asObject(payload.error)) {
    const code = typeof payload.error.code === "string" ? payload.error.code : "REQUEST_FAILED";
    const message =
      typeof payload.error.message === "string" && payload.error.message
        ? payload.error.message
        : fallbackMessage;
    const details = payload.error.details ?? payload.details ?? payload.errors;
    return details === undefined ? { code, message } : { code, message, details };
  }

  const message =
    typeof payload.error === "string"
      ? payload.error
      : typeof payload.message === "string"
        ? payload.message
        : fallbackMessage;

  const code = typeof payload.code === "string" ? payload.code : "REQUEST_FAILED";
  const details = payload.details ?? payload.errors;
  return details === undefined ? { code, message } : { code, message, details };
};

const apiResponseMiddleware = (req, res, next) => {
  const requestId = resolveRequestId(req);
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  const originalJson = res.json.bind(res);

  res.success = (data = null, meta = {}) =>
    originalJson({
      success: true,
      data,
      meta: {
        requestId,
        ...meta
      }
    });

  res.fail = (statusCode, message, options = {}) => {
    const code = typeof options.code === "string" ? options.code : "REQUEST_FAILED";
    const error = {
      code,
      message
    };

    if (options.details !== undefined) {
      error.details = options.details;
    }

    return res.status(statusCode).json({
      error
    });
  };

  res.json = (body) => {
    if (res.locals?.skipApiEnvelope === true) {
      return originalJson(body);
    }

    const payload = asObject(body);
    if (payload && Object.prototype.hasOwnProperty.call(payload, "success")) {
      return originalJson(payload);
    }

    if (res.statusCode >= 400) {
      return originalJson({
        success: false,
        error: normalizeError(body),
        meta: { requestId }
      });
    }

    return originalJson({
      success: true,
      data: body ?? null,
      meta: { requestId }
    });
  };

  next();
};

export default apiResponseMiddleware;
