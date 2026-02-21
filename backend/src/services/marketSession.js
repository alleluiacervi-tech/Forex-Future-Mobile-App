const MARKET_TIMEZONE = process.env.FOREX_MARKET_TIMEZONE || "America/New_York";

const normalizeHour = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(23, Math.trunc(parsed)));
};

const MARKET_OPEN_HOUR_SUNDAY = normalizeHour(
  process.env.FOREX_MARKET_OPEN_HOUR_SUNDAY_ET,
  17
);
const MARKET_CLOSE_HOUR_FRIDAY = normalizeHour(
  process.env.FOREX_MARKET_CLOSE_HOUR_FRIDAY_ET,
  17
);

const WEEKDAY_TO_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

const pad2 = (n) => String(n).padStart(2, "0");

const readMarketClock = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value || "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value || "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value || "0");
  const second = Number(parts.find((p) => p.type === "second")?.value || "0");
  const weekdayIndex = WEEKDAY_TO_INDEX[weekday];

  return {
    weekday,
    weekdayIndex: Number.isFinite(weekdayIndex) ? weekdayIndex : -1,
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
    second: Number.isFinite(second) ? second : 0
  };
};

const isForexMarketOpen = (date = new Date()) => {
  const clock = readMarketClock(date);
  const day = clock.weekdayIndex;

  if (day < 0) return false;
  if (day >= 1 && day <= 4) return true; // Mon-Thu
  if (day === 5) return clock.hour < MARKET_CLOSE_HOUR_FRIDAY; // Fri until 17:00 ET
  if (day === 0) return clock.hour >= MARKET_OPEN_HOUR_SUNDAY; // Sun from 17:00 ET
  return false; // Sat closed
};

const getForexMarketStatus = (date = new Date()) => {
  const clock = readMarketClock(date);
  const isOpen = isForexMarketOpen(date);

  let reason = "open";
  if (!isOpen) {
    if (
      clock.weekdayIndex === 6 ||
      clock.weekdayIndex === 5 ||
      clock.weekdayIndex === 0
    ) {
      reason = "weekend";
    } else {
      reason = "closed";
    }
  }

  return {
    isOpen,
    reason,
    timezone: MARKET_TIMEZONE,
    marketDay: clock.weekday,
    marketTime: `${pad2(clock.hour)}:${pad2(clock.minute)}:${pad2(clock.second)}`
  };
};

export { isForexMarketOpen, getForexMarketStatus, MARKET_TIMEZONE };
