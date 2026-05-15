import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = fileURLToPath(new URL("..", import.meta.url));
const dataDir = join(serverRoot, "data");
const writeQueues = new Map();

function cloneFallback(fallback) {
  return JSON.parse(JSON.stringify(fallback));
}

export function getDataFile(fileName) {
  return join(dataDir, fileName);
}

async function ensureFile(filePath, fallback) {
  await mkdir(dirname(filePath), { recursive: true });

  try {
    await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }

    await writeFile(
      filePath,
      JSON.stringify(cloneFallback(fallback), null, 2),
      "utf8"
    );
  }
}

export async function readJsonFile(filePath, fallback = {}) {
  await ensureFile(filePath, fallback);

  const raw = await readFile(filePath, "utf8");

  try {
    return raw.trim() ? JSON.parse(raw) : cloneFallback(fallback);
  } catch {
    return cloneFallback(fallback);
  }
}

export async function writeJsonFile(filePath, value, fallback = {}) {
  await ensureFile(filePath, fallback);
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
  return value;
}

export async function updateJsonFile(filePath, fallback, updater) {
  const queueKey = filePath;
  const previous = writeQueues.get(queueKey) || Promise.resolve();

  const next = previous.then(async () => {
    const current = await readJsonFile(filePath, fallback);
    const updated = await updater(current);
    return writeJsonFile(
      filePath,
      updated === undefined ? current : updated,
      fallback
    );
  });

  writeQueues.set(queueKey, next.catch(() => {}));
  return next;
}
