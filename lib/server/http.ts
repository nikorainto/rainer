import type { NextRequest } from "next/server";

export class PublicError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "PublicError";
    this.status = status;
  }
}

export function clientKey(request: NextRequest): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 80);
  const forwarded = request.headers.get("x-forwarded-for");
  const hops = forwarded
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return (hops?.at(-1) || "local").slice(0, 80);
}

export function json(body: unknown, init?: { status?: number; cache?: string }) {
  return Response.json(body, {
    status: init?.status ?? 200,
    headers: { "Cache-Control": init?.cache ?? "no-store" },
  });
}

export function errorJson(error: unknown, fallback: string) {
  if (error instanceof PublicError) {
    return json({ ok: false, error: error.message }, { status: error.status });
  }
  return json({ ok: false, error: fallback }, { status: 502 });
}

export function tooMany() {
  return json(
    { ok: false, error: "Too many requests. Wait a moment and try again." },
    { status: 429 },
  );
}
