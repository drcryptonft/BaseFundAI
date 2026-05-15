import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getLocalMediaConfig } from "../services/mediaStorage.js";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const distRoot = resolve(projectRoot, "dist");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

async function getPathType(filePath) {
  try {
    const fileStat = await stat(filePath);

    if (fileStat.isFile()) {
      return "file";
    }

    if (fileStat.isDirectory()) {
      return "directory";
    }

    return "other";
  } catch {
    return "missing";
  }
}

function getMimeType(filePath) {
  const extension = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return mimeTypes[extension] || "application/octet-stream";
}

function decodePathname(pathname = "/") {
  try {
    return decodeURIComponent(String(pathname || "/"));
  } catch {
    return String(pathname || "/");
  }
}

export function resolveStaticAssetPath(pathname) {
  const decodedPath = decodePathname(pathname);
  return resolve(distRoot, `.${decodedPath}`);
}

export function isPathInsideDist(targetPath) {
  return isPathInsideRoot(distRoot, targetPath);
}

function isPathInsideRoot(rootPath, targetPath) {
  const normalizedRootPath = resolve(String(rootPath || ""));
  const normalizedTargetPath = resolve(String(targetPath || ""));

  return (
    normalizedTargetPath === normalizedRootPath ||
    normalizedTargetPath.startsWith(`${normalizedRootPath}\\`) ||
    normalizedTargetPath.startsWith(`${normalizedRootPath}/`)
  );
}

function getLocalMediaRouteBase() {
  const { publicBaseUrl } = getLocalMediaConfig();
  const normalizedBaseUrl = String(publicBaseUrl || "").trim();

  if (!normalizedBaseUrl) {
    return "/media";
  }

  try {
    if (/^https?:\/\//i.test(normalizedBaseUrl)) {
      return new URL(normalizedBaseUrl).pathname.replace(/\/$/, "") || "/media";
    }
  } catch {
    return "/media";
  }

  return normalizedBaseUrl.startsWith("/")
    ? normalizedBaseUrl.replace(/\/$/, "") || "/media"
    : `/${normalizedBaseUrl.replace(/\/$/, "")}`;
}

function resolveLocalMediaAssetPath(pathname) {
  const decodedPath = decodePathname(pathname);
  const routeBase = getLocalMediaRouteBase();

  if (
    decodedPath !== routeBase &&
    !decodedPath.startsWith(`${routeBase}/`)
  ) {
    return "";
  }

  const relativePath = decodedPath.slice(routeBase.length) || "/";
  const { storagePath } = getLocalMediaConfig();

  return resolve(storagePath, `.${relativePath}`);
}

async function tryServeLocalMedia(request, response, pathname) {
  const targetFile = resolveLocalMediaAssetPath(pathname);

  if (!targetFile) {
    return false;
  }

  const { storagePath } = getLocalMediaConfig();

  if (!isPathInsideRoot(storagePath, targetFile)) {
    return false;
  }

  if ((await getPathType(targetFile)) !== "file") {
    return false;
  }

  const body = await readFile(targetFile);
  response.writeHead(200, {
    "Content-Type": getMimeType(targetFile),
    "Cache-Control": "public, max-age=31536000, immutable",
  });

  if (request.method === "HEAD") {
    response.end();
    return true;
  }

  response.end(body);
  return true;
}

export function shouldServeSpaShell(pathname) {
  const decodedPath = decodePathname(pathname);

  if (!decodedPath || decodedPath === "/") {
    return true;
  }

  if (decodedPath.startsWith("/api/")) {
    return false;
  }

  return !extname(decodedPath);
}

export async function serveStaticAsset(request, response, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  if (await tryServeLocalMedia(request, response, pathname)) {
    return true;
  }

  const indexFile = join(distRoot, "index.html");

  if ((await getPathType(indexFile)) !== "file") {
    return false;
  }

  const targetFile = resolveStaticAssetPath(pathname);

  if (!isPathInsideDist(targetFile)) {
    return false;
  }

  const targetType = await getPathType(targetFile);
  let fileToServe = indexFile;

  if (targetType === "file") {
    fileToServe = targetFile;
  } else if (targetType === "directory") {
    const nestedIndexFile = join(targetFile, "index.html");

    if ((await getPathType(nestedIndexFile)) === "file") {
      fileToServe = nestedIndexFile;
    } else if (!shouldServeSpaShell(pathname)) {
      return false;
    }
  } else if (!shouldServeSpaShell(pathname)) {
    return false;
  }

  const body = await readFile(fileToServe);
  response.writeHead(200, {
    "Content-Type": getMimeType(fileToServe),
    "Cache-Control":
      fileToServe === indexFile
        ? "no-cache"
        : "public, max-age=31536000, immutable",
  });

  if (request.method === "HEAD") {
    response.end();
    return true;
  }

  response.end(body);
  return true;
}
