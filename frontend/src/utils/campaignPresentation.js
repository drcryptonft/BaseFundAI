export const FALLBACK_CAMPAIGN_MEDIA_URL = "/fallback-media.svg";

function trimValue(value = "") {
  return String(value || "").trim();
}

function truncateText(value = "", maxLength = 140) {
  const normalized = trimValue(value);

  if (!normalized || normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

export function buildCampaignDescription(problemStatement = "", impactPlan = "") {
  const problem = trimValue(problemStatement);
  const impact = trimValue(impactPlan);
  const sections = [];

  if (problem) {
    sections.push(`Problem\n${problem}`);
  }

  if (impact) {
    sections.push(`Impact Plan\n${impact}`);
  }

  return sections.join("\n\n");
}

export function getCampaignStory(content = {}) {
  const problemStatement = trimValue(content.problemStatement || content.problem || "");
  const impactPlan = trimValue(content.impactPlan || content.impact || "");
  const combinedDescription = buildCampaignDescription(problemStatement, impactPlan);
  const description = trimValue(content.description || "");

  return {
    problemStatement,
    impactPlan,
    description: combinedDescription || description,
  };
}

export function getCampaignExcerpt(content = {}, maxLength = 140) {
  const story = getCampaignStory(content);
  const primaryText =
    story.problemStatement || story.description || story.impactPlan || "";

  return truncateText(primaryText, maxLength);
}

export function getCampaignMediaImages(content = {}) {
  const directImages = [
    content?.image,
    content?.imageUrl,
    content?.coverImage,
    content?.thumbnail,
  ];
  const mediaImages = Array.isArray(content?.media?.images)
    ? content.media.images
    : [];
  const normalizedImages = Array.isArray(content?.images) && content.images.length > 0
    ? content.images
    : [...mediaImages, ...directImages];

  return normalizedImages.map((image) => trimValue(image)).filter(Boolean);
}

export function hasCampaignRenderablePreview(content = {}) {
  return Boolean(
    getCampaignMediaImages(content)[0] || getYoutubeThumbnailUrl(content?.youtube)
  );
}

export function getCampaignPreviewImageUrl(
  content = {},
  {
    resolveImageUrl = (value) => value,
    fallbackUrl = FALLBACK_CAMPAIGN_MEDIA_URL,
  } = {}
) {
  const primaryImage = getCampaignMediaImages(content)[0];

  if (primaryImage) {
    return resolveImageUrl(primaryImage);
  }

  const videoThumbnail = getYoutubeThumbnailUrl(content?.youtube);

  if (videoThumbnail) {
    return videoThumbnail;
  }

  return fallbackUrl;
}

export function normalizeSocialsForDisplay(input = {}) {
  return {
    facebook: trimValue(input.facebook || ""),
    website: trimValue(input.website || ""),
    twitter: trimValue(input.twitter || ""),
    linkedin: trimValue(input.linkedin || ""),
    telegram: trimValue(input.telegram || ""),
  };
}

export function toExternalUrl(value = "", kind = "website") {
  const normalized = trimValue(value);

  if (!normalized) {
    return "";
  }

  if (kind === "telegram" && normalized.startsWith("@")) {
    return `https://t.me/${normalized.slice(1)}`;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  return `https://${normalized}`;
}

export function getYoutubeVideoId(value = "") {
  const normalized = trimValue(value);

  if (!normalized) {
    return "";
  }

  if (normalized.includes("youtube.com/watch")) {
    return normalized.split("v=")[1]?.split("&")[0] || "";
  }

  if (normalized.includes("youtube.com/embed/")) {
    return normalized.split("youtube.com/embed/")[1]?.split(/[?&]/)[0] || "";
  }

  if (normalized.includes("youtu.be/")) {
    return normalized.split("youtu.be/")[1]?.split(/[?&]/)[0] || "";
  }

  return "";
}

export function getYoutubeEmbedUrl(value = "") {
  const normalized = trimValue(value);
  const videoId = getYoutubeVideoId(normalized);

  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }

  return normalized;
}

export function getYoutubeThumbnailUrl(value = "") {
  const videoId = getYoutubeVideoId(value);

  if (!videoId) {
    return "";
  }

  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
