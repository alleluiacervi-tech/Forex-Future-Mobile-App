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

const isJpyPair = (pair) => typeof pair === "string" && pair.includes("JPY");
const decimalsForPair = (pair) => (isJpyPair(pair) ? 3 : 5);
const pipSizeForPair = (pair) => (isJpyPair(pair) ? 0.01 : 0.0001);

/**
 * Minimal schema validation (no external libs).
 * Ensures required keys exist and types are sane.
 */
const validateRecommendationShape = (obj) => {
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

const validateRecommendationSemantics = (obj, ctx = {}) => {
  const errors = [];
  const pair = ctx?.pair;
  const pipSize = pipSizeForPair(pair);

  const isNum = (v) => Number.isFinite(Number(v));
  const asNum = (v) => (v === null ? null : Number(v));

  const entry = asNum(obj.entry);
  const stopLoss = asNum(obj.stopLoss);
  const takeProfit1 = asNum(obj.takeProfit1);
  const takeProfit2 = asNum(obj.takeProfit2);

  if (obj.action === "WAIT") {
    const shouldBeNull = ["entry", "stopLoss", "takeProfit1", "takeProfit2", "positionSizeLots"];
    for (const k of shouldBeNull) {
      if (obj[k] !== null) errors.push(`For WAIT, ${k} must be null.`);
    }
    return { ok: errors.length === 0, errors };
  }

  // BUY/SELL require entry/SL/TP1
  if (!isNum(entry)) errors.push("entry must be a number for BUY/SELL.");
  if (!isNum(stopLoss)) errors.push("stopLoss must be a number for BUY/SELL.");
  if (!isNum(takeProfit1)) errors.push("takeProfit1 must be a number for BUY/SELL.");
  if (errors.length > 0) return { ok: false, errors };

  const risk = Math.abs(entry - stopLoss);
  const reward1 = Math.abs(takeProfit1 - entry);
  if (risk <= 0) errors.push("Invalid stopLoss: risk distance is zero.");

  const rr1 = risk > 0 ? reward1 / risk : 0;
  if (rr1 < 2) errors.push(`Risk/Reward must be >= 1:2 (got ~1:${rr1.toFixed(2)}).`);

  const stopDistancePips = risk / pipSize;
  if (stopDistancePips < 2) errors.push(`Stop distance too tight (~${stopDistancePips.toFixed(1)} pips).`);

  if (obj.action === "BUY") {
    if (!(stopLoss < entry)) errors.push("For BUY, stopLoss must be below entry.");
    if (!(takeProfit1 > entry)) errors.push("For BUY, takeProfit1 must be above entry.");
    if (takeProfit2 !== null) {
      if (!isNum(takeProfit2)) errors.push("takeProfit2 must be a number or null.");
      else if (!(takeProfit2 > takeProfit1)) errors.push("For BUY, takeProfit2 must be above takeProfit1.");
    }
  }

  if (obj.action === "SELL") {
    if (!(stopLoss > entry)) errors.push("For SELL, stopLoss must be above entry.");
    if (!(takeProfit1 < entry)) errors.push("For SELL, takeProfit1 must be below entry.");
    if (takeProfit2 !== null) {
      if (!isNum(takeProfit2)) errors.push("takeProfit2 must be a number or null.");
      else if (!(takeProfit2 < takeProfit1)) errors.push("For SELL, takeProfit2 must be below takeProfit1.");
    }
  }

  // If pipValuePerLot was provided, expect a position size for BUY/SELL.
  if (Number.isFinite(Number(ctx?.pipValuePerLot))) {
    if (!Number.isFinite(Number(obj.positionSizeLots))) {
      errors.push("positionSizeLots must be a number when pipValuePerLot is provided.");
    }
  }

  return { ok: errors.length === 0, errors };
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
  accountCurrency = null,

  // Optional execution realism
  spreadPips = null,
  slippagePips = null,

  // Optional for accurate sizing
  pipValuePerLot = null,

  // Optional: key levels precomputed by the signal engine (zones/FVG/etc)
  keyLevelsHint = null,

  // Optional: recent multi-window change from live ticks (fast multi-timeframe proxy)
  windowSnapshot = null,

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
  const priceDecimals = decimalsForPair(pair);
  const pipSize = pipSizeForPair(pair);

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

PRICE CONVENTIONS:
- 1 pip for this pair = ${pipSize}.
- Format all price levels (entry/stop/take profits/keyLevels) to ${priceDecimals} decimals.

RISK FILTERS:
- If newsRisk is HIGH -> default WAIT unless setup is exceptionally clean with defined invalidation.
- If spread/slippage is abnormal -> reduce confidence or WAIT.
- In low-liquidity session (late NY/rollover) -> reduce confidence or WAIT.

CONTEXT INPUTS:
Pair: ${pair}
Timeframe focus: ${timeframe}
Current price: ${price}
Account balance: ${acct}
Account currency: ${accountCurrency ?? "Unknown"}
Risk percent per trade: ${riskPct}
Session: ${session ?? "Unknown"}
News risk: ${newsRisk ?? "Unknown"}
Spread (pips): ${spreadPips ?? "Unknown"}
Slippage (pips): ${slippagePips ?? "Unknown"}
Pip value per 1.00 lot: ${pipValuePerLot ?? "Unknown"}
Notes: ${notes || "None"}

KEY LEVELS HINT (from our signal engine; use as anchors, you may include additional levels if justified):
${Array.isArray(keyLevelsHint) && keyLevelsHint.length ? JSON.stringify(keyLevelsHint) : "None"}

RECENT MULTI-WINDOW PRICE CHANGE (computed from live ticks; treat as a multi-timeframe momentum/volatility proxy):
${windowSnapshot ? JSON.stringify(windowSnapshot, null, 2) : "None"}

OPTIONAL LSTM MARKET REGIME CONTEXT (use if provided; do not contradict it without reason):
${lstmContext ? JSON.stringify(lstmContext, null, 2) : "None"}

RESPONSE QUALITY:
- Use concise professional language.
- Provide keyLevels (important S/D or liquidity levels).
- Provide invalidation (what would make the idea wrong).
- validityMinutes should be realistic (e.g., 60-360) or null if WAIT.

IF action is WAIT:
- Set entry/stopLoss/takeProfit1/takeProfit2/positionSizeLots to null.

Return JSON now.
`.trim();
};

const buildRepairPrompt = ({ originalPrompt, previousJson, errors }) => {
  const problems = Array.isArray(errors) && errors.length ? errors.map((e) => `- ${e}`).join("\n") : "- Unknown issue";
  return `
You MUST repair your previous JSON so it strictly matches the schema and obeys the rules.

Original prompt:
${originalPrompt}

Your previous JSON:
${JSON.stringify(previousJson, null, 2)}

Problems to fix:
${problems}

Return ONLY corrected JSON (no markdown, no extra text).
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
    temperature: 0.15,
    top_p: 0.85,
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
      const choices = Array.isArray(data?.choices) ? data.choices : [];

      const normalize = (parsed) => ({
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
      });

      const validateAll = (candidate) => {
        const shape = validateRecommendationShape(candidate);
        if (!shape.ok) return { ok: false, errors: [shape.reason] };
        const semantics = validateRecommendationSemantics(candidate, {
          pair: payload?.pair,
          pipValuePerLot: payload?.pipValuePerLot
        });
        if (!semantics.ok) return { ok: false, errors: semantics.errors };
        return { ok: true, errors: [] };
      };

      // 1) Try the first response as-is
      const primaryText = choices?.[0]?.message?.content ?? "";
      const primaryParsed = parseStrictJson(primaryText);
      if (primaryParsed) {
        const normalized = normalize(primaryParsed);
        const ok = validateAll(normalized);
        if (ok.ok) return normalized;

        // 2) One repair round: feed back errors + previous JSON and force correction
        const repairPrompt = buildRepairPrompt({
          originalPrompt: prompt,
          previousJson: normalized,
          errors: ok.errors
        });

        const repairBody = {
          ...requestBody,
          messages: [{ role: "user", content: repairPrompt }],
          temperature: 0,
          top_p: 1
        };

        const repairRes = await fetchWithTimeout(
          url,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.groqApiKey}`
            },
            body: JSON.stringify(repairBody)
          },
          timeoutMs
        );

        if (repairRes.ok) {
          const repairData = await repairRes.json();
          const repairText = repairData?.choices?.[0]?.message?.content ?? "";
          const repairParsed = parseStrictJson(repairText);
          if (repairParsed) {
            const repaired = normalize(repairParsed);
            const repairedOk = validateAll(repaired);
            if (repairedOk.ok) return repaired;
            throw new Error(`Invalid model output after repair: ${repairedOk.errors.join("; ")}`);
          }
          throw new Error("Unable to parse repaired Groq response as JSON.");
        }

        const errText = await repairRes.text().catch(() => "");
        throw new Error(`Groq repair call failed (${repairRes.status}): ${errText}`);
      }

      throw new Error("Unable to parse Groq response as JSON.");
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
