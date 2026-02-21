# Forex Trading App Backend

A production-ready Node.js/Express backend for the Forex Trading App. It uses PostgreSQL with Prisma ORM, JWT auth, and WebSocket streaming for live market data.

## Features

- JWT authentication with hashed passwords (bcrypt)
- PostgreSQL persistence with Prisma ORM
- WebSocket feed for live FX prices
- Trading endpoints for orders, positions, and transactions
- Portfolio analytics (equity, unrealized PnL)
- Arcjet protection for bot blocking, rate limiting, and WAF shielding

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database

### Installation

```bash
cd backend
npm install
```

### Configure Environment

Create a `.env` file in `backend`:

```bash
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/forex
JWT_SECRET=change-me
JWT_EXPIRES_IN=2h
WS_HEARTBEAT_MS=15000
ARCJET_KEY=your-arcjet-key

# Market data (FCS WebSocket v4)
FCS_API_KEY=your-fcs-websocket-api-key
# Optional: override WS base URL (access_key is auto-appended if missing)
# FCS_WS_URL=wss://ws-v4.fcsapi.com/ws
# Optional: timeframe for join_symbol subscriptions
# FCS_WS_TIMEFRAME=60
# If FCS_API_KEY is omitted, backend uses demo key: fcs_socket_demo
# Optional (dev): start backend without upstream WS
# ALLOW_NO_FCS_WS=true

# Email (SMTP) - optional
# EMAIL_USER=your_email@example.com
# EMAIL_APP_PASSWORD=your_app_password_here
# Optional: enable protected validation endpoints
# EMAIL_VALIDATION_TOKEN=change-me-to-a-long-random-string
```

You can also start from `backend/.env.example` and fill in values.

### Security Hardening (Arcjet)

Arcjet is wired into the backend at three levels:

- Baseline protection for all `/api/*` routes (`shield`, bot detection, token-bucket limit)
- Additional strict limit for `/api/auth/*`
- Additional strict limit for `/api/admin/*`

Recommended rollout:

1. Set `ARCJET_MODE=DRY_RUN` and verify behavior/logs.
2. Configure trusted proxies (`TRUST_PROXY`, `ARCJET_TRUSTED_PROXIES`) for your deployment.
3. Switch to `ARCJET_MODE=LIVE` in production after validation.

If Arcjet is unavailable, the backend is fail-open by default (`ARCJET_FAIL_CLOSED=false`) to preserve uptime. Set `ARCJET_FAIL_CLOSED=true` for strict enforcement.

### Database Setup

```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

### Run the Server

```bash
npm run start
```

The API will run on `http://localhost:4000` and the WebSocket server will be available at `ws://localhost:4000/ws/market`.

## API Overview

- `POST /api/auth/register` – Register a new user (starts email verification).
- `POST /api/auth/email/verify` – Verify email using a code.
- `POST /api/auth/email/resend` – Resend a verification code.
- `POST /api/auth/trial/start` – Activate free trial (requires verified email).
- `POST /api/auth/login` – Login and receive a JWT (requires verified email + active trial).
- `GET /api/auth/me` – Get the current user profile (protected).
- `POST /api/auth/password/change` – Change password (protected).
- `POST /api/auth/password/forgot` – Request a password reset email.
- `POST /api/auth/password/reset` – Reset password using a token.

Default email verification deep link (if `EMAIL_VERIFY_URL` is unset):
`forexapp://verify-email?email={email}&code={code}`

- `GET /api/market/pairs` – List supported FX pairs with live pricing.
- `GET /api/market/history/:pair` – Get mock historical prices.
- `GET /api/market/alerts` – List recent smart alerts (big-move volatility triggers).
- `GET /api/market/footprints/:pair` – Institutional footprint signals (zones, smart money, rubber band, timeframe bias).
- `POST /api/trades/orders` – Place a trade order.
- `GET /api/trades/orders` – List orders.
- `GET /api/portfolio/summary` – Portfolio snapshot.
- `GET /api/portfolio/positions` – List open positions.
- `GET /api/portfolio/transactions` – List transactions.
- `GET /api/users/me` – Get user settings.
- `PUT /api/users/me` – Update user settings.

## WebSocket Events

Connect to the market WebSocket at `ws://localhost:4000/ws/market`.

The server relays normalized market messages (JSON). You’ll typically receive `trade` updates in this format:

```json
{
  "type": "trade",
  "data": [
    {
      "s": "FX:EURUSD",
      "p": 1.0843,
      "t": 1704110400000,
      "v": 100000
    }
  ]
}
```

## Email Validation (Optional)

If you configure SMTP credentials, you can validate them via protected endpoints:

- `POST /api/email/validate` – Verifies SMTP connectivity/auth.
- `POST /api/email/send-test` – Sends a test email (defaults to `EMAIL_TEST_RECIPIENT` or `EMAIL_USER`).

These endpoints are **disabled** unless `EMAIL_VALIDATION_TOKEN` is set. Provide the header:

- `x-email-validation-token: <EMAIL_VALIDATION_TOKEN>`

## Forgot Password (Password Reset)

Configure SMTP (`EMAIL_USER`, `EMAIL_APP_PASSWORD`) and optionally a deep link / URL to include in reset emails:

- `PASSWORD_RESET_URL=forexapp://reset-password?token={token}`

If `PASSWORD_RESET_URL` is omitted, backend falls back to:

- `forexapp://reset-password?token={token}`

Endpoints:

- `POST /api/auth/password/forgot` with `{ "email": "user@example.com" }`
- `POST /api/auth/password/reset` with `{ "token": "...", "newPassword": "NewPass123" }`

Quick test (local):

```bash
# 1) Start backend
cd backend && npm run dev

# 2) Request reset (check your inbox)
curl -sS -X POST http://localhost:4000/api/auth/password/forgot \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com"}'
```

## Notes

The footprint endpoints provide heuristic signals (supply/demand zones, accumulation/distribution, mean-reversion stretch, and multi-timeframe bias). They are designed to help professional decision-making but are not guarantees. Replace the mock pricing service with a real market data feed in production and secure secrets with a proper vault or managed secret store.
