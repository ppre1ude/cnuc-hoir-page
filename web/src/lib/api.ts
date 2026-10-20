import { loginPath } from "./returnPath";

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

// 인증 리다이렉트는 여기서만 합니다(docs/adr/0001). 전체 새로고침으로 이동해 이전 화면 상태를 남기지 않습니다.
export function redirectTo(path: string): void {
  window.location.replace(new URL(path, window.location.origin));
}

const permissionDeniedListeners = new Set<() => void>();

// 서버가 권한 부족을 알리면 세션 provider가 세션을 다시 받을 수 있게 알립니다.
export function onPermissionDenied(listener: () => void): () => void {
  permissionDeniedListeners.add(listener);
  return () => { permissionDeniedListeners.delete(listener); };
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
      if (response.status === 401) redirectTo(loginPath(window.location));
      if (response.status === 403 && error.code === "APPROVAL_REQUIRED") redirectTo("/application-status");
    }
    if (response.status === 403 && error.code === "PERMISSION_REQUIRED") {
      permissionDeniedListeners.forEach((listener) => listener());
    }
    throw new ApiRequestError(response.status, error.code ?? "REQUEST_FAILED",
      error.message || "서버에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.");
  }

  if (response.status === 202 || response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
