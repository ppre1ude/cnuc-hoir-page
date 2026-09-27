export type ApiError = {
  code: string;
  message: string;
};

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const method = (init?.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfResponse = await fetch("/api/v1/auth/csrf", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!csrfResponse.ok) {
      throw new ApiRequestError(csrfResponse.status, "CSRF_UNAVAILABLE", "요청을 준비할 수 없습니다.");
    }
    const { token } = (await csrfResponse.json()) as { token: string };
    headers.set("X-CSRF-TOKEN", token);
  }
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ code: "REQUEST_FAILED", message: "요청을 처리할 수 없습니다." }))) as ApiError;
    if (typeof window !== "undefined" && !path.startsWith("/auth/")) {
      if (response.status === 401) window.location.replace(new URL("/login", window.location.origin));
      if (response.status === 403 && error.code === "APPROVAL_REQUIRED") {
        window.location.replace(new URL("/application-status", window.location.origin));
      }
    }
    throw new ApiRequestError(response.status, error.code, error.message);
  }

  if (response.status === 202 || response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
