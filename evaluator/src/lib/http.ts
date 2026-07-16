// Typed fetch helpers. Every detector talks HTTP through these, never
// through a raw fetch call, so a connection failure is data (status 0)
// instead of a thrown exception.

export interface HttpResult {
  status: number;
  body: unknown;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// GET a URL and parse the response as JSON. A network error (refused,
// DNS, timeout) comes back as status 0 instead of throwing, so callers
// can treat "unreachable" as data.
export async function getJson(url: string, init: RequestInit = {}): Promise<HttpResult> {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let body: unknown = null;
    if (text.length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    return { status: res.status, body };
  } catch (err) {
    return { status: 0, body: { error: err instanceof Error ? err.message : String(err) } };
  }
}

export async function postJson(url: string, payload: unknown): Promise<HttpResult> {
  return getJson(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// Polls a URL with GET until it answers with any HTTP status, or the
// retry budget runs out. Used at Stage 0 to wait for the api and
// analytics services to come up.
export async function probe(url: string, maxTries = 60, intervalMs = 1000): Promise<HttpResult> {
  let last: HttpResult = { status: 0, body: null };
  for (let i = 0; i < maxTries; i++) {
    last = await getJson(url);
    if (last.status !== 0) return last;
    await sleep(intervalMs);
  }
  return last;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Narrows an HTTP response body to a plain object, or {} if it is not
// one, so callers can read fields with typeof-guards instead of
// scattering "as" casts.
export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

// True when a response body looks like NestJS's built-in "no route
// matched" fallback: { statusCode: 404, message: "Cannot POST /x/y",
// error: "Not Found" }. This app's own domain-error 404 has a
// different shape (lowercase error code, no "Cannot ..." message), so
// this tells "feature not implemented" apart from "feature exists,
// this id was not found".
export function looksLikeMissingRoute(body: unknown): boolean {
  const record = asRecord(body);
  return typeof record.message === 'string' && /^Cannot (GET|POST|PUT|PATCH|DELETE) /.test(record.message);
}
