function isHttpUrl(value = "") {
  return /^https?:\/\//i.test(String(value).trim());
}

function includesDomain(value = "", domains = []) {
  const normalized = String(value || "").toLowerCase();
  return domains.some((domain) => normalized.includes(domain));
}

export function normalizeSocials(input = {}) {
  return {
    facebook: String(input.facebook || input.website || "").trim(),
    website: String(input.website || "").trim(),
    twitter: String(input.twitter || "").trim(),
    linkedin: String(input.linkedin || "").trim(),
    telegram: String(input.telegram || "").trim(),
    github: String(input.github || "").trim(),
  };
}

export function getSocialSignal(input = {}) {
  const socials = normalizeSocials(input);
  const connected = [];
  const warnings = [];
  let score = 0;

  if (socials.facebook) {
    if (
      includesDomain(socials.facebook, ["facebook.com", "fb.com"]) ||
      isHttpUrl(socials.facebook)
    ) {
      score += 4;
      connected.push("Facebook");
    } else {
      warnings.push("Facebook link format looks incomplete.");
    }
  } else if (socials.website) {
    if (isHttpUrl(socials.website)) {
      score += 4;
      connected.push("Website");
    } else {
      warnings.push("Website should start with http:// or https://.");
    }
  }

  if (socials.twitter) {
    if (includesDomain(socials.twitter, ["x.com", "twitter.com"])) {
      score += 3;
      connected.push("X");
    } else {
      warnings.push("Twitter/X link format looks incomplete.");
    }
  }

  if (socials.linkedin) {
    if (includesDomain(socials.linkedin, ["linkedin.com"])) {
      score += 3;
      connected.push("LinkedIn");
    } else {
      warnings.push("LinkedIn link format looks incomplete.");
    }
  }

  if (socials.telegram) {
    if (
      socials.telegram.startsWith("@") ||
      includesDomain(socials.telegram, ["t.me", "telegram.me"])
    ) {
      score += 2;
      connected.push("Telegram");
    } else {
      warnings.push("Telegram should be an @handle or public link.");
    }
  }

  if (socials.github && includesDomain(socials.github, ["github.com"])) {
    score += 2;
    connected.push("GitHub");
  }

  const boundedScore = Math.min(score, 12);
  const summary = connected.length
    ? `Public trust links connected: ${connected.join(", ")}.`
    : "No public social proof links were added.";

  return {
    key: "social",
    label: "Social Proof",
    available: true,
    score: boundedScore,
    maxScore: 12,
    summary,
    connected,
    warnings,
    highlights:
      connected.length > 1
        ? ["Campaign includes multiple public verification links."]
        : [],
    stats: {
      connected,
    },
  };
}
