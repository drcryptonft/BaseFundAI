const MAX_METADATA_IMAGES = 3;
const MAX_HEADLINE_LENGTH = 120;
const MAX_STORY_LENGTH = 5000;
const MAX_DESCRIPTION_LENGTH = 9000;
const MAX_URL_LENGTH = 240;
const MAX_SOCIAL_FIELDS = 8;
const MAX_SOCIAL_KEY_LENGTH = 32;

function normalizeString(value = "", maxLength = Number.POSITIVE_INFINITY) {
  return String(value || "").trim().slice(0, maxLength);
}

export function isPublicMetadataUrl(value = "") {
  const normalized = normalizeString(value);

  return (
    normalized.startsWith("ipfs://") ||
    normalized.startsWith("ar://") ||
    /^https?:\/\//i.test(normalized)
  );
}

function getNormalizedImages(metadata = {}) {
  if (Array.isArray(metadata.images) && metadata.images.length > 0) {
    return metadata.images;
  }

  const mediaImages = Array.isArray(metadata.media?.images)
    ? metadata.media.images
    : [];
  const directImages = [
    metadata.image,
    metadata.imageUrl,
    metadata.coverImage,
    metadata.thumbnail,
  ].filter(Boolean);

  return [...mediaImages, ...directImages];
}

export function normalizeCampaignMetadataShape(metadata = {}) {
  return {
    headline:
      metadata.headline ??
      metadata.title ??
      metadata.name ??
      metadata.heading ??
      "",
    problemStatement: metadata.problemStatement ?? metadata.problem ?? "",
    impactPlan: metadata.impactPlan ?? metadata.plan ?? "",
    description:
      metadata.description ??
      metadata.story ??
      metadata.details ??
      metadata.summary ??
      metadata.about ??
      "",
    youtube:
      metadata.youtube ??
      metadata.video ??
      metadata.videoUrl ??
      metadata.youtubeUrl ??
      metadata.mediaUrl ??
      "",
    images: getNormalizedImages(metadata),
    socials:
      metadata.socials && typeof metadata.socials === "object"
        ? metadata.socials
        : {},
    trust:
      metadata.trust && typeof metadata.trust === "object"
        ? metadata.trust
        : undefined,
  };
}

function normalizeSocials(socials = {}) {
  const entries =
    socials && typeof socials === "object"
      ? Object.entries(socials)
          .map(([key, value]) => [
            normalizeString(key, MAX_SOCIAL_KEY_LENGTH),
            normalizeString(value, MAX_URL_LENGTH),
          ])
          .filter(([key, value]) => Boolean(key) && Boolean(value))
          .slice(0, MAX_SOCIAL_FIELDS)
      : [];

  return Object.fromEntries(entries);
}

function normalizeImages(images = [], { allowDataImages = false } = {}) {
  return (Array.isArray(images) ? images : [])
    .slice(0, MAX_METADATA_IMAGES)
    .map((image) => normalizeString(image))
    .filter(Boolean)
    .filter((image) => {
      if (image.startsWith("data:")) {
        return allowDataImages;
      }

      return isPublicMetadataUrl(image);
    });
}

export function sanitizeCampaignMetadata(
  metadata = {},
  { allowDataImages = false, includeTrust = true } = {}
) {
  const normalized = normalizeCampaignMetadataShape(metadata);

  return {
    headline: normalizeString(normalized.headline, MAX_HEADLINE_LENGTH),
    problemStatement: normalizeString(
      normalized.problemStatement,
      MAX_STORY_LENGTH
    ),
    impactPlan: normalizeString(normalized.impactPlan, MAX_STORY_LENGTH),
    description: normalizeString(normalized.description, MAX_DESCRIPTION_LENGTH),
    youtube: normalizeString(normalized.youtube, MAX_URL_LENGTH),
    images: normalizeImages(normalized.images, { allowDataImages }),
    socials: normalizeSocials(normalized.socials),
    trust: includeTrust ? normalized.trust || undefined : undefined,
  };
}

export function sanitizeCampaignMetadataDraft(metadata = {}) {
  return sanitizeCampaignMetadataForDisplay(metadata);
}

export function sanitizeCampaignMetadataForDisplay(metadata = {}) {
  return sanitizeCampaignMetadata(metadata, {
    allowDataImages: true,
  });
}

export function sanitizeCampaignMetadataForTransport(metadata = {}) {
  return sanitizeCampaignMetadata(metadata, {
    allowDataImages: false,
  });
}

export function sanitizeCampaignMetadataForStorage(metadata = {}) {
  return sanitizeCampaignMetadataForTransport(metadata);
}
