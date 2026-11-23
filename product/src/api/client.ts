import { z } from "zod";
import { env } from "@/lib/env";

const DEFAULT_TIMEOUT_MS = 20_000;

type NetworkDiagnostic = Readonly<{
  requestId: string;
  statusCode: number | null;
  transportCode: number;
}>;

function logNetworkFailure(diagnostic: NetworkDiagnostic): void {
  if (!(process.env.NODE_ENV === "development")) return;
  console.warn(
    `[network] requestId=${diagnostic.requestId} status=${diagnostic.statusCode ?? "none"} transport=${diagnostic.transportCode}`,
  );
}

function transportCode(error: unknown): number {
  if (error instanceof DOMException && error.name === "AbortError") return 1;
  if (error instanceof TypeError) return 2;
  return 0;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string[]>;

  constructor(
    status: number,
    message: string,
    fields: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
    this.code =
      status === 401
        ? "UNAUTHORIZED"
        : status === 403
          ? "FORBIDDEN"
          : status === 409
            ? "CONFLICT"
            : status === 400 || status === 422
              ? "VALIDATION_ERROR"
              : "REQUEST_FAILED";
  }
}

export function apiRequest<T>(
  path: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<T>;
export function apiRequest(path: string, init?: RequestInit): Promise<unknown>;
export async function apiRequest(
  path: string,
  init: RequestInit = {},
  schema?: z.ZodType,
): Promise<unknown> {
  const baseUrl = env.apiBaseUrl;
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new Error("API paths must start with a single slash.");
  const requestId = crypto.randomUUID();
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  headers.set("X-Request-ID", requestId);
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    DEFAULT_TIMEOUT_MS,
  );
  const abort = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) abort();
  else init.signal?.addEventListener("abort", abort, { once: true });
  let statusCode: number | null = null;

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers,
    });
    statusCode = response.status;

    if (!response.ok) {
      const detail = z
        .object({
          error: z.object({
            message: z.string().max(500),
            fields: z
              .record(z.string().max(50), z.array(z.string().max(500)).max(10))
              .optional(),
          }),
        })
        .safeParse(await response.json().catch(() => null));
      throw new ApiError(
        response.status,
        detail.success
          ? detail.data.error.message
          : "The request could not be completed.",
        detail.success ? detail.data.error.fields : undefined,
      );
    }
    const data: unknown =
      response.status === 204 ? undefined : await response.json();
    return schema ? schema.parse(data) : data;
  } catch (error) {
    logNetworkFailure({
      requestId,
      statusCode,
      transportCode: statusCode === null ? transportCode(error) : 0,
    });
    throw error;
  } finally {
    window.clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abort);
  }
}
