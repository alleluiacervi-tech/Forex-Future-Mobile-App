import config from "../config.js";

const GROQ_BASE_URL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
const GROQ_CHAT_COMPLETIONS = `${GROQ_BASE_URL}/chat/completions`;

// Default to a currently supported Groq model; can be overridden via GROQ_MODEL.
const rawDefaultModel = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const DEFAULT_GROQ_MODEL = (rawDefaultModel || "").trim() || "llama-3.1-8b-instant";

/**
 * Small helpers
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const toNumberOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/**
 * Minimal schema validation (no external libs).
 * Ensures required keys exist and types are sane.
 */
const validateRecommendation = (obj) => {
  if (!obj || typeof obj !== "object") return { ok: false, reason: "Response is not an object." };

  const allowedActions = new Set(["BUY", "SELL", "WAIT"]);
  if (!allowedActions.has(obj.action)) return { ok: false, reason: "Invalid action." };

  const conf = toNumberOrNull(obj.confidence);
  if (conf === null || conf < 0 || conf > 100) return { ok: false, reason: "Invalid confidence." };

  // Numeric or null fields
  const numericNullable = [
    "entry",
    "stopLoss",
    "takeProfit1",
    "takeProfit2",
    "positionSizeLots",
    "validityMinutes"
  ];
  for (const k of numericNullable) {
    if (!(k in obj)) return { ok: false, reason: `Missing field: ${k}` };
    if (obj[k] !== null && !Number.isFinite(Number(obj[k]))) return { ok: false, reason: `Invalid number: ${k}` };
  }

  // Strings
  const stringNullable = ["riskReward"];
  for (const k of stringNullable) {
    if (!(k in obj)) return { ok: false, reason: `Missing field: ${k}` };
    if (obj[k] !== null && typeof obj[k] !== "string") return { ok: false, reason: `Invalid type: ${k}` };
  }

  const requiredStrings = ["rationale", "invalidation", "assumptions"];
  for (const k of requiredStrings) {
    if (typeof obj[k] !== "string" || obj[k].trim().length < 5) {
      return { ok: false, reason: `Invalid or too short: ${k}` };
    }
  }

  // keyLevels must be array of numbers (can be empty)
  if (!Array.isArray(obj.keyLevels)) return { ok: false, reason: "keyLevels must be an array." };
  for (const x of obj.keyLevels) {
    if (!Number.isFinite(Number(x))) return { ok: false, reason: "keyLevels must contain only numbers." };
  }

  return { ok: true };
};

/**
 * Try parsing strict JSON. If the model returns extra text (rare), extract last JSON object.
 */
const parseStrictJson = (text) => {
  if (!text || typeof text !== "string") return null;

  // 1) direct parse
  try {
    return JSON.parse(text);
  } catch (_) {}

  // 2) fallback: extract the last {...} block (most likely the JSON)
  const match = text.match(/\{[\s\S]*\}\s*$/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch (_) {
    return null;
  }
};

const parseGroqError = (errorText) => {
  if (!errorText || typeof errorText !== "string") return null;
  try {
    return JSON.parse(errorText);
  } catch (_) {
    return null;
  }
};

/**
 * The upgraded prompt:
 * - Governance gates
 * - Execution realism
 * - Optional LSTM context injection
 * - Strict JSON-only instruction
 */
const buildPrompt = ({
  pair,
  timeframe,
  currentPrice,
  accountBalance,
  riskPercent,
  notes,

  // Optional execution realism
  spreadPips = null,
  slippagePips = null,

  // Optional for accurate sizing
  pipValuePerLot = null,

  // Optional market context (your LSTM outputs)
  lstmContext = null,
  // { trendBias, volatilityRegime, meanReversionPressure, rangeProbability, confidence, notes }

  // Optional governance flags
  session = null, // "ASIA" | "LONDON" | "NY" | null
  newsRisk = null // "NONE" | "LOW" | "MEDIUM" | "HIGH" | null
}) => {
  // sanity clamps
  const riskPct = clamp(Number(riskPercent ?? 0), 0, 5); // cap at 5% by default (pro risk mgmt)
  const acct = Number(accountBalance ?? 0);
  const price = Number(currentPrice ?? 0);

  const schema = `{
  "action": "BUY" | "SELL" | "WAIT",
  "confidence": number (0-100),
  "entry": number | null,
  "stopLoss": number | null,
  "takeProfit1": number | null,
  "takeProfit2": number | null,
  "riskReward": string | null,
  "positionSizeLots": number | null,
  "validityMinutes": number | null,
  "keyLevels": number[],
  "invalidation": string,
  "assumptions": string,
  "rationale": string
}`;

  return `
You are an institutional-grade FX strategist for the Forex Future app.
Your role: produce conservative, execution-realistic trade plans using:
- Smart Money Concepts (liquidity sweeps, displacement, structure shift)
- Supply/Demand zones
- Mean reversion ("rubber band" vs equilibrium)
- Market psychology
- Multi-timeframe alignment (HTF bias -> LTF trigger)

OUTPUT RULE (STRICT):
Return ONLY valid JSON matching this schema exactly (no markdown, no extra text):
${schema}

GOVERNANCE (NON-NEGOTIABLE):
- If confluence is weak OR uncertainty is high -> action MUST be "WAIT".
- For BUY/SELL: Risk/Reward must be >= 1:2.
- Never fabricate values you cannot justify from context.
- If pipValuePerLot is missing, you MUST set positionSizeLots = null and explain in assumptions.

POSITION SIZE:
riskAmount = accountBalance * (riskPercent/100)
stopDistancePips = absolute distance between entry and stopLoss in pips (infer based on pair convention; if unclear, state assumption)
If pipValuePerLot provided:
positionSizeLots = riskAmount / (stopDistancePips * pipValuePerLot)
Else positionSizeLots = null.

RISK FILTERS:
- If newsRisk is HIGH -> default WAIT unless setup is exceptionally clean with defined invalidation.
- If spread/slippage is abnormal -> reduce confidence or WAIT.
- In low-liquidity session (late NY/rollover) -> reduce confidence or WAIT.

CONTEXT INPUTS:
Pair: ${pair}
Timeframe focus: ${timeframe}
Current price: ${price}
Account balance: ${acct}
Risk percent per trade: ${riskPct}
Session: ${session ?? "Unknown"}
News risk: ${newsRisk ?? "Unknown"}
Spread (pips): ${spreadPips ?? "Unknown"}
Slippage (pips): ${slippagePips ?? "Unknown"}
Pip value per 1.00 lot: ${pipValuePerLot ?? "Unknown"}
Notes: ${notes || "None"}

OPTIONAL LSTM MARKET REGIME CONTEXT (use if provided; do not contradict it without reason):
${lstmContext ? JSON.stringify(lstmContext, null, 2) : "None"}

RESPONSE QUALITY:
- Use concise professional language.
- Provide keyLevels (important S/D or liquidity levels).
- Provide invalidation (what would make the idea wrong).
- validityMinutes should be realistic (e.g., 60-360) or null if WAIT.

Return JSON now.
`.trim();
};

/**
 * Fetch with timeout + retries
 */
const fetchWithTimeout = async (url, options, timeoutMs) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
};

/**
 * Main request function
 */
const requestRecommendation = async (payload, opts = {}) => {
  const {
    timeoutMs = 15000,
    maxRetries = 2,
    retryBaseDelayMs = 600
  } = opts;

  if (!config.groqApiKey) {
    throw new Error("Missing GROQ_API_KEY configuration.");
  }

  const model = DEFAULT_GROQ_MODEL;
  const url = GROQ_CHAT_COMPLETIONS;
  const prompt = buildPrompt(payload);

  const requestBody = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    top_p: 0.9,
    max_tokens: 800
  };

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.groqApiKey}`
          },
          body: JSON.stringify(requestBody)
        },
        timeoutMs
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        const parsedError = parseGroqError(errorText);
        const decommissioned =
          parsedError?.error?.code === "model_decommissioned" ||
          String(parsedError?.error?.message || "").toLowerCase().includes("decommissioned");
        const err = new Error(
          decommissioned
            ? "Groq model is decommissioned. Update GROQ_MODEL to a supported model."
            : `Groq API error (${response.status}): ${errorText}`
        );
        const retryableStatus =
          response.status === 408 ||
          response.status === 429 ||
          (response.status >= 500 && response.status <= 599);

        if (retryableStatus && attempt < maxRetries) {
          const backoff = retryBaseDelayMs * Math.pow(2, attempt);
          await sleep(backoff);
          continue;
        }

        throw err;
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content ?? "";
      const parsed = parseStrictJson(text);

      if (!parsed) {
        throw new Error("Unable to parse Groq response as JSON.");
      }

      // Ensure all numeric fields are numbers or null
      const normalized = {
        ...parsed,
        confidence: toNumberOrNull(parsed.confidence) ?? 0,
        entry: parsed.entry === null ? null : toNumberOrNull(parsed.entry),
        stopLoss: parsed.stopLoss === null ? null : toNumberOrNull(parsed.stopLoss),
        takeProfit1: parsed.takeProfit1 === null ? null : toNumberOrNull(parsed.takeProfit1),
        takeProfit2: parsed.takeProfit2 === null ? null : toNumberOrNull(parsed.takeProfit2),
        positionSizeLots:
          parsed.positionSizeLots === null ? null : toNumberOrNull(parsed.positionSizeLots),
        validityMinutes:
          parsed.validityMinutes === null ? null : toNumberOrNull(parsed.validityMinutes),
        keyLevels: Array.isArray(parsed.keyLevels) ? parsed.keyLevels.map(Number) : []
      };

      const validation = validateRecommendation(normalized);
      if (!validation.ok) {
        throw new Error(`Invalid model output schema: ${validation.reason}`);
      }

      return normalized;
    } catch (err) {
      lastError = err;

      // Retry on network/timeout errors (not on validation issues)
      const msg = String(err?.message || "");
      const isAbort = msg.includes("aborted") || msg.toLowerCase().includes("abort");
      const isNetwork = msg.toLowerCase().includes("network");

      if (attempt < maxRetries && (isAbort || isNetwork)) {
        const backoff = retryBaseDelayMs * Math.pow(2, attempt);
        await sleep(backoff);
        continue;
      }

      break;
    }
  }

  throw lastError ?? new Error("Unknown error requesting recommendation.");
};

export { requestRecommendation };
