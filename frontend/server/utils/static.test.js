import test from "node:test";
import assert from "node:assert/strict";
import {
  isPathInsideDist,
  resolveStaticAssetPath,
  shouldServeSpaShell,
} from "./static.js";

test("shouldServeSpaShell only matches app routes", () => {
  assert.equal(shouldServeSpaShell("/campaign/0xabc"), true);
  assert.equal(shouldServeSpaShell("/api/health"), false);
  assert.equal(shouldServeSpaShell("/assets/app.js"), false);
  assert.equal(shouldServeSpaShell("/favicon.ico"), false);
});

test("resolveStaticAssetPath stays inside dist root", () => {
  const assetPath = resolveStaticAssetPath("/assets/main.js");

  assert.equal(isPathInsideDist(assetPath), true);
});

test("resolveStaticAssetPath rejects traversal attempts", () => {
  const escapedPath = resolveStaticAssetPath("/../../server/index.js");

  assert.equal(isPathInsideDist(escapedPath), false);
});
