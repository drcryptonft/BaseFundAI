import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { getClientIp, getCorsOrigin, readJsonBody } from "./http.js";

function createJsonRequest(body, headers = {}) {
  const request = Readable.from([body]);
  request.headers = headers;
  return request;
}

test("readJsonBody parses JSON payloads", async () => {
  const request = createJsonRequest('{"ok":true}', {
    "content-type": "application/json",
  });

  const payload = await readJsonBody(request);

  assert.deepEqual(payload, { ok: true });
});

test("readJsonBody rejects oversized payloads", async () => {
  const request = createJsonRequest(JSON.stringify({ payload: "1234567890" }), {
    "content-type": "application/json",
  });

  await assert.rejects(
    () => readJsonBody(request, { maxBytes: 8 }),
    (error) => error?.statusCode === 413
  );
});

test("getClientIp ignores forwarded headers unless trust proxy is enabled", () => {
  delete process.env.TRUST_TRUST_PROXY;

  const ip = getClientIp({
    headers: {
      "x-forwarded-for": "198.51.100.10",
    },
    socket: {
      remoteAddress: "::ffff:203.0.113.5",
    },
  });

  assert.equal(ip, "203.0.113.5");
});

test("getClientIp trusts forwarded headers when trust proxy is enabled", () => {
  process.env.TRUST_TRUST_PROXY = "true";

  const ip = getClientIp({
    headers: {
      "x-forwarded-for": "198.51.100.10, 203.0.113.5",
    },
    socket: {
      remoteAddress: "::ffff:203.0.113.5",
    },
  });

  delete process.env.TRUST_TRUST_PROXY;
  assert.equal(ip, "198.51.100.10");
});

test("getCorsOrigin allows localhost by default but blocks unknown origins", () => {
  delete process.env.TRUST_ALLOWED_ORIGIN;

  assert.equal(
    getCorsOrigin({
      headers: {
        origin: "http://localhost:5173",
        host: "localhost:5000",
      },
    }),
    "http://localhost:5173"
  );

  assert.equal(
    getCorsOrigin({
      headers: {
        origin: "https://evil.example",
        host: "localhost:5000",
      },
    }),
    ""
  );
});
