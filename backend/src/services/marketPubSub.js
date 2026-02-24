import { EventEmitter } from "events";
import Logger from "../utils/logger.js";
import { buildRedisKey, getRedisPublisher, getRedisSubscriber } from "./redis.js";

const logger = new Logger("MarketPubSub");

const TOPICS = {
  stream: "stream",
  alerts: "alerts"
};

const CHANNELS = {
  [TOPICS.stream]: buildRedisKey("pubsub", "market", "stream"),
  [TOPICS.alerts]: buildRedisKey("pubsub", "market", "alerts")
};

const CHANNEL_TO_TOPIC = Object.entries(CHANNELS).reduce((acc, [topic, channel]) => {
  acc[channel] = topic;
  return acc;
}, {});

const localBus = new EventEmitter();
localBus.setMaxListeners(0);

let subscribed = false;
let subscribePromise = null;
let redisListenerAttached = false;

const parsePayload = (message) => {
  try {
    return JSON.parse(message);
  } catch {
    return null;
  }
};

const ensureMarketSubscriptions = async () => {
  if (subscribed) return true;
  if (subscribePromise) return subscribePromise;

  subscribePromise = (async () => {
    const subscriber = await getRedisSubscriber();
    if (!subscriber) return false;

    if (!redisListenerAttached) {
      subscriber.on("message", (channel, message) => {
        const topic = CHANNEL_TO_TOPIC[channel];
        if (!topic) return;
        const payload = parsePayload(message);
        if (!payload) return;
        localBus.emit(topic, payload);
      });
      redisListenerAttached = true;
    }

    await subscriber.subscribe(...Object.values(CHANNELS));
    subscribed = true;
    logger.info("Market pub/sub subscriptions active.", { channels: Object.values(CHANNELS) });
    return true;
  })()
    .catch((error) => {
      logger.warn("Market pub/sub subscription failed", { error: error?.message });
      return false;
    })
    .finally(() => {
      subscribePromise = null;
    });

  return subscribePromise;
};

const publishTopic = (topic, payload) => {
  const channel = CHANNELS[topic];
  if (!channel) return;

  let rawMessage;
  try {
    rawMessage = JSON.stringify(payload);
  } catch {
    return;
  }

  const publish = async () => {
    const publisher = await getRedisPublisher();
    if (publisher) {
      try {
        await publisher.publish(channel, rawMessage);
        return;
      } catch (error) {
        logger.warn("Redis publish failed; falling back to local bus", {
          topic,
          error: error?.message
        });
      }
    }

    localBus.emit(topic, payload);
  };

  void publish();
};

const subscribeTopic = (topic, handler) => {
  if (typeof handler !== "function") {
    throw new Error("subscribeTopic requires a function handler");
  }

  localBus.on(topic, handler);
  void ensureMarketSubscriptions();

  return () => {
    localBus.off(topic, handler);
  };
};

const publishMarketStream = (payload) => publishTopic(TOPICS.stream, payload);
const publishMarketAlert = (payload) => publishTopic(TOPICS.alerts, payload);
const subscribeMarketStream = (handler) => subscribeTopic(TOPICS.stream, handler);
const subscribeMarketAlerts = (handler) => subscribeTopic(TOPICS.alerts, handler);

export {
  publishMarketAlert,
  publishMarketStream,
  subscribeMarketAlerts,
  subscribeMarketStream
};
