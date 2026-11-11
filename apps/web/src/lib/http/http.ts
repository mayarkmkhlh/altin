export class HttpError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    super(`Request failed (${status})`);
    this.name = "HttpError";
    this.status = status;
    this.payload = payload;
  }
}

export async function getJson<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

export async function postJson<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new HttpError(0, null);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new HttpError(response.status, payload);
  return payload as T;
}

export function errorDetail(error: unknown): string | null {
  if (!(error instanceof HttpError) || !error.payload || typeof error.payload !== "object") return null;
  const record = error.payload as { error?: unknown; reason?: unknown };
  if (typeof record.reason === "string") return record.reason;
  return typeof record.error === "string" ? record.error : null;
}
