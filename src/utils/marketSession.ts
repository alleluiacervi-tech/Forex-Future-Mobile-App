const FOREX_MARKET_TIMEZONE = 'America/New_York';
const FOREX_OPEN_HOUR_SUNDAY = 17;
const FOREX_CLOSE_HOUR_FRIDAY = 17;

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const pad2 = (value: number) => String(value).padStart(2, '0');

const readMarketClock = (date: Date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: FOREX_MARKET_TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || '0');
  const second = Number(parts.find((p) => p.type === 'second')?.value || '0');

  return {
    weekday,
    weekdayIndex: Number.isFinite(WEEKDAY_TO_INDEX[weekday]) ? WEEKDAY_TO_INDEX[weekday] : -1,
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
    second: Number.isFinite(second) ? second : 0,
  };
};

export type ForexMarketStatus = {
  isOpen: boolean;
  reason: 'open' | 'weekend' | 'closed';
  timezone: string;
  marketDay: string;
  marketTime: string;
};

export const isForexMarketOpen = (date: Date = new Date()) => {
  const clock = readMarketClock(date);
  const day = clock.weekdayIndex;

  if (day < 0) return false;
  if (day >= 1 && day <= 4) return true; // Monday-Thursday
  if (day === 5) return clock.hour < FOREX_CLOSE_HOUR_FRIDAY; // Friday until 17:00 ET
  if (day === 0) return clock.hour >= FOREX_OPEN_HOUR_SUNDAY; // Sunday from 17:00 ET
  return false; // Saturday closed
};

export const getForexMarketStatus = (date: Date = new Date()): ForexMarketStatus => {
  const clock = readMarketClock(date);
  const isOpen = isForexMarketOpen(date);

  let reason: ForexMarketStatus['reason'] = 'open';
  if (!isOpen) {
    if (clock.weekdayIndex === 0 || clock.weekdayIndex === 5 || clock.weekdayIndex === 6) {
      reason = 'weekend';
    } else {
      reason = 'closed';
    }
  }

  return {
    isOpen,
    reason,
    timezone: FOREX_MARKET_TIMEZONE,
    marketDay: clock.weekday,
    marketTime: `${pad2(clock.hour)}:${pad2(clock.minute)}:${pad2(clock.second)}`,
  };
};
