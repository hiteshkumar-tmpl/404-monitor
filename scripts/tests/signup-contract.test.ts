import test from "node:test";
import assert from "node:assert/strict";

import { signup } from "../../lib/api-client-react/src/generated/api.ts";

test("signup helper targets the public auth signup endpoint", async () => {
  const originalFetch = globalThis.fetch;

  let requestedUrl = "";
  let requestedMethod = "";
  let requestedBody = "";

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = typeof input === "string" ? input : input.toString();
    requestedMethod = init?.method ?? "GET";
    requestedBody = String(init?.body ?? "");

    return new Response(
      JSON.stringify({
        id: 1,
        email: "new@example.com",
        name: "New User",
        role: "user",
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      },
    );
  }) as typeof fetch;

  try {
    await signup({
      name: "New User",
      email: "new@example.com",
      password: "password123",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requestedUrl, "/api/auth/signup");
  assert.equal(requestedMethod, "POST");
  assert.match(requestedBody, /new@example.com/);
});
