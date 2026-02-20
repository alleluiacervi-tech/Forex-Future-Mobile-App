const pairToSymbol = {
  "EUR/USD": "FX:EURUSD",
  "GBP/USD": "FX:GBPUSD",
  "USD/JPY": "FX:USDJPY",
  "USD/CHF": "FX:USDCHF",
  "AUD/USD": "FX:AUDUSD",
  "USD/CAD": "FX:USDCAD",
  "NZD/USD": "FX:NZDUSD",
  "EUR/GBP": "FX:EURGBP",
  "EUR/JPY": "FX:EURJPY",
  "GBP/JPY": "FX:GBPJPY",
  "EUR/CHF": "FX:EURCHF",
  "AUD/JPY": "FX:AUDJPY",
  "CAD/JPY": "FX:CADJPY",
  "CHF/JPY": "FX:CHFJPY",
  "AUD/CAD": "FX:AUDCAD",
  "NZD/JPY": "FX:NZDJPY",
  "XAU/USD": "FX:XAUUSD"
};

const symbolToPair = Object.entries(pairToSymbol).reduce((acc, [pair, symbol]) => {
  acc[symbol] = pair;
  return acc;
}, {});

const basePrices = {
  "EUR/USD": 1.0842,
  "GBP/USD": 1.2719,
  "USD/JPY": 148.22,
  "USD/CHF": 0.8732,
  "AUD/USD": 0.6614,
  "USD/CAD": 1.3465,
  "NZD/USD": 0.6111,
  "EUR/GBP": 0.8524,
  "EUR/JPY": 160.7,
  "GBP/JPY": 188.4,
  "EUR/CHF": 0.9527,
  "AUD/JPY": 98.1,
  "CAD/JPY": 110.2,
  "CHF/JPY": 169.7,
  "AUD/CAD": 0.8904,
  "NZD/JPY": 90.5,
  "XAU/USD": 2925.0
};

const supportedPairs = Object.keys(basePrices);
const supportedSymbols = supportedPairs.map((pair) => pairToSymbol[pair]);

export { pairToSymbol, symbolToPair, basePrices, supportedPairs, supportedSymbols };
