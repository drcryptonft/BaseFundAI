import { fetchJson } from "../utils/fetch.js";
import { normalizeWhitespace } from "../utils/hash.js";

const MAX_SCORE = 20;

const SUSPICIOUS_PATTERNS = [
  "guaranteed return",
  "double your money",
  "instant profit",
  "wallet recovery",
  "seed phrase",
  "airdrop claim fee",
  "send crypto to unlock",
];

function heuristicReview(input = {}) {
  const headline = normalizeWhitespace(input.headline);
  const description = normalizeWhitespace(input.description);
  const combined = `${headline} ${description}`.toLowerCase();
  let score = 8;
  const warnings = [];
  const highlights = [];

  if (description.length >= 240) {
    score += 5;
    highlights.push("Campaign description is detailed enough for contributors to review.");
  } else if (description.length >= 120) {
    score += 3;
  } else {
    warnings.push("Description is short; more operational detail would improve trust.");
  }

  if (headline.length >= 12 && headline.length <= 90) {
    score += 2;
  }

  if (Number(input.goal || 0) >= 50 && Number(input.goal || 0) <= 100000) {
    score += 2;
  }

  if (Number(input.mediaCount || 0) > 0 || input.youtube) {
    score += 2;
    highlights.push("Campaign includes media that helps contributors evaluate it.");
  }

  const suspiciousHits = SUSPICIOUS_PATTERNS.filter((pattern) =>
    combined.includes(pattern)
  );

  if (suspiciousHits.length > 0) {
    score -= suspiciousHits.length * 4;
    warnings.push(
      "Campaign copy includes phrases that often appear in scam or hype-heavy listings."
    );
  }

  return {
    score: Math.max(0, Math.min(MAX_SCORE, score)),
    summary:
      warnings.length > 0
        ? "Heuristic review found areas contributors should inspect carefully."
        : "Heuristic review found a reasonably complete campaign description.",
    warnings,
    highlights,
  };
}

function extractJsonObject(value = "") {
  const text = String(value || "").trim();
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || text;

  try {
    return JSON.parse(candidate);
  } catch {
    const braceStart = candidate.indexOf("{");
    const braceEnd = candidate.lastIndexOf("}");

    if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
      try {
        return JSON.parse(candidate.slice(braceStart, braceEnd + 1));
      } catch {
        return null;
      }
    }

    return null;
  }
}

export async function getGeminiSignal(input = {}) {
  const heuristic = heuristicReview(input);
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();

  if (!apiKey) {
    return {
      key: "content",
      label: "Content Review",
      available: true,
      score: heuristic.score,
      maxScore: MAX_SCORE,
      summary: heuristic.summary,
      warnings: heuristic.warnings,
      highlights: heuristic.highlights,
      stats: {
        source: "heuristic",
      },
    };
  }

  const model = String(process.env.GEMINI_MODEL || "gemini-3-flash-preview").trim();
  const prompt = [
    "Review this crowdfunding campaign for contributor trustworthiness.",
    "Return strict JSON only with keys: score, summary, warnings, highlights.",
    "score must be an integer from 0 to 20.",
    "Keep warnings and highlights as short arrays of plain strings.",
    "",
    `Headline: ${input.headline || ""}`,
    `Description: ${input.description || ""}`,
    `Goal: ${input.goal || 0}`,
    `Duration: ${input.duration || 0}`,
    `Media Count: ${input.mediaCount || 0}`,
    `Socials: ${JSON.stringify(input.socials || {})}`,
  ].join("\n");

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const result = await fetchJson(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      },
      16000
    );

    if (!result.ok) {
      throw new Error(`Gemini request failed (${result.status})`);
    }

    const output =
      result.data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .join("\n") || "";
    const parsed = extractJsonObject(output);
    const aiScore = Number(parsed?.score);
    const combinedScore = Number.isFinite(aiScore)
      ? Math.round(aiScore * 0.7 + heuristic.score * 0.3)
      : heuristic.score;

    return {
      key: "content",
      label: "Content Review",
      available: true,
      score: Math.max(0, Math.min(MAX_SCORE, combinedScore)),
      maxScore: MAX_SCORE,
      summary: parsed?.summary || heuristic.summary,
      warnings: Array.isArray(parsed?.warnings)
        ? parsed.warnings.slice(0, 3)
        : heuristic.warnings,
      highlights: Array.isArray(parsed?.highlights)
        ? parsed.highlights.slice(0, 3)
        : heuristic.highlights,
      stats: {
        source: "gemini",
      },
    };
  } catch (error) {
    return {
      key: "content",
      label: "Content Review",
      available: true,
      score: heuristic.score,
      maxScore: MAX_SCORE,
      summary: heuristic.summary,
      warnings: heuristic.warnings,
      highlights: heuristic.highlights,
      stats: {
        source: "heuristic-fallback",
        error: error.message,
      },
    };
  }
}
