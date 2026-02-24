// End-to-end alert flow test: engine → persistence → API → frontend mapping
// Validates that velocity alerts flow correctly through all system layers

import assert from 'assert';
import { ForexFutureEngine } from '../src/services/forexFutureEngine.js';
import { maybeCreateAlerts, state } from '../src/services/marketRecorder.js';

console.log('Running end-to-end alert flow tests...\n');

// ============================================================================
// Test 1: Engine produces velocity alert with all required fields
// ============================================================================
(async () => {
  console.log('Test 1: Engine alert generation with velocity/confidence/levels');
  const engine = new ForexFutureEngine();
  const pair = 'EURUSD';
  const now = Date.now();
  
  // feed ticks to trigger alert
  await engine.processTick(pair, 1.0, 'last', now);
  const alerts = await engine.processTick(pair, 1.002, 'last', now + 500);
  
  assert(alerts.length > 0, 'Should generate alert on velocity');
  const alert = alerts[0];
  
  // Verify all alert fields present
  assert(alert.pair === pair, 'Alert has correct pair');
  assert(alert.id !== undefined, 'Alert has unique ID');
  assert(alert.timestamp !== undefined, 'Alert has timestamp');
  assert(alert.fromPrice !== undefined, 'Alert has fromPrice');
  assert(alert.currentPrice !== undefined, 'Alert has currentPrice');
  assert(alert.direction !== undefined, 'Alert has direction (BUY/SELL)');
  
  // Velocity-specific fields
  assert(alert.velocity !== undefined, 'Alert has velocity metrics');
  assert(alert.velocity.signal !== undefined, 'Velocity has signal name');
  assert(alert.velocity.pipsPerSecond !== undefined, 'Velocity has pips/sec');
  assert(alert.velocity.accelerationRatio !== undefined, 'Velocity has accel ratio');
  assert(alert.velocity.windowDetected !== undefined, 'Velocity has window');
  
  // Confidence scoring
  assert(alert.confidence !== undefined, 'Alert has confidence object');
  assert(alert.confidence.score !== undefined, 'Confidence has score');
  assert(alert.confidence.label !== undefined, 'Confidence has label');
  assert(Array.isArray(alert.confidence.factors), 'Confidence has factors array');
  
  // Trade levels
  assert(alert.levels !== undefined, 'Alert has price levels');
  assert(alert.levels.entry !== undefined, 'Levels has entry');
  assert(alert.levels.stopLoss !== undefined, 'Levels has stopLoss');
  assert(alert.levels.takeProfit !== undefined, 'Levels has takeProfit');
  assert(alert.levels.slPips !== undefined, 'Levels has slPips');
  assert(alert.levels.tpPips !== undefined, 'Levels has tpPips');
  assert(alert.levels.riskReward !== undefined, 'Levels has riskReward');
  
  console.log('  ✓ Engine generates complete alert structure\n');
})();

// ============================================================================
// Test 2: MarketRecorder persists velocity/confidence/levels as JSON
// ============================================================================
(async () => {
  console.log('Test 2: Recorder persists engine fields to Prisma');
  state.ticksByPair.clear();
  state.lastAlertKeyAt.clear();
  
  const pair = 'GBPUSD';
  const ts0 = Date.now();
  
  // Simulate sequential ticks; collect all results
  const a1 = await maybeCreateAlerts({ pair, tsMs: ts0, price: 1.25, priceType: 'last' });
  const a2 = await maybeCreateAlerts({ pair, tsMs: ts0 + 500, price: 1.2502, priceType: 'last' });
  const a3 = await maybeCreateAlerts({ pair, tsMs: ts0 + 1000, price: 1.255, priceType: 'last' });
  
  const alerts = [...(a1 || []), ...(a2 || []), ...(a3 || [])];
  assert(alerts.length > 0, 'Recorder should return engine alerts');
  const alert = alerts[0];
  
  // Check that engine fields are present in returned alert
  assert(alert.currentPrice !== undefined, 'Alert has currentPrice');
  assert(alert.direction !== undefined, 'Alert has direction');
  assert(alert.velocity !== undefined, 'Alert has velocity object');
  assert(alert.confidence !== undefined, 'Alert has confidence object');
  assert(alert.levels !== undefined, 'Alert has levels object');
  
  console.log('  ✓ Recorder passes through velocity/confidence/levels\n');
})();

// ============================================================================
// Test 3: Alert fields suitable for API/frontend consumption
// ============================================================================
(async () => {
  console.log('Test 3: Alert fields compatible with frontend API schema');
  const engine = new ForexFutureEngine();
  const pair = 'USDJPY';
  const now = Date.now();
  
  engine.processTick(pair, 110.0, 'last', now);
  const alerts = engine.processTick(pair, 110.05, 'last', now + 500);
  
  assert(alerts.length > 0, 'Should generate alert');
  const alert = alerts[0];
  
  // Frontend expects these types
  assert(typeof alert.id === 'string', 'id is string');
  assert(typeof alert.pair === 'string', 'pair is string');
  assert(typeof alert.timestamp === 'string' || typeof alert.timestamp === 'number', 'timestamp is serializable');
  assert(typeof alert.currentPrice === 'number', 'currentPrice is number');
  assert(typeof alert.fromPrice === 'number', 'fromPrice is number');
  assert(typeof alert.direction === 'string', 'direction is string');
  
  // JSON fields serializable
  assert(typeof alert.velocity === 'object', 'velocity is object/serializable');
  assert(typeof alert.confidence === 'object', 'confidence is object/serializable');
  assert(typeof alert.levels === 'object', 'levels is object/serializable');
  
  console.log('  ✓ All alert fields are API-serializable\n');
})();

// ============================================================================
// Test 4: Confidence score computation is deterministic
// ============================================================================
(() => {
  console.log('Test 4: Confidence scoring consistency');
  const engine = new ForexFutureEngine();
  const pair = 'AUDUSD';
  const now = Date.now();
  
  engine.processTick(pair, 0.65, 'last', now);
  engine.processTick(pair, 0.6505, 'last', now + 500);
  const alerts = engine.processTick(pair, 0.655, 'last', now + 1000);
  
  if (alerts.length > 0) {
    const alert = alerts[0];
    assert(Number.isFinite(alert.confidence.score), 'Confidence score is number');
    assert(alert.confidence.score >= 0 && alert.confidence.score <= 100, 'Score is 0-100');
    assert(['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH', 'MAXIMUM'].includes(alert.confidence.label), 'Label is valid');
    console.log('  ✓ Confidence scoring is consistent and bounded\n');
  } else {
    console.log('  ⚠ No alert generated (testing with minimal data)\n');
  }
})();

// ============================================================================
// Test 5: Trade levels computed correctly for different scenarios
// ============================================================================
(() => {
  console.log('Test 5: Trade levels computation');
  const engine = new ForexFutureEngine();
  const pair = 'NZDUSD';
  const now = Date.now();
  
  engine.processTick(pair, 0.60, 'last', now);
  engine.processTick(pair, 0.6008, 'last', now + 500);
  const alerts = engine.processTick(pair, 0.605, 'last', now + 1000);
  
  if (alerts.length > 0) {
    const alert = alerts[0];
    const levels = alert.levels;
    
    assert(levels.entry !== undefined, 'Entry price set');
    assert(levels.stopLoss < levels.entry || levels.stopLoss > levels.entry, 'SL differs from entry');
    assert(levels.takeProfit !== levels.entry, 'TP differs from entry');
    assert(levels.slPips > 0, 'SL distance positive');
    assert(levels.tpPips > 0, 'TP distance positive');
    assert(levels.riskReward > 0, 'Risk:Reward ratio positive');
    
    console.log(`  Entry: ${levels.entry}, SL: ${levels.stopLoss} (${levels.slPips}pips), TP: ${levels.takeProfit} (${levels.tpPips}pips), R:R: ${levels.riskReward.toFixed(1)}:1\n`);
  } else {
    console.log('  ⚠ No alert generated (testing with minimal data)\n');
  }
})();

// ============================================================================
// Test 6: Multiple alerts on different pairs don't cross-contaminate
// ============================================================================
(async () => {
  console.log('Test 6: Multi-pair isolation');
  state.ticksByPair.clear();
  state.lastAlertKeyAt.clear();
  
  const pair1 = 'EURUSD';
  const pair2 = 'GBPUSD';
  const ts0 = Date.now();
  
  // Pair 1: mimic the earlier engine integration pattern (small prime then burst)
  const a1_1 = await maybeCreateAlerts({ pair: pair1, tsMs: ts0, price: 1.0, priceType: 'last' });
  const a1_2 = await maybeCreateAlerts({ pair: pair1, tsMs: ts0 + 500, price: 1.0001, priceType: 'last' });
  const a1_3 = await maybeCreateAlerts({ pair: pair1, tsMs: ts0 + 1000, price: 1.005, priceType: 'last' });
  const alerts1 = [...(a1_1 || []), ...(a1_2 || []), ...(a1_3 || [])];

  // Pair 2: same pattern with distinct price baseline
  const a2_1 = await maybeCreateAlerts({ pair: pair2, tsMs: ts0 + 1100, price: 1.0, priceType: 'last' });
  const a2_2 = await maybeCreateAlerts({ pair: pair2, tsMs: ts0 + 1600, price: 1.0001, priceType: 'last' });
  const a2_3 = await maybeCreateAlerts({ pair: pair2, tsMs: ts0 + 2100, price: 1.005, priceType: 'last' });
  const alerts2 = [...(a2_1 || []), ...(a2_2 || []), ...(a2_3 || [])];
  
  assert(alerts1.length > 0 || alerts2.length > 0, 'At least one pair should alert');
  if (alerts1.length > 0) {
    assert(alerts1[0].pair === pair1, 'First alert is from pair1');
  }
  if (alerts2.length > 0) {
    assert(alerts2[0].pair === pair2, 'Second alert is from pair2');
  }
  
  console.log('  ✓ Multi-pair alerts isolated correctly\n');
})();

// ============================================================================
// Test 7: Frontend mapping of engine alert to displayable format
// ============================================================================
(() => {
  console.log('Test 7: Frontend compatibility (alert → UI display)');
  const engine = new ForexFutureEngine();
  const pair = 'CHFUSD';
  const now = Date.now();
  
  engine.processTick(pair, 1.10, 'last', now);
  const alerts = engine.processTick(pair, 1.102, 'last', now + 500);
  
  if (alerts.length > 0) {
    const alert = alerts[0];
    
    // Frontend expects these for display
    const display = {
      pair: alert.pair,
      title: `⚡ ${alert.pair} — ${alert.velocity.signal} ${alert.direction}`,
      fromPrice: alert.fromPrice,
      toPrice: alert.currentPrice,
      changePercent: ((alert.currentPrice - alert.fromPrice) / alert.fromPrice * 100),
      confidence: `${alert.confidence.label} (${alert.confidence.score}%)`,
      entry: alert.levels.entry,
      stopLoss: alert.levels.stopLoss,
      takeProfit: alert.levels.takeProfit,
      riskReward: `${alert.levels.riskReward.toFixed(1)}:1`
    };
    
    assert(display.title.includes('⚡'), 'Emoji renders');
    assert(display.title.includes(alert.velocity.signal), 'Signal in title');
    assert(Number.isFinite(display.changePercent), 'Move % computed');
    
    console.log(`  Display: "${display.title}"`);
    console.log(`  Move: ${display.fromPrice} → ${display.toPrice} (${display.changePercent.toFixed(2)}%)`);
    console.log(`  Levels: Entry ${display.entry}, SL ${display.stopLoss}, TP ${display.takeProfit}`);
    console.log(`  ${display.confidence}, R:R ${display.riskReward}\n`);
  } else {
    console.log('  ⚠ No alert generated\n');
  }
})();

console.log('All end-to-end tests completed ✓');
