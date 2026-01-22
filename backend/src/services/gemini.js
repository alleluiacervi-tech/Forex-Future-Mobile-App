import config from "../config.js";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent";

const buildPrompt = ({
  pair,
  timeframe,
  currentPrice,
  accountBalance,
  riskPercent,
  notes
}) => `You are an institutional-grade FX strategist for the Forex Future app.\n\nProvide a professional trade recommendation based on smart money concepts, supply/demand zones, rubber band mean reversion, market psychology, and multi-timeframe alignment.\n\nReturn ONLY valid JSON with this schema:\n{\n  "action": "BUY" | "SELL" | "WAIT",\n  "confidence": number (0-100),\n  "entry": number | null,\n  "stopLoss": number | null,\n  "takeProfit1": number | null,\n  "takeProfit2": number | null,\n  "riskReward": string | null,\n  "positionSizeLots": number | null,\n  "rationale": string\n}\n\nContext:\n- Pair: ${pair}\n- Timeframe focus: ${timeframe}\n- Current price: ${currentPrice}\n- Account balance: ${accountBalance}\n- Risk percent per trade: ${riskPercent}\n- Notes: ${notes || "None"}\n\nDecision rules:\n- If confluence is weak, return WAIT with clear rationale.\n- Use conservative, professional tone and explain WHY.\n- Position size should be calculated from account balance and risk percent.\n- Risk/Reward should be at least 1:2 for BUY/SELL.\n`;

const parseGeminiResponse = (responseText) => {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    return null;
  }
};

const requestRecommendation = async (payload) => {
  if (!config.geminiApiKey) {
    throw new Error("Missing GEMINI_API_KEY configuration.");
  }

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${config.geminiApiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt(payload) }]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const parsed = parseGeminiResponse(text);

  if (!parsed) {
    throw new Error("Unable to parse Gemini response.");
  }

  return parsed;
};

export { requestRecommendation };
