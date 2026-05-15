import { createHash, createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const R2_SERVICE = "s3";
const R2_REGION = "auto";
const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const DEFAULT_LOCAL_MEDIA_STORAGE_PATH = resolve(
  projectRoot,
  "server",
  "data",
  "media"
);
const DEFAULT_LOCAL_MEDIA_PUBLIC_BASE_URL = "/media";

function trimValue(value = "") {
  return String(value || "").trim();
}

export function guessExtension(mimeType = "") {
  const normalized = trimValue(mimeType).toLowerCase();

  if (normalized.includes("png")) return "png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  if (normalized.includes("svg")) return "svg";

  return "bin";
}

export function parseImageDataUrl(value) {
  const match = trimValue(value).match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/i);

  if (!match) {
    throw new Error("Invalid image data URL");
  }

  const mimeType = trimValue(match[1] || "application/octet-stream");
  const isBase64 = Boolean(match[2]);
  const rawValue = match[3] || "";
  const buffer = isBase64
    ? Buffer.from(rawValue, "base64")
    : Buffer.from(decodeURIComponent(rawValue), "utf8");

  if (!mimeType.toLowerCase().startsWith("image/")) {
    throw new Error("Only image uploads are allowed in metadata");
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Each image must be 4MB or smaller after optimization");
  }

  return {
    mimeType,
    buffer,
    extension: guessExtension(mimeType),
  };
}

function isPublicImageUrl(value = "") {
  const normalized = trimValue(value);

  return (
    normalized.startsWith("ipfs://") ||
    normalized.startsWith("ar://") ||
    /^https?:\/\//i.test(normalized)
  );
}

function getPinataHeaders() {
  const jwt = trimValue(process.env.PINATA_JWT);
  const apiKey = trimValue(process.env.PINATA_API_KEY);
  const secret = trimValue(process.env.PINATA_SECRET_API_KEY);

  if (jwt) {
    return {
      Authorization: `Bearer ${jwt}`,
    };
  }

  if (apiKey && secret) {
    return {
      pinata_api_key: apiKey,
      pinata_secret_api_key: secret,
    };
  }

  return null;
}

function getRequestedMediaStorageProvider() {
  return trimValue(process.env.MEDIA_STORAGE_PROVIDER).toLowerCase() || "pinata";
}

function getR2Config() {
  return {
    accountId: trimValue(process.env.R2_ACCOUNT_ID),
    accessKeyId: trimValue(process.env.R2_ACCESS_KEY_ID),
    secretAccessKey: trimValue(process.env.R2_SECRET_ACCESS_KEY),
    bucket: trimValue(process.env.R2_BUCKET),
    publicBaseUrl: trimValue(process.env.R2_PUBLIC_BASE_URL).replace(/\/$/, ""),
  };
}

export function getLocalMediaConfig() {
  return {
    storagePath: resolve(
      trimValue(process.env.LOCAL_MEDIA_STORAGE_PATH) ||
        DEFAULT_LOCAL_MEDIA_STORAGE_PATH
    ),
    publicBaseUrl:
      trimValue(process.env.LOCAL_MEDIA_PUBLIC_BASE_URL).replace(/\/$/, "") ||
      DEFAULT_LOCAL_MEDIA_PUBLIC_BASE_URL,
  };
}

export function getMediaStorageProvider() {
  const requestedProvider = getRequestedMediaStorageProvider();

  if (requestedProvider === "local") {
    return "local";
  }

  if (requestedProvider === "r2") {
    const config = getR2Config();
    const missing = [
      ["R2_ACCOUNT_ID", config.accountId],
      ["R2_ACCESS_KEY_ID", config.accessKeyId],
      ["R2_SECRET_ACCESS_KEY", config.secretAccessKey],
      ["R2_BUCKET", config.bucket],
      ["R2_PUBLIC_BASE_URL", config.publicBaseUrl],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new Error(`R2 image storage is missing: ${missing.join(", ")}`);
    }

    return "r2";
  }

  return "pinata";
}

function createSha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function buildR2ObjectKey({ buffer, extension, index = 0 } = {}) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const digest = createSha256Hex(buffer).slice(0, 20);

  return [
    "campaign-images",
    year,
    month,
    day,
    `${Date.now()}-${index + 1}-${digest}.${extension}`,
  ].join("/");
}

function buildLocalMediaUrl(objectKey) {
  const { publicBaseUrl } = getLocalMediaConfig();
  return `${publicBaseUrl.replace(/\/$/, "")}/${objectKey}`;
}

function formatAmzDate(date) {
  return date
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, "")
    .slice(0, 15) + "Z";
}

function createSigningKey(secretAccessKey, dateStamp) {
  const kDate = createHmac("sha256", `AWS4${secretAccessKey}`)
    .update(dateStamp)
    .digest();
  const kRegion = createHmac("sha256", kDate).update(R2_REGION).digest();
  const kService = createHmac("sha256", kRegion).update(R2_SERVICE).digest();
  return createHmac("sha256", kService).update("aws4_request").digest();
}

function createR2SignedHeaders({
  method,
  host,
  pathname,
  mimeType,
  payloadHash,
  accessKeyId,
  secretAccessKey,
}) {
  const now = new Date();
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const canonicalHeaders = [
    `content-type:${mimeType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join("\n");
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    pathname,
    "",
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createSha256Hex(canonicalRequest),
  ].join("\n");
  const signature = createHmac(
    "sha256",
    createSigningKey(secretAccessKey, dateStamp)
  )
    .update(stringToSign)
    .digest("hex");

  return {
    authorization: [
      "AWS4-HMAC-SHA256",
      `Credential=${accessKeyId}/${credentialScope},`,
      `SignedHeaders=${signedHeaders},`,
      `Signature=${signature}`,
    ].join(" "),
    amzDate,
    payloadHash,
  };
}

async function uploadImageToPinata(imageValue, index) {
  const headers = getPinataHeaders();

  if (!headers) {
    throw new Error("Pinata credentials are not configured on the server");
  }

  const { mimeType, buffer, extension } = parseImageDataUrl(imageValue);
  const formData = new FormData();
  const fileName = `campaign-image-${Date.now()}-${index + 1}.${extension}`;
  const blob = new Blob([buffer], { type: mimeType });

  formData.append("file", blob, fileName);
  formData.append(
    "pinataMetadata",
    JSON.stringify({
      name: fileName,
    })
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers,
      body: formData,
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (!response.ok) {
      throw new Error(
        data?.error?.reason ||
          data?.error ||
          data?.message ||
          `Pinata image upload failed (${response.status})`
      );
    }

    const ipfsHash = trimValue(data?.IpfsHash);

    if (!ipfsHash) {
      throw new Error("Pinata image upload did not return an IPFS hash");
    }

    return `ipfs://${ipfsHash}`;
  } finally {
    clearTimeout(timeout);
  }
}

async function uploadImageToR2(imageValue, index) {
  const { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl } =
    getR2Config();
  const { mimeType, buffer, extension } = parseImageDataUrl(imageValue);
  const objectKey = buildR2ObjectKey({ buffer, extension, index });
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const pathname = `/${bucket}/${objectKey}`;
  const payloadHash = createSha256Hex(buffer);
  const signedHeaders = createR2SignedHeaders({
    method: "PUT",
    host,
    pathname,
    mimeType,
    payloadHash,
    accessKeyId,
    secretAccessKey,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(`https://${host}${pathname}`, {
      method: "PUT",
      headers: {
        Authorization: signedHeaders.authorization,
        "Content-Type": mimeType,
        "x-amz-content-sha256": signedHeaders.payloadHash,
        "x-amz-date": signedHeaders.amzDate,
      },
      body: buffer,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        errorText || `R2 image upload failed (${response.status})`
      );
    }

    return `${publicBaseUrl}/${objectKey}`;
  } finally {
    clearTimeout(timeout);
  }
}

async function uploadImageToLocal(imageValue, index) {
  const { storagePath } = getLocalMediaConfig();
  const { buffer, extension } = parseImageDataUrl(imageValue);
  const objectKey = buildR2ObjectKey({ buffer, extension, index });
  const targetPath = resolve(storagePath, objectKey);

  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, buffer);

  return buildLocalMediaUrl(objectKey);
}

export async function uploadCampaignImage(imageValue, index = 0) {
  const normalizedImageValue = trimValue(imageValue);

  if (!normalizedImageValue.startsWith("data:")) {
    if (isPublicImageUrl(normalizedImageValue)) {
      return normalizedImageValue;
    }

    throw new Error("Metadata images must be data URLs or immutable/public URLs");
  }

  const provider = getMediaStorageProvider();

  if (provider === "local") {
    return uploadImageToLocal(normalizedImageValue, index);
  }

  if (provider === "r2") {
    return uploadImageToR2(normalizedImageValue, index);
  }

  return uploadImageToPinata(normalizedImageValue, index);
}
