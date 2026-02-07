# Forex Trading App Backend

A production-ready Node.js/Express backend for the Forex Trading App. It uses PostgreSQL with Prisma ORM, JWT auth, and WebSocket streaming for live market data.

## Features

- JWT authentication with hashed passwords (bcrypt)
- PostgreSQL persistence with Prisma ORM
- WebSocket feed for live FX prices
- Trading endpoints for orders, positions, and transactions
- Portfolio analytics (equity, unrealized PnL)

## Getting Started

### Prerequisites

- Node.js 18+
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
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=llama-3.1-70b-versatile

# Market data (Finnhub)
FINNHUB_API_KEY=your-finnhub-api-key
# Optional: override full WS URL (otherwise built from FINNHUB_API_KEY)
# FINNHUB_WS_URL=wss://ws.finnhub.io?token=...
# Optional (dev): start backend without upstream WS
# ALLOW_NO_FINNHUB_WS=true

# Email (SMTP) - optional
# EMAIL_USER=your_email@example.com
# EMAIL_APP_PASSWORD=your_app_password_here
# Optional: enable protected validation endpoints
# EMAIL_VALIDATION_TOKEN=change-me-to-a-long-random-string
```

You can also start from `backend/.env.example` and fill in values.

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
- `GET /api/market/pairs` – List supported FX pairs with live pricing.
- `GET /api/market/history/:pair` – Get mock historical prices.
- `GET /api/market/footprints/:pair` – Institutional footprint signals (zones, smart money, rubber band, timeframe bias).
- `POST /api/trades/orders` – Place a trade order.
- `GET /api/trades/orders` – List orders.
- `GET /api/portfolio/summary` – Portfolio snapshot.
- `GET /api/portfolio/positions` – List open positions.
- `GET /api/portfolio/transactions` – List transactions.
- `GET /api/users/me` – Get user settings.
- `PUT /api/users/me` – Update user settings.
- `POST /api/recommendations` – Generate institutional-grade AI trade guidance.
- `GET /api/recommendations` – List AI trade recommendations.

## WebSocket Events

Connect to the market WebSocket at `ws://localhost:4000/ws/market`.

The server relays Finnhub WebSocket messages (JSON). You’ll typically receive `trade` updates in Finnhub’s format:

```json
{
  "type": "trade",
  "data": [
    {
      "s": "OANDA:EUR_USD",
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

## Groq AI Recommendations

The recommendations endpoint uses the Groq API to return BUY/SELL/WAIT guidance with professional reasoning based on supply/demand, smart money concepts, and market psychology. It also calculates suggested position size based on user risk settings. Ensure `GROQ_API_KEY` is configured before calling `POST /api/recommendations`.
