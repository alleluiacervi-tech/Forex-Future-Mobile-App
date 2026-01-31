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
```

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

- `POST /api/auth/register` – Register a new user.
- `POST /api/auth/login` – Login and receive a JWT.
- `GET /api/auth/me` – Get the current user profile.
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

The backend emits live FX prices to all clients every heartbeat interval.

```json
{
  "type": "rates",
  "data": [
    {
      "pair": "EUR/USD",
      "bid": 1.0841,
      "ask": 1.0845,
      "mid": 1.0843,
      "timestamp": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

## Notes

The footprint endpoints provide heuristic signals (supply/demand zones, accumulation/distribution, mean-reversion stretch, and multi-timeframe bias). They are designed to help professional decision-making but are not guarantees. Replace the mock pricing service with a real market data feed in production and secure secrets with a proper vault or managed secret store.

## Groq AI Recommendations

The recommendations endpoint uses the Groq API to return BUY/SELL/WAIT guidance with professional reasoning based on supply/demand, smart money concepts, and market psychology. It also calculates suggested position size based on user risk settings. Ensure `GROQ_API_KEY` is configured before calling `POST /api/recommendations`.
