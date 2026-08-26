import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from "../errors";
import { mapErrorToResponse, withErrorHandling } from "./map-error";

describe("mapErrorToResponse", () => {
  it.each([
    [new UnauthorizedError(), 401],
    [new ForbiddenError(), 403],
    [new NotFoundError(), 404],
    [new ConflictError("EMAIL_ALREADY_REGISTERED", "Email is already registered"), 409],
    [new ValidationError("SPLITS_DO_NOT_BALANCE", "Splits do not balance"), 422],
    [new RateLimitError(30), 429],
  ])("maps %s to status %i", async (error, status) => {
    const response = mapErrorToResponse(error);
    expect(response.status).toBe(status);

    const body = await response.json();
    expect(body.error.code).toBe(error.code);
    expect(body.error.message).toBe(error.message);
  });

  it("carries a domain error's structured details through unchanged", async () => {
    const error = new ValidationError("SPLITS_DO_NOT_BALANCE", "Splits do not balance", {
      expected: "30000000",
      actual: "29999999",
      difference: "1",
    });

    const body = await mapErrorToResponse(error).json();
    expect(body.error.details).toEqual({
      expected: "30000000",
      actual: "29999999",
      difference: "1",
    });
  });

  it("adds a Retry-After header for RateLimitError, from retryAfterSeconds", () => {
    const response = mapErrorToResponse(new RateLimitError(42));
    expect(response.headers.get("retry-after")).toBe("42");
  });

  it("omits Retry-After for every other error type", () => {
    const response = mapErrorToResponse(new UnauthorizedError());
    expect(response.headers.get("retry-after")).toBeNull();
  });

  it("maps an unmapped error to a generic 500 with nothing internal in the body", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = mapErrorToResponse(new Error("password_hash=abc123 leaked by accident"));
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("password_hash");
    expect(JSON.stringify(body)).not.toContain("leaked");
    expect(typeof body.error.details.requestId).toBe("string");

    spy.mockRestore();
  });

  it("maps a thrown non-Error value the same generic way", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = mapErrorToResponse("just a string, not even an Error");
    expect(response.status).toBe(500);
    spy.mockRestore();
  });
});

describe("withErrorHandling", () => {
  const request = new NextRequest("http://localhost:3000/api/whatever");

  it("passes through a handler's own response untouched", async () => {
    const handler = withErrorHandling(async () => NextResponse.json({ ok: true }));
    const response = await handler(request);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("catches a thrown DomainError and maps it", async () => {
    const handler = withErrorHandling(async () => {
      throw new NotFoundError();
    });

    const response = await handler(request);
    expect(response.status).toBe(404);
  });

  it("forwards a dynamic route's extra context argument through to the handler", async () => {
    const context = { params: Promise.resolve({ id: "group-1" }) };
    const handler = withErrorHandling(async (_request, ctx: typeof context) => {
      const { id } = await ctx.params;
      return NextResponse.json({ id });
    });

    const response = await handler(request, context);
    expect(await response.json()).toEqual({ id: "group-1" });
  });
});
