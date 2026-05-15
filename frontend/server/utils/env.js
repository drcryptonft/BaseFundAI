import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = fileURLToPath(new URL("..", import.meta.url));
const projectRoot = resolve(serverRoot, "..");

function parseEnv(content = "") {
  const values = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

export function loadEnvFiles() {
  const candidates = [
    join(projectRoot, ".env"),
    join(projectRoot, ".env.local"),
    join(serverRoot, ".env"),
    join(serverRoot, ".env.local"),
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) {
      continue;
    }

    const parsed = parseEnv(readFileSync(filePath, "utf8"));

    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}
