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

// GET 응답을 1분 동안 기억합니다. 뒤로 가기나 탭 이동으로 같은 화면을 다시 그릴 때 스켈레톤 없이 바로 보이고,
// 같은 요청이 동시에 나가면 한 번만 보냅니다. 쓰기 요청이 끝나면(실패 포함) 전부 비워 내가 바꾼 내용은 바로 다시 받습니다.
// init.cache는 fetch와 같은 뜻입니다. "reload"는 기억을 건너뛰고 새로 받아 두고, "no-store"는 기억하지 않습니다.
// ponytail: TTL 60초 하나. 다른 사람이 바꾼 내용이 최대 1분 늦게 보입니다. 화면별로 달라야 하면 init에 maxAge를 받으세요.
const REMEMBER_MS = 60_000;
const remembered = new Map<string, { at: number; promise: Promise<unknown> }>();

export function clearRequestCache(): void { remembered.clear(); }

export function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  // 세션 확인(/auth/me)은 provider가 스스로 기억하고, 권한이 바뀌었을 때는 반드시 새로 받아야 합니다.
  // 취소 신호가 달린 요청은 다른 호출자와 나눠 쓰면 한쪽의 취소가 다른 쪽까지 끊으므로 기억하지 않습니다.
  const remember = method === "GET" && !path.startsWith("/auth/") && init?.cache !== "no-store" && !init?.signal;
  if (remember && init?.cache !== "reload") {
    const hit = remembered.get(path);
    if (hit && Date.now() - hit.at < REMEMBER_MS) return hit.promise as Promise<T>;
  }
  const promise = send<T>(path, init, method);
  if (remember) {
    remembered.set(path, { at: Date.now(), promise });
    promise.catch(() => { if (remembered.get(path)?.promise === promise) remembered.delete(path); });
  } else if (method !== "GET") {
    promise.then(clearRequestCache, clearRequestCache);
  }
  return promise;
}

// CSRF 토큰은 세션이 바뀔 때까지 그대로 쓸 수 있어, 쓰기 요청마다 받지 않고 기억합니다.
// 다른 탭의 로그아웃이나 세션 만료로 거절되면 send가 새로 받아 한 번 다시 보냅니다.
let csrfToken: Promise<string> | null = null;

export function forgetCsrfToken(): void { csrfToken = null; }

function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const pending = fetch("/api/v1/auth/csrf", { credentials: "same-origin", cache: "no-store" }).then(async (response) => {
    if (!response.ok) {
      throw new ApiRequestError(response.status, "CSRF_UNAVAILABLE", "요청을 준비할 수 없습니다.");
    }
    return ((await response.json()) as { token: string }).token;
  });
  csrfToken = pending;
  pending.catch(() => { if (csrfToken === pending) csrfToken = null; });
  return pending;
}

async function send<T>(path: string, init: RequestInit | undefined, method: string, retried = false): Promise<T> {
  const headers = new Headers(init?.headers);
  const write = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (write) headers.set("X-CSRF-TOKEN", await getCsrfToken());
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ code: "REQUEST_FAILED", message: "요청을 처리할 수 없습니다." }))) as ApiError;
    // 토큰 거절은 요청이 처리되기 전에 일어나므로 다시 보내도 두 번 저장되지 않습니다.
    if (write && !retried && error.code === "CSRF_INVALID") {
      forgetCsrfToken();
      return send<T>(path, init, method, true);
    }
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

  // 로그인과 로그아웃은 세션을 바꾸므로 다음 쓰기 요청에서 토큰을 새로 받습니다.
  if (write && path.startsWith("/auth/")) forgetCsrfToken();

  if (response.status === 202 || response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
