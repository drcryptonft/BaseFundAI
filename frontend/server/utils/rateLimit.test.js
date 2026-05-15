import test from "node:test";
import assert from "node:assert/strict";
import { enforceRateLimit } from "./rateLimit.js";

test("enforceRateLimit throws after the configured limit", () => {
  const options = {
    bucket: "unit-test-rate-limit",
    key: `client-${Date.now()}`,
    limit: 2,
    windowMs: 1000,
  };

  enforceRateLimit(options);
  enforceRateLimit(options);

  assert.throws(
    () => enforceRateLimit(options),
    (error) => error?.statusCode === 429
  );
});
