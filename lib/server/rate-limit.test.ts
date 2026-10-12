import assert from "node:assert/strict";
import test from "node:test";
import { allow, resetLimits } from "./rate-limit";

test("a key is limited inside the window and free again after it", () => {
  resetLimits();
  assert.equal(allow("pin", 2, 1_000, 0), true);
  assert.equal(allow("pin", 2, 1_000, 10), true);
  assert.equal(allow("pin", 2, 1_000, 20), false);
  assert.equal(allow("other", 2, 1_000, 20), true);
  assert.equal(allow("pin", 2, 1_000, 1_001), true);
});
