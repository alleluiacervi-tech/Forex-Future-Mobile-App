const FCSClient = require('./fcs-client-lib.js');

const API_KEY = process.env.FCS_API_KEY || 'fcs_socket_demo';
const WS_URL = process.env.FCS_WS_URL || 'wss://ws-v4.fcsapi.com/ws';

const pairs = [
  'FX:EURUSD',
  'FX:GBPUSD',
  'FX:USDJPY',
  'FX:USDCHF',
  'FX:AUDUSD',
  'FX:USDCAD',
  'FX:NZDUSD',
  'FX:EURGBP',
  'FX:EURJPY',
  'FX:GBPJPY',
  'FX:EURCHF',
  'FX:AUDJPY',
  'FX:CADJPY',
  'FX:CHFJPY',
  'FX:AUDCAD',
  'FX:NZDJPY',
];

// Metals (if enabled on your key/plan)
const metals = ['FX:XAUUSD'];

const timeframe = process.env.FCS_TIMEFRAME || '60';
const subscriptions = [...pairs, ...metals].map((symbol) => ({
  symbol,
  timeframe,
}));

function maskKey(key) {
  if (!key || key.length <= 8) return key || 'undefined';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

const client = new FCSClient(API_KEY, WS_URL);
client.reconnectDelay = 5000;
client.reconnectlimit = 10;

client.onconnected = () => {
  console.log(`Connected and authenticated (${maskKey(API_KEY)})`);
  subscriptions.forEach(({ symbol, timeframe }) => {
    client.join(symbol, timeframe);
    console.log(`Joined ${symbol} @ ${timeframe}`);
  });
};

client.onmessage = (data) => {
  if (data.type === 'price') {
    console.log(`${data.symbol} [${data.timeframe}] =>`, data.prices);
    return;
  }

  if (data.type === 'error') {
    console.error('Server error:', data);
    if (data.short === 'authentication_failed') {
      console.error(
        'Authentication failed: use a valid WebSocket API key or test with FCS_API_KEY=fcs_socket_demo'
      );
      client.disconnect();
      process.exitCode = 1;
    }
    return;
  }

  console.log('Info:', data);
};

client.onreconnect = () => {
  console.log('Reconnected to FCS WebSocket');
};

client.onclose = (event) => {
  console.log(`Disconnected (code=${event.code}, reason=${event.reason || 'none'})`);
};

client.onerror = (err) => {
  console.error('WebSocket error:', err.message || err);
};

client
  .connect()
  .then(() => {
    console.log(`Opening socket to ${WS_URL}`);
  })
  .catch((err) => {
    console.error('Connection failed:', err.message || err);
    process.exitCode = 1;
  });

process.on('SIGINT', () => {
  console.log('\nClosing socket...');
  client.disconnect();
  process.exit(0);
});
