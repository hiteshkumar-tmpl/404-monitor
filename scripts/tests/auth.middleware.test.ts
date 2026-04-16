import test from "node:test";
import assert from "node:assert/strict";

import {
  authenticate,
  generateToken,
  requireAdmin,
  verifyToken,
} from "../../artifacts/api-server/src/middleware/auth.ts";

function createResponseRecorder() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

test("generateToken and verifyToken round-trip the auth payload", () => {
  const payload = { userId: 42, email: "owner@example.com", role: "admin" as const };
  const token = generateToken(payload);
  const decoded = verifyToken(token);

  assert.ok(token.length > 20);
  assert.ok(decoded);
  assert.equal(decoded.userId, payload.userId);
  assert.equal(decoded.email, payload.email);
  assert.equal(decoded.role, payload.role);
});

test("authenticate rejects requests without an auth cookie", () => {
  const req = { cookies: {} } as any;
  const res = createResponseRecorder();
  let nextCalled = false;

  authenticate(req, res as any, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Authentication required" });
});

test("authenticate accepts valid auth cookies and populates req.user", () => {
  const token = generateToken({
    userId: 7,
    email: "teammate@example.com",
    role: "user",
  });
  const req = { cookies: { auth_token: token } } as any;
  const res = createResponseRecorder();
  let nextCalled = false;

  authenticate(req, res as any, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.user?.email, "teammate@example.com");
});

test("requireAdmin blocks non-admin users", () => {
  const req = {
    user: { userId: 8, email: "member@example.com", role: "user" },
  } as any;
  const res = createResponseRecorder();
  let nextCalled = false;

  requireAdmin(req, res as any, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: "Admin access required" });
});
