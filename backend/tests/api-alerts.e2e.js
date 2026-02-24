import assert from 'assert';
import express from 'express';
import request from 'supertest';
import marketRoutes from '../src/routes/market.js';
import prisma from '../src/db/prisma.js';
import { maybeCreateAlerts, state } from '../src/services/marketRecorder.js';

console.log('Running API /alerts integration test...');

(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/market', marketRoutes);

  // clear recorder state to avoid stale data
  state.ticksByPair.clear();
  state.lastAlertKeyAt.clear();

  const pair = 'EURUSD';
  const ts0 = Date.now();

  // generate at least one alert via recorder
  await maybeCreateAlerts({ pair, tsMs: ts0, price: 1.0, priceType: 'last' });
  await maybeCreateAlerts({ pair, tsMs: ts0 + 500, price: 1.0001, priceType: 'last' });
  await maybeCreateAlerts({ pair, tsMs: ts0 + 1000, price: 1.005, priceType: 'last' });

  // if prisma is present but disabled, force in-memory fallback for consistency
  if (prisma && prisma.marketAlert) {
    prisma.marketAlert = null;
  }
  const res = await request(app).get('/api/market/alerts?limit=10');
  assert(res.status === 200, 'expected 200 status');
  const alerts = res.body.alerts;
  assert(Array.isArray(alerts), 'alerts should be an array');
  const found = alerts.find((a) => a.pair === pair);
  assert(found, 'should include alert for EURUSD');
  assert(found.velocity, 'returned alert should include velocity object');
  assert(found.confidence, 'returned alert should include confidence object');
  assert(found.fromPrice !== undefined, 'returned alert should include fromPrice');
  console.log('API /alerts test passed');
})();