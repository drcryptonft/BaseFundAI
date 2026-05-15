import test from "node:test";
import assert from "node:assert/strict";
import {
  getLocalMediaConfig,
  getMediaStorageProvider,
  parseImageDataUrl,
} from "./mediaStorage.js";

test("parseImageDataUrl accepts small image data URLs", () => {
  const parsed = parseImageDataUrl("data:image/png;base64,YWJj");

  assert.equal(parsed.mimeType, "image/png");
  assert.equal(parsed.extension, "png");
  assert.equal(parsed.buffer.toString("utf8"), "abc");
});

test("getMediaStorageProvider defaults to pinata", () => {
  delete process.env.MEDIA_STORAGE_PROVIDER;

  assert.equal(getMediaStorageProvider(), "pinata");
});

test("getMediaStorageProvider requires complete R2 config", () => {
  process.env.MEDIA_STORAGE_PROVIDER = "r2";
  delete process.env.R2_ACCOUNT_ID;
  delete process.env.R2_ACCESS_KEY_ID;
  delete process.env.R2_SECRET_ACCESS_KEY;
  delete process.env.R2_BUCKET;
  delete process.env.R2_PUBLIC_BASE_URL;

  assert.throws(
    () => getMediaStorageProvider(),
    /R2 image storage is missing/
  );

  delete process.env.MEDIA_STORAGE_PROVIDER;
});

test("getMediaStorageProvider accepts local storage", () => {
  process.env.MEDIA_STORAGE_PROVIDER = "local";

  assert.equal(getMediaStorageProvider(), "local");

  delete process.env.MEDIA_STORAGE_PROVIDER;
});

test("getLocalMediaConfig provides stable defaults", () => {
  delete process.env.LOCAL_MEDIA_STORAGE_PATH;
  delete process.env.LOCAL_MEDIA_PUBLIC_BASE_URL;

  const config = getLocalMediaConfig();

  assert.match(config.storagePath, /server[\\/]+data[\\/]+media$/);
  assert.equal(config.publicBaseUrl, "/media");
});
