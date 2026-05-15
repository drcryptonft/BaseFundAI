import { fetchJson } from "../utils/fetch.js";

const MAX_SCORE = 25;

export async function getGitcoinSignal(address) {
  const apiKey = String(process.env.GITCOIN_API_KEY || "").trim();
  const scorerId = String(process.env.GITCOIN_SCORER_ID || "").trim();

  if (!apiKey || !scorerId) {
    return {
      key: "passport",
      label: "Gitcoin Passport",
      available: false,
      score: 0,
      maxScore: MAX_SCORE,
      summary: "Gitcoin Passport is not configured.",
      stats: {
        passportScore: 0,
      },
    };
  }

  try {
    const url = `https://api.passport.xyz/v2/stamps/${scorerId}/score/${address}`;
    const result = await fetchJson(
      url,
      {
        headers: {
          "X-API-KEY": apiKey,
        },
      },
      12000
    );

    if (!result.ok) {
      throw new Error(`Passport request failed (${result.status})`);
    }

    const payload = result.data || {};
    const passportScore = Number(payload.score || 0);
    const passing = Boolean(payload.passing_score);
    let score = 0;

    if (passing) score = 25;
    else if (passportScore >= 20) score = 22;
    else if (passportScore >= 12) score = 16;
    else if (passportScore >= 6) score = 10;
    else if (passportScore > 0) score = 4;

    return {
      key: "passport",
      label: "Gitcoin Passport",
      available: true,
      score,
      maxScore: MAX_SCORE,
      summary: passing
        ? `Passport score ${passportScore.toFixed(2)} clears the configured threshold.`
        : passportScore > 0
          ? `Passport score ${passportScore.toFixed(2)} is present but below the configured threshold.`
          : "No Passport score was returned for this wallet yet.",
      highlights:
        passing ? ["Wallet passes Gitcoin Passport threshold."] : [],
      stats: {
        passportScore,
        passing,
      },
    };
  } catch (error) {
    return {
      key: "passport",
      label: "Gitcoin Passport",
      available: false,
      score: 0,
      maxScore: MAX_SCORE,
      summary: "Gitcoin Passport lookup is unavailable right now.",
      stats: {
        passportScore: 0,
        error: error.message,
      },
    };
  }
}
