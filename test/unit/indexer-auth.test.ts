import { expect } from "chai";
import type { Request, Response, NextFunction } from "express";
import { createIndexerAuthMiddleware } from "@medvault/indexer/lib";

function mockReq(path: string, auth?: string): Request {
  return {
    path,
    headers: auth ? { authorization: auth } : {},
  } as Request;
}

function runMiddleware(
  secret: string,
  path: string,
  auth?: string,
  healthPublic = true
): { status?: number; body?: unknown; nextCalled: boolean } {
  const middleware = createIndexerAuthMiddleware({ apiSecret: secret, healthPublic });
  let status: number | undefined;
  let body: unknown;
  let nextCalled = false;

  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as Response;

  const next: NextFunction = () => {
    nextCalled = true;
  };

  middleware(mockReq(path, auth), res, next);
  return { status, body, nextCalled };
}

describe("indexer auth middleware", function () {
  it("IDX-AUTH-01: no secret — routes remain public", function () {
    const result = runMiddleware("", "/trials");
    expect(result.nextCalled).to.equal(true);
    expect(result.status).to.equal(undefined);
  });

  it("IDX-AUTH-02: secret set — /trials requires Bearer", function () {
    const denied = runMiddleware("test-secret", "/trials");
    expect(denied.nextCalled).to.equal(false);
    expect(denied.status).to.equal(401);
    expect((denied.body as { code: string }).code).to.equal("INDEXER_AUTH_REQUIRED");

    const ok = runMiddleware("test-secret", "/trials", "Bearer test-secret");
    expect(ok.nextCalled).to.equal(true);
  });

  it("IDX-AUTH-03: /health public by default when secret set", function () {
    const result = runMiddleware("test-secret", "/health");
    expect(result.nextCalled).to.equal(true);
  });

  it("IDX-AUTH-04: /health protected when healthPublic=false", function () {
    const denied = runMiddleware("test-secret", "/health", undefined, false);
    expect(denied.status).to.equal(401);

    const ok = runMiddleware("test-secret", "/health", "Bearer test-secret", false);
    expect(ok.nextCalled).to.equal(true);
  });
});
