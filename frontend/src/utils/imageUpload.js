export const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_UPLOAD_IMAGE_BYTES = 4 * 1024 * 1024;

const TARGET_IMAGE_BYTES = 250 * 1024;
const MAX_IMAGE_DIMENSION = 1280;
const MIN_IMAGE_DIMENSION = 720;
const QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58, 0.5];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Image read failed"));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function loadImageElement(sourceUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image decode failed"));
    image.src = sourceUrl;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Image compression failed"));
          return;
        }

        resolve(blob);
      },
      type,
      quality
    );
  });
}

function calculateDimensions(width, height, maxDimension) {
  if (!width || !height) {
    return {
      width: maxDimension,
      height: maxDimension,
    };
  }

  const ratio = Math.min(1, maxDimension / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function shouldKeepOriginalFile(file) {
  const normalizedType = String(file?.type || "").toLowerCase();
  return normalizedType === "image/gif" || normalizedType === "image/svg+xml";
}

export async function prepareCampaignImageDataUrl(file) {
  if (!file) {
    throw new Error("No image file selected");
  }

  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("Each source image must be 12MB or smaller");
  }

  if (shouldKeepOriginalFile(file)) {
    if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
      throw new Error("GIF and SVG files must already be 4MB or smaller");
    }

    return readFileAsDataUrl(file);
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(objectUrl);
    let bestBlob = null;
    let maxDimension = MAX_IMAGE_DIMENSION;

    while (maxDimension >= MIN_IMAGE_DIMENSION) {
      const dimensions = calculateDimensions(
        image.naturalWidth,
        image.naturalHeight,
        maxDimension
      );
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Image canvas is unavailable");
      }

      context.drawImage(image, 0, 0, dimensions.width, dimensions.height);

      for (const quality of QUALITY_STEPS) {
        const candidate = await canvasToBlob(canvas, "image/webp", quality);

        if (!bestBlob || candidate.size < bestBlob.size) {
          bestBlob = candidate;
        }

        if (candidate.size <= TARGET_IMAGE_BYTES) {
          return readFileAsDataUrl(candidate);
        }
      }

      maxDimension = Math.floor(maxDimension * 0.85);
    }

    if (!bestBlob || bestBlob.size > MAX_UPLOAD_IMAGE_BYTES) {
      throw new Error("Image is still too large after optimization");
    }

    return readFileAsDataUrl(bestBlob);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
