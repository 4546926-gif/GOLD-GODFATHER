# GOLD EDGE AI

A self-hostable XAUUSD market-analysis dashboard. The backend proxies Twelve Data requests so the API key is not shipped to the browser.

## Run locally

1. Install Node.js 18 or newer.
2. Copy `.env.example` to `.env`.
3. Add your **new** Twelve Data API key to `.env`:
   `TWELVE_DATA_API_KEY=...`
4. In this folder run:
   ```bash
   npm install
   npm start
   ```
5. Open http://localhost:3000

## Deploy

Deploy this Node/Express project to a Node-compatible host such as Render, Railway, Fly.io, or a VPS. Set these environment variables in the host dashboard:

- `TWELVE_DATA_API_KEY` (secret)
- `XAUUSD_SYMBOL` (optional; default `XAU/USD`)
- `PORT` (usually supplied by the host)

Do not commit `.env` or paste API keys into frontend code or public repositories. Since the API key was posted in a chat, revoke it at Twelve Data and create a fresh one before using this project.

## Important limitations

- This is a starter trading research tool, not a broker-connected execution system.
- The technical rules are transparent heuristic approximations. Swing structure, order blocks, FVGs and liquidity are not universally standardized; they need strategy review and historical validation before live use.
- The "11 checks" are rule checks, not proof of an 11-factor edge or a 100% win probability. A+ means all programmed checks pass, not that a trade is guaranteed.
- The chart and analysis use closed provider candles as returned by Twelve Data. Verify symbol availability, timestamps, subscription limits, spread, and market-session behavior for your account.
- News events are entered manually; there is no automatic economic calendar integration yet.
- The journal currently records generated signals as OPEN. It does not yet automatically resolve wins/losses or calculate verified profit factor, drawdown, or backtest statistics. Do not interpret the empty performance metrics as a verified track record.
- No broker order placement is implemented.

## Security

The API key is stored only in the server environment and is used by `/api/candles`. For a public multi-user deployment, add authentication, rate limiting, and per-user access controls before launch.
