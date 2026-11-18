import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.TWELVE_DATA_API_KEY;
const SYMBOL = process.env.XAUUSD_SYMBOL || "XAU/USD";

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const intervals = {
  "1m": "1min", "5m": "5min", "15m": "15min",
  "1h": "1h", "4h": "4h", "1d": "1day"
};

app.get("/api/health", (_req, res) => {
  res.json({ configured: Boolean(API_KEY), symbol: SYMBOL });
});

app.get("/api/candles", async (req, res) => {
  if (!API_KEY) return res.status(503).json({ error: "Add TWELVE_DATA_API_KEY to your server environment." });
  const tf = String(req.query.tf || "5m").toLowerCase();
  const interval = intervals[tf];
  if (!interval) return res.status(400).json({ error: "Unsupported timeframe." });

  try {
    const url = new URL("https://api.twelvedata.com/time_series");
    url.searchParams.set("symbol", SYMBOL);
    url.searchParams.set("interval", interval);
    url.searchParams.set("outputsize", "500");
    url.searchParams.set("format", "JSON");
    url.searchParams.set("apikey", API_KEY);
    const upstream = await fetch(url);
    const payload = await upstream.json();
    if (!upstream.ok || payload.status === "error" || !payload.values) {
      return res.status(502).json({ error: payload.message || "Market data provider did not return candle data.", provider: "Twelve Data" });
    }
    const values = payload.values.slice().reverse().map(c => ({
      time: Math.floor(new Date(c.datetime.replace(" ", "T") + (c.datetime.includes("Z") ? "" : "Z")).getTime() / 1000),
      open: Number(c.open), high: Number(c.high), low: Number(c.low),
      close: Number(c.close), volume: Number(c.volume || 0)
    })).filter(c => Number.isFinite(c.time) && Number.isFinite(c.close));
    res.set("Cache-Control", "no-store").json({
      symbol: SYMBOL, interval: tf, values,
      fetchedAt: new Date().toISOString(),
      providerTimeZone: payload.meta?.timezone || "provider supplied"
    });
  } catch (err) {
    res.status(500).json({ error: "Could not reach market data provider.", detail: err.message });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`GOLD EDGE AI running on http://localhost:${PORT}`));
