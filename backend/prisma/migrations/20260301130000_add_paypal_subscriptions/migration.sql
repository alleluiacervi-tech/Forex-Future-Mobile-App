-- PayPal subscriptions and payment tracking tables
CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "plan" VARCHAR(20) NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "trial_end" TIMESTAMP(3),
  "current_period_end" TIMESTAMP(3),
  "grace_period_end" TIMESTAMP(3),
  "card_fingerprint" TEXT,
  "payer_id" TEXT,
  "paypal_subscription_id" TEXT UNIQUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions"("user_id");
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX IF NOT EXISTS "subscriptions_card_fingerprint_idx" ON "subscriptions"("card_fingerprint");
CREATE INDEX IF NOT EXISTS "subscriptions_payer_id_idx" ON "subscriptions"("payer_id");

CREATE TABLE IF NOT EXISTS "payment_events" (
  "id" SERIAL PRIMARY KEY,
  "user_id" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "event_type" VARCHAR(50) NOT NULL,
  "paypal_event_id" TEXT UNIQUE,
  "paypal_subscription_id" TEXT,
  "amount" DECIMAL(10,2),
  "status" VARCHAR(20),
  "raw_event" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "payment_events_user_id_idx" ON "payment_events"("user_id");
CREATE INDEX IF NOT EXISTS "payment_events_paypal_subscription_id_idx" ON "payment_events"("paypal_subscription_id");

CREATE TABLE IF NOT EXISTS "trial_fingerprints" (
  "id" SERIAL PRIMARY KEY,
  "card_fingerprint" TEXT UNIQUE NOT NULL,
  "user_id" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "trial_fingerprints_user_id_idx" ON "trial_fingerprints"("user_id");
