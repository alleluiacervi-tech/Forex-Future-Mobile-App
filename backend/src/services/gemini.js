import config from "../config.js";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_ENDPOINT = (model) => `${GEMINI_BASE_URL}/models/${model}:generateContent`;
const GEMINI_LIST_MODELS = `${GEMINI_BASE_URL}/models`;

const normalizeModelName = (name) => (name || "").replace(/^models\//, "");
const rawDefaultModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const DEFAULT_GEMINI_MODEL = normalizeModelName(rawDefaultModel).startsWith("gemini")
  ? normalizeModelName(rawDefaultModel)
  : "gemini-1.5-flash";

const selectFallbackModel = (models = []) => {
  const eligible = models.filter((m) =>
    Array.isArray(m?.supportedGenerationMethods)
      ? m.supportedGenerationMethods.includes("generateContent")
      : false
  );
  const normalized = eligible
    .map((m) => normalizeModelName(m.name || m))
    .filter((name) => name.startsWith("gemini"));
  const preferred = [
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-pro-002",
    "gemini-1.5-pro-001",
    "gemini-1.5-pro",
    "gemini-1.0-pro"
  ];
  for (const candidate of preferred) {
    if (normalized.includes(candidate)) return candidate;
  }
  return normalized[0] || DEFAULT_GEMINI_MODEL;
};

const listModels = async (apiKey) => {
  const res = await fetch(`${GEMINI_LIST_MODELS}?key=${apiKey}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini listModels error (${res.status}): ${body}`);
  }
  const data = await res.json();
  return Array.isArray(data?.models) ? data.models : [];
};

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
 * Try parsing strict JSON. If Gemini returns extra text (rare), extract last JSON object.
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

  if (!config.geminiApiKey) {
    throw new Error("Missing GEMINI_API_KEY configuration.");
  }

  const model = normalizeModelName(DEFAULT_GEMINI_MODEL);
  const url = `${GEMINI_ENDPOINT(model)}?key=${config.geminiApiKey}`;
  const prompt = buildPrompt(payload);

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 800
      // Some environments support forcing JSON:
      // responseMimeType: "application/json"
    }
  };

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        },
        timeoutMs
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const parsed = parseStrictJson(text);

      if (!parsed) {
        throw new Error("Unable to parse Gemini response as JSON.");
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

      // Retry only on network/timeout/5xx-ish errors, not on validation issues
      const msg = String(err?.message || "");
      const isAbort = msg.includes("aborted") || msg.toLowerCase().includes("abort");
      const isNetwork = msg.toLowerCase().includes("network");
      const is5xx = msg.includes("Gemini API error (5");
      const is404 = msg.includes("Gemini API error (404)");

      if (is404 && attempt < maxRetries) {
        try {
          const models = await listModels(config.geminiApiKey);
          const fallback = selectFallbackModel(models);
          const fallbackUrl = `${GEMINI_ENDPOINT(fallback)}?key=${config.geminiApiKey}`;
          const retryResponse = await fetchWithTimeout(
            fallbackUrl,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody)
            },
            timeoutMs
          );
          if (!retryResponse.ok) {
            const retryText = await retryResponse.text();
            throw new Error(`Gemini API error (${retryResponse.status}): ${retryText}`);
          }
          const retryData = await retryResponse.json();
          const retryText = retryData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          const retryParsed = parseStrictJson(retryText);
          if (!retryParsed) {
            throw new Error("Unable to parse Gemini response as JSON.");
          }

          const normalized = {
            ...retryParsed,
            confidence: toNumberOrNull(retryParsed.confidence) ?? 0,
            entry: retryParsed.entry === null ? null : toNumberOrNull(retryParsed.entry),
            stopLoss: retryParsed.stopLoss === null ? null : toNumberOrNull(retryParsed.stopLoss),
            takeProfit1: retryParsed.takeProfit1 === null ? null : toNumberOrNull(retryParsed.takeProfit1),
            takeProfit2: retryParsed.takeProfit2 === null ? null : toNumberOrNull(retryParsed.takeProfit2),
            positionSizeLots:
              retryParsed.positionSizeLots === null ? null : toNumberOrNull(retryParsed.positionSizeLots),
            validityMinutes:
              retryParsed.validityMinutes === null ? null : toNumberOrNull(retryParsed.validityMinutes),
            keyLevels: Array.isArray(retryParsed.keyLevels) ? retryParsed.keyLevels.map(Number) : []
          };

          const validation = validateRecommendation(normalized);
          if (!validation.ok) {
            throw new Error(`Invalid model output schema: ${validation.reason}`);
          }

          return normalized;
        } catch (fallbackErr) {
          lastError = fallbackErr;
          break;
        }
      }

      const shouldRetry = attempt < maxRetries && (isAbort || isNetwork || is5xx);
      if (!shouldRetry) break;

      const backoff = retryBaseDelayMs * Math.pow(2, attempt);
      await sleep(backoff);
    }
  }

  throw lastError ?? new Error("Unknown error requesting recommendation.");
};

export { requestRecommendation };
