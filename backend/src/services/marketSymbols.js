const pairToSymbol = {
  "EUR/USD": "OANDA:EUR_USD",
  "GBP/USD": "OANDA:GBP_USD",
  "USD/JPY": "OANDA:USD_JPY",
  "USD/CHF": "OANDA:USD_CHF",
  "AUD/USD": "OANDA:AUD_USD",
  "NZD/USD": "OANDA:NZD_USD"
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
  "NZD/USD": 0.6111
};

const supportedPairs = Object.keys(basePrices);
const supportedSymbols = supportedPairs.map((pair) => pairToSymbol[pair]);

export { pairToSymbol, symbolToPair, basePrices, supportedPairs, supportedSymbols };
