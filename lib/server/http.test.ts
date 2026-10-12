import assert from "node:assert/strict";
import test from "node:test";
import type { NextRequest } from "next/server";
import { clientKey } from "./http";

function request(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as NextRequest;
}

test("the platform real ip wins over a forwarded list", () => {
  assert.equal(
    clientKey(
      request({
        "x-real-ip": "203.0.113.8",
        "x-forwarded-for": "1.2.3.4, 203.0.113.8",
      }),
    ),
    "203.0.113.8",
  );
});

test("without a real ip, the last forwarded hop is the client", () => {
  assert.equal(clientKey(request({ "x-forwarded-for": "1.2.3.4, 198.51.100.9" })), "198.51.100.9");
  assert.equal(clientKey(request({})), "local");
});
