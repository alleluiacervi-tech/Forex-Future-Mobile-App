import Redis from "ioredis";
import Logger from "../utils/logger.js";

const logger = new Logger("RedisService");

const redisEnabled = process.env.REDIS_ENABLED !== "false";
const redisUrl = String(process.env.REDIS_URL || "").trim();
const redisKeyPrefix = String(process.env.REDIS_KEY_PREFIX || "forex:").trim() || "forex:";
const reconnectBaseMs = Math.max(100, Number(process.env.REDIS_RECONNECT_BASE_MS || 250));
const reconnectMaxMs = Math.max(reconnectBaseMs, Number(process.env.REDIS_RECONNECT_MAX_MS || 5000));

let warnedMissingRedis = false;

const canUseRedis = () => {
  if (!redisEnabled) return false;
  if (redisUrl) return true;
  if (!warnedMissingRedis) {
    warnedMissingRedis = true;
    logger.warn("REDIS_URL is not set; Redis-backed services will use in-memory fallback.");
  }
  return false;
};

const createClient = (name) => {
  const client = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    keyPrefix: redisKeyPrefix,
    retryStrategy: (times) => {
      const attempt = Math.max(0, Number(times || 0));
      return Math.min(reconnectBaseMs * 2 ** attempt, reconnectMaxMs);
    }
  });

  client.on("error", (error) => {
    logger.warn("Redis client error", { client: name, error: error?.message });
  });

  client.on("end", () => {
    logger.warn("Redis connection closed", { client: name });
  });

  return client;
};

let commandClient = null;
let publisherClient = null;
let subscriberClient = null;

const connectIfNeeded = async (client, name) => {
  if (!client) return null;
  if (client.status === "ready" || client.status === "connect") return client;

  try {
    await client.connect();
    logger.info("Redis client connected", { client: name });
    return client;
  } catch (error) {
    logger.warn("Redis connect failed", { client: name, error: error?.message });
    return null;
  }
};

const getRedisClient = async () => {
  if (!canUseRedis()) return null;
  if (!commandClient) {
    commandClient = createClient("command");
  }
  return connectIfNeeded(commandClient, "command");
};

const getRedisPublisher = async () => {
  if (!canUseRedis()) return null;
  if (!publisherClient) {
    publisherClient = createClient("publisher");
  }
  return connectIfNeeded(publisherClient, "publisher");
};

const getRedisSubscriber = async () => {
  if (!canUseRedis()) return null;
  if (!subscriberClient) {
    subscriberClient = createClient("subscriber");
  }
  return connectIfNeeded(subscriberClient, "subscriber");
};

const buildRedisKey = (...parts) => {
  const normalized = parts
    .flat()
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(":");
  return normalized;
};

const closeClient = async (client, name) => {
  if (!client) return;
  try {
    await client.quit();
    logger.info("Redis client disconnected", { client: name });
  } catch {
    try {
      client.disconnect();
    } catch {}
  }
};

const shutdownRedis = async () => {
  const clients = [
    [commandClient, "command"],
    [publisherClient, "publisher"],
    [subscriberClient, "subscriber"]
  ];

  await Promise.all(clients.map(([client, name]) => closeClient(client, name)));

  commandClient = null;
  publisherClient = null;
  subscriberClient = null;
};

export {
  buildRedisKey,
  canUseRedis,
  getRedisClient,
  getRedisPublisher,
  getRedisSubscriber,
  shutdownRedis
};
