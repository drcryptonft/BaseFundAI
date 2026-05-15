const bucketStore = new Map();

function getBucket(bucketName) {
  if (!bucketStore.has(bucketName)) {
    bucketStore.set(bucketName, new Map());
  }

  return bucketStore.get(bucketName);
}

function createRateLimitError(retryAfterMs) {
  const error = new Error("Too many requests. Please try again shortly.");
  error.statusCode = 429;
  error.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return error;
}

export function enforceRateLimit({
  bucket = "default",
  key = "anonymous",
  limit = 30,
  windowMs = 60 * 1000,
}) {
  const now = Date.now();
  const scopedBucket = getBucket(bucket);
  const normalizedKey = String(key || "anonymous").trim() || "anonymous";
  const currentEntry = scopedBucket.get(normalizedKey);

  if (!currentEntry || now >= currentEntry.resetAt) {
    scopedBucket.set(normalizedKey, {
      count: 1,
      resetAt: now + windowMs,
    });
    return;
  }

  if (currentEntry.count >= limit) {
    throw createRateLimitError(currentEntry.resetAt - now);
  }

  currentEntry.count += 1;
  scopedBucket.set(normalizedKey, currentEntry);
}
