# 세션 module 구현 계획

> **For agentic workers:** 작업은 순서대로 하나씩 실행합니다. 각 작업은 실패하는 테스트 → 구현 → 통과 → 커밋입니다. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회원·운영진 화면이 `/auth/me`를 레이아웃에서 한 번만 받고, 대기·느린 대기·실패·권한 없음 화면을 페이지 문지기 하나가 그리게 한다.

**Architecture:** 요청 transport(`lib/api.ts`)가 인증 리다이렉트와 권한 부족 알림을 맡습니다. 레이아웃의 `SessionProvider`가 세션을 받아 context로 내리고, 각 라우트 페이지는 `PageGate`로 본문을 감싸 스켈레톤과 권한을 넘깁니다. 본문은 `useSession()`으로 준비된 세션을 동기적으로 읽습니다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules(토큰은 `web/src/styles/tokens.css`), Vitest + Testing Library + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-04-session-module-design.md`. 용어는 `CONTEXT.md`, 리다이렉트 소유는 `docs/adr/0001-transport-owns-session-redirects.md`.

## Global Constraints

- 작업 위치: `C:\cnuc-hoir`, 브랜치 `feature/session-module`. 웹 명령은 `C:\cnuc-hoir\web`에서 실행합니다: `npx vitest run <경로>`, `npx eslint <경로>`, `npx tsc --noEmit`, `npx next build`.
- Next.js 16은 학습 데이터와 다를 수 있습니다. 라우팅·레이아웃 동작이 의심스러우면 `web/node_modules/next/dist/docs/`를 확인합니다(`web/AGENTS.md`). `web/AGENTS.md`, `web/CLAUDE.md`는 커밋하지 않습니다.
- 새 CSS는 토큰만 씁니다. 새 의존성을 추가하지 않습니다. 실제 사람 이름을 코드·테스트에 넣지 않습니다(테스트 이름은 "단원", "수석", "관리자" 등).
- 화면 문구는 스펙의 문구를 글자 그대로 씁니다:
  - 대기 3초 경과: `서버를 깨우고 있습니다. 오랜만에 접속하면 1분 정도 걸릴 수 있어요.`
  - 실패: `서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.`, 버튼 `다시 시도`
  - 권한 없음: `이 기능을 쓸 권한이 없습니다.`, 링크 `일정으로 가기`(`/dashboard`)
  - 화면 읽기용 대기: `불러오는 중입니다.`
- 페이지는 인증 때문에 리다이렉트하지 않습니다. 리다이렉트는 `lib/api.ts`의 `redirectTo`와 `SessionProvider`만 합니다.
- 모션 줄이기(`prefers-reduced-motion: reduce`)에서는 펄스와 대기 그림 애니메이션을 멈춥니다.
- 커밋 메시지는 한국어이고 마지막 줄은 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`입니다. 푸시하지 않습니다.
- 전체 웹 테스트가 병렬 부하로 5초 시간 초과를 낼 때가 있습니다. 시간 초과가 나면 해당 파일만 따로 다시 돌려 두 결과를 모두 보고합니다.

---

### Task 1: transport의 리다이렉트 함수와 권한 부족 알림

**Files:**
- Modify: `web/src/lib/api.ts`
- Test: `web/src/lib/api.test.ts`

**Interfaces:**
- Produces: `redirectTo(path: string): void`, `onPermissionDenied(listener: () => void): () => void`(해제 함수 반환). `apiRequest`가 403 `PERMISSION_REQUIRED`에서 등록된 함수를 모두 부릅니다.

- [ ] **Step 1: 실패하는 테스트를 추가한다** — `web/src/lib/api.test.ts` 끝에 추가하고, 맨 위 import를 `import { apiRequest, onPermissionDenied } from "./api";`로 바꿉니다.

```ts
function respond(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status, json: async () => body }));
}

test("회원 요청이 401이면 로그인으로 이동합니다", async () => {
  const replace = vi.fn();
  vi.stubGlobal("window", { location: { origin: "https://choir.example", replace } });
  respond(401, { code: "UNAUTHENTICATED", message: "로그인이 필요합니다." });
  await expect(apiRequest("/notices")).rejects.toMatchObject({ status: 401 });
  expect(replace).toHaveBeenCalledWith(new URL("/login", "https://choir.example"));
});

test("세션 확인 요청의 401은 transport가 이동시키지 않습니다", async () => {
  const replace = vi.fn();
  vi.stubGlobal("window", { location: { origin: "https://choir.example", replace } });
  respond(401, { code: "UNAUTHENTICATED", message: "로그인이 필요합니다." });
  await expect(apiRequest("/auth/me")).rejects.toMatchObject({ status: 401 });
  expect(replace).not.toHaveBeenCalled();
});

test("승인 필요 403이면 가입 상태 화면으로 이동합니다", async () => {
  const replace = vi.fn();
  vi.stubGlobal("window", { location: { origin: "https://choir.example", replace } });
  respond(403, { code: "APPROVAL_REQUIRED", message: "승인 필요" });
  await expect(apiRequest("/notices")).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
  expect(replace).toHaveBeenCalledWith(new URL("/application-status", "https://choir.example"));
});

test("권한 부족 403은 이동하지 않고 등록된 함수에 알립니다", async () => {
  const replace = vi.fn();
  vi.stubGlobal("window", { location: { origin: "https://choir.example", replace } });
  const listener = vi.fn();
  const unsubscribe = onPermissionDenied(listener);
  respond(403, { code: "PERMISSION_REQUIRED", message: "권한 없음" });
  await expect(apiRequest("/admin/notices")).rejects.toMatchObject({ code: "PERMISSION_REQUIRED" });
  expect(listener).toHaveBeenCalledTimes(1);
  expect(replace).not.toHaveBeenCalled();
  unsubscribe();
  await expect(apiRequest("/admin/notices")).rejects.toMatchObject({ code: "PERMISSION_REQUIRED" });
  expect(listener).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: 실패를 확인한다** — Run: `npx vitest run src/lib/api.test.ts` Expected: FAIL (`onPermissionDenied` is not exported).

- [ ] **Step 3: 구현한다** — `web/src/lib/api.ts`의 `ApiRequestError` 클래스 아래에 추가합니다.

```ts
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
```

`apiRequest`의 `if (!response.ok) { ... }` 블록을 아래로 바꿉니다.

```ts
  if (!response.ok) {
    const error = (await response.json().catch(() => ({ code: "REQUEST_FAILED", message: "요청을 처리할 수 없습니다." }))) as ApiError;
    if (typeof window !== "undefined" && !path.startsWith("/auth/")) {
      if (response.status === 401) redirectTo("/login");
      if (response.status === 403 && error.code === "APPROVAL_REQUIRED") redirectTo("/application-status");
    }
    if (response.status === 403 && error.code === "PERMISSION_REQUIRED") {
      permissionDeniedListeners.forEach((listener) => listener());
    }
    throw new ApiRequestError(response.status, error.code, error.message);
  }
```

- [ ] **Step 4: 통과를 확인한다** — Run: `npx vitest run src/lib/api.test.ts` Expected: PASS (7 tests).

- [ ] **Step 5: 커밋**

```bash
git add web/src/lib/api.ts web/src/lib/api.test.ts
git commit -m "feat: 요청 transport에 리다이렉트 함수와 권한 부족 알림 추가

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 세션 provider와 테스트 헬퍼

**Files:**
- Create: `web/src/features/auth/SessionProvider.tsx`
- Create: `web/src/test/session.tsx`
- Test: `web/src/features/auth/SessionProvider.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `redirectTo`, `onPermissionDenied`, `ApiRequestError`; `session.ts`의 `getSession`, `isStaff`, `MemberSession`.
- Produces:
  - `SessionProvider({ children, requireStaff?: boolean, initialSession?: MemberSession })`
  - `type SessionStatus = "loading" | "ready" | "failed"`
  - `useSessionState(): { status: SessionStatus; session: MemberSession | null; refresh: () => void }`
  - `useSession(): MemberSession`(세션이 없으면 예외)
  - 테스트 헬퍼 `sessionFixture(overrides?: Partial<MemberSession>): MemberSession`, `renderWithSession(ui, session?, options?)`

- [ ] **Step 1: 테스트 헬퍼를 만든다** — `web/src/test/session.tsx`:

```tsx
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { SessionProvider } from "../features/auth/SessionProvider";
import type { MemberSession } from "../features/auth/session";

// 승인된 활동 단원이 기본값입니다. 권한이 필요한 테스트는 permissions나 admin을 덮어씁니다.
export function sessionFixture(overrides: Partial<MemberSession> = {}): MemberSession {
  return {
    id: 1, name: "단원", status: "APPROVED", memberType: "ACTIVE", admin: false,
    part: null, cohort: null, roles: [], permissions: ["VIEW_MINUTES"], ...overrides,
  };
}

// 세션 요청 없이 준비된 세션을 넣어 그립니다. rerender해도 세션이 유지되도록 wrapper로 감쌉니다.
export function renderWithSession(ui: ReactElement, session: MemberSession = sessionFixture(),
  options: Omit<RenderOptions, "wrapper"> = {}) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <SessionProvider initialSession={session}>{children}</SessionProvider>;
  }
  return render(ui, { ...options, wrapper: Wrapper });
}
```

- [ ] **Step 2: 실패하는 테스트를 쓴다** — `web/src/features/auth/SessionProvider.test.tsx`:

```tsx
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider, useSession, useSessionState } from "./SessionProvider";
import { getSession } from "./session";
import { ApiRequestError, apiRequest, redirectTo } from "../../lib/api";
import { sessionFixture } from "../../test/session";

vi.mock("./session", async (importOriginal) => ({ ...await importOriginal<typeof import("./session")>(), getSession: vi.fn() }));
vi.mock("../../lib/api", async (importOriginal) => ({ ...await importOriginal<typeof import("../../lib/api")>(), redirectTo: vi.fn() }));

function Probe() {
  const { status, session, refresh } = useSessionState();
  return <div>
    <p>상태:{status}</p>
    <p>이름:{session?.name ?? "없음"}</p>
    <button type="button" onClick={refresh}>새로 받기</button>
  </div>;
}

beforeEach(() => { vi.mocked(getSession).mockReset(); vi.mocked(redirectTo).mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("승인된 세션을 받으면 준비 상태가 됩니다", async () => {
  vi.mocked(getSession).mockResolvedValue(sessionFixture({ name: "단원" }));
  render(<SessionProvider><Probe /></SessionProvider>);
  expect(screen.getByText("상태:loading")).toBeInTheDocument();
  expect(await screen.findByText("상태:ready")).toBeInTheDocument();
  expect(screen.getByText("이름:단원")).toBeInTheDocument();
  expect(getSession).toHaveBeenCalledTimes(1);
});

test("승인되지 않은 계정은 가입 상태 화면으로 보냅니다", async () => {
  vi.mocked(getSession).mockResolvedValue(sessionFixture({ status: "APPROVAL_PENDING", memberType: null }));
  render(<SessionProvider><Probe /></SessionProvider>);
  await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/application-status"));
  expect(screen.getByText("상태:loading")).toBeInTheDocument();
});

test("401이면 로그인으로 보냅니다", async () => {
  vi.mocked(getSession).mockRejectedValue(new ApiRequestError(401, "UNAUTHENTICATED", "로그인이 필요합니다."));
  render(<SessionProvider><Probe /></SessionProvider>);
  await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/login"));
});

test("그 밖의 실패는 실패 상태가 되고, 다시 받으면 준비 상태가 됩니다", async () => {
  vi.mocked(getSession).mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce(sessionFixture({ name: "단원" }));
  render(<SessionProvider><Probe /></SessionProvider>);
  expect(await screen.findByText("상태:failed")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "새로 받기" }));
  expect(await screen.findByText("상태:ready")).toBeInTheDocument();
  expect(redirectTo).not.toHaveBeenCalled();
});

test("운영진 영역은 운영진이 아니면 일정으로 보냅니다", async () => {
  vi.mocked(getSession).mockResolvedValue(sessionFixture());
  render(<SessionProvider requireStaff><Probe /></SessionProvider>);
  await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/dashboard"));
});

test("운영진 영역은 운영진이면 준비 상태가 됩니다", async () => {
  vi.mocked(getSession).mockResolvedValue(sessionFixture({ permissions: ["MANAGE_EVENTS", "VIEW_MINUTES"] }));
  render(<SessionProvider requireStaff><Probe /></SessionProvider>);
  expect(await screen.findByText("상태:ready")).toBeInTheDocument();
  expect(redirectTo).not.toHaveBeenCalled();
});

test("처음 값을 받으면 요청하지 않고 바로 준비 상태입니다", () => {
  render(<SessionProvider initialSession={sessionFixture({ name: "관리자" })}><Probe /></SessionProvider>);
  expect(screen.getByText("상태:ready")).toBeInTheDocument();
  expect(screen.getByText("이름:관리자")).toBeInTheDocument();
  expect(getSession).not.toHaveBeenCalled();
});

test("다시 받다 실패해도 이미 받은 세션을 유지합니다", async () => {
  vi.mocked(getSession).mockRejectedValue(new TypeError("Failed to fetch"));
  render(<SessionProvider initialSession={sessionFixture({ name: "단원" })}><Probe /></SessionProvider>);
  await userEvent.click(screen.getByRole("button", { name: "새로 받기" }));
  await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
  expect(screen.getByText("상태:ready")).toBeInTheDocument();
  expect(screen.getByText("이름:단원")).toBeInTheDocument();
});

test("권한 부족 응답을 받으면 세션을 다시 받고, 운영진이 아니게 되면 일정으로 보냅니다", async () => {
  vi.mocked(getSession).mockResolvedValue(sessionFixture());
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: false, status: 403, json: async () => ({ code: "PERMISSION_REQUIRED", message: "권한 없음" }),
  }));
  render(<SessionProvider requireStaff initialSession={sessionFixture({ permissions: ["MANAGE_EVENTS", "VIEW_MINUTES"] })}><Probe /></SessionProvider>);
  await act(async () => { await apiRequest("/admin/notices").catch(() => undefined); });
  await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/dashboard"));
});

test("늦게 도착한 이전 응답은 버립니다", async () => {
  let resolveFirst: (value: ReturnType<typeof sessionFixture>) => void = () => undefined;
  vi.mocked(getSession)
    .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
    .mockResolvedValueOnce(sessionFixture({ name: "새 세션" }));
  render(<SessionProvider><Probe /></SessionProvider>);
  await userEvent.click(screen.getByRole("button", { name: "새로 받기" }));
  expect(await screen.findByText("이름:새 세션")).toBeInTheDocument();
  await act(async () => { resolveFirst(sessionFixture({ name: "이전 세션" })); });
  expect(screen.getByText("이름:새 세션")).toBeInTheDocument();
});

test("준비되기 전에 useSession을 부르면 예외를 던집니다", () => {
  vi.mocked(getSession).mockReturnValue(new Promise(() => undefined));
  function Reader() { useSession(); return null; }
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  expect(() => render(<SessionProvider><Reader /></SessionProvider>)).toThrow();
});
```

- [ ] **Step 3: 실패를 확인한다** — Run: `npx vitest run src/features/auth/SessionProvider.test.tsx` Expected: FAIL (`./SessionProvider` 없음).

- [ ] **Step 4: 구현한다** — `web/src/features/auth/SessionProvider.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiRequestError, onPermissionDenied, redirectTo } from "../../lib/api";
import { getSession, isStaff, type MemberSession } from "./session";

export type SessionStatus = "loading" | "ready" | "failed";
type SessionState = { status: SessionStatus; session: MemberSession | null; refresh: () => void };

const SessionContext = createContext<SessionState | null>(null);

// 회원·운영진 레이아웃이 감쌉니다. /auth/me를 마운트 때 한 번 받고, 다시 시도·권한 부족 알림·자기 직책 변경 때만 다시 받습니다.
export function SessionProvider({ children, requireStaff = false, initialSession }: {
  children: ReactNode;
  requireStaff?: boolean;
  initialSession?: MemberSession;
}) {
  const [session, setSession] = useState<MemberSession | null>(initialSession ?? null);
  const [status, setStatus] = useState<SessionStatus>(initialSession ? "ready" : "loading");
  const latest = useRef(0);
  const hasSession = useRef(Boolean(initialSession));
  const skipFirstLoad = useRef(Boolean(initialSession));

  const load = useCallback(() => {
    const request = ++latest.current;
    getSession().then((value) => {
      if (request !== latest.current) return;
      if (value.status !== "APPROVED") { redirectTo("/application-status"); return; }
      if (requireStaff && !isStaff(value)) { redirectTo("/dashboard"); return; }
      hasSession.current = true;
      setSession(value);
      setStatus("ready");
    }).catch((error: unknown) => {
      if (request !== latest.current) return;
      if (error instanceof ApiRequestError && error.status === 401) { redirectTo("/login"); return; }
      // 이미 받은 세션이 있으면 다시 받기 실패는 화면을 바꾸지 않습니다.
      if (!hasSession.current) setStatus("failed");
    });
  }, [requireStaff]);

  const refresh = useCallback(() => {
    if (!hasSession.current) setStatus("loading");
    load();
  }, [load]);

  useEffect(() => {
    if (skipFirstLoad.current) skipFirstLoad.current = false;
    else load();
    return onPermissionDenied(load);
  }, [load]);

  const value = useMemo(() => ({ status, session, refresh }), [status, session, refresh]);
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSessionState(): SessionState {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider 안에서만 세션을 읽을 수 있습니다.");
  return value;
}

// PageGate 안의 본문은 세션이 준비된 뒤에만 그려지므로 항상 세션을 받습니다.
export function useSession(): MemberSession {
  const { session } = useSessionState();
  if (!session) throw new Error("PageGate 안에서만 useSession을 쓸 수 있습니다.");
  return session;
}
```

React 19에서는 `<SessionContext value>`를 Provider로 쓸 수 있습니다. 린트가 거부하면 `<SessionContext.Provider value={value}>`로 바꿉니다.

- [ ] **Step 5: 통과를 확인한다** — Run: `npx vitest run src/features/auth/SessionProvider.test.tsx && npx eslint src/features/auth src/test && npx tsc --noEmit` Expected: PASS (11 tests), 린트·타입 오류 없음. StrictMode 이중 실행이나 effect 정리 순서 때문에 `getSession` 호출 수 단언이 흔들리면, 동작이 스펙대로인지 확인한 뒤 단언을 "적어도 한 번"으로 바꾸지 말고 원인을 고칩니다.

- [ ] **Step 6: 커밋**

```bash
git add web/src/features/auth/SessionProvider.tsx web/src/features/auth/SessionProvider.test.tsx web/src/test/session.tsx
git commit -m "feat: 레이아웃에서 세션을 한 번 받는 세션 provider 추가

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 스켈레톤 조각, 대기 그림, 페이지 문지기

**Files:**
- Modify: `web/src/components/ui/index.tsx`, `web/src/components/ui/ui.module.css`
- Create: `web/src/features/auth/WaitingScore.tsx`, `web/src/features/auth/WaitingScore.module.css`
- Create: `web/src/features/auth/PageGate.tsx`, `web/src/features/auth/PageGate.module.css`
- Test: `web/src/features/auth/PageGate.test.tsx`, `web/src/components/ui/Skeleton.test.tsx`

**Interfaces:**
- Consumes: Task 2의 `useSessionState`, `SessionProvider`, 테스트 헬퍼.
- Produces:
  - `Skeleton({ className?, width?, height? })`: `aria-hidden` 막대
  - `SkeletonRows({ count?: number = 4, label?: string, className? })`: 목록 행 자리 표시. `label`이 있으면 `role="status"`로 그 문구를 화면 읽기 프로그램에 알립니다.
  - `WaitingScore()`
  - `PageGate({ skeleton: ReactNode, permission?: Permission, children: ReactNode })`

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `web/src/components/ui/Skeleton.test.tsx`:

```tsx
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Skeleton, SkeletonRows } from ".";

afterEach(cleanup);

test("막대는 화면 읽기 프로그램에서 숨깁니다", () => {
  const { container } = render(<Skeleton width="40%" />);
  expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
});

test("행 스켈레톤은 문구가 있을 때만 상태를 알립니다", () => {
  const { rerender } = render(<SkeletonRows count={3} label="공지를 불러오는 중입니다." />);
  expect(screen.getByRole("status")).toHaveTextContent("공지를 불러오는 중입니다.");
  rerender(<SkeletonRows count={3} />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
```

`web/src/features/auth/PageGate.test.tsx`:

```tsx
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageGate } from "./PageGate";
import { SessionProvider, useSession } from "./SessionProvider";
import { getSession } from "./session";
import { renderWithSession, sessionFixture } from "../../test/session";

vi.mock("./session", async (importOriginal) => ({ ...await importOriginal<typeof import("./session")>(), getSession: vi.fn() }));
vi.mock("../../lib/api", async (importOriginal) => ({ ...await importOriginal<typeof import("../../lib/api")>(), redirectTo: vi.fn() }));

function Body() { return <p>본문:{useSession().name}</p>; }
const skeleton = <p>스켈레톤</p>;

beforeEach(() => vi.mocked(getSession).mockReset());
afterEach(() => { cleanup(); vi.useRealTimers(); });

test("세션을 기다리는 동안 스켈레톤을 보여 주고 3초 뒤 대기 안내를 띄웁니다", () => {
  vi.useFakeTimers();
  vi.mocked(getSession).mockReturnValue(new Promise(() => undefined));
  render(<SessionProvider><PageGate skeleton={skeleton}><Body /></PageGate></SessionProvider>);
  expect(screen.getByText("스켈레톤")).toBeInTheDocument();
  expect(screen.getByText("불러오는 중입니다.")).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(2999); });
  expect(screen.queryByText(/서버를 깨우고 있습니다/)).not.toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(1); });
  expect(screen.getByText("서버를 깨우고 있습니다. 오랜만에 접속하면 1분 정도 걸릴 수 있어요.")).toBeInTheDocument();
  expect(screen.getByText("스켈레톤")).toBeInTheDocument();
});

test("실패하면 안내와 다시 시도 버튼을 보여 주고, 다시 시도하면 본문을 그립니다", async () => {
  vi.mocked(getSession).mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce(sessionFixture({ name: "단원" }));
  render(<SessionProvider><PageGate skeleton={skeleton}><Body /></PageGate></SessionProvider>);
  expect(await screen.findByRole("alert")).toHaveTextContent("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(await screen.findByText("본문:단원")).toBeInTheDocument();
});

test("권한이 없으면 안내와 일정 링크를 보여 줍니다", () => {
  renderWithSession(<PageGate skeleton={skeleton} permission="APPROVE_APPLICATIONS"><Body /></PageGate>,
    sessionFixture({ permissions: ["MANAGE_EVENTS", "VIEW_MINUTES"] }));
  expect(screen.getByText("이 기능을 쓸 권한이 없습니다.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "일정으로 가기" })).toHaveAttribute("href", "/dashboard");
  expect(screen.queryByText(/본문:/)).not.toBeInTheDocument();
});

test("권한이 있으면 본문을 그립니다", () => {
  renderWithSession(<PageGate skeleton={skeleton} permission="MANAGE_EVENTS"><Body /></PageGate>,
    sessionFixture({ name: "수석", permissions: ["MANAGE_EVENTS", "VIEW_MINUTES"] }));
  expect(screen.getByText("본문:수석")).toBeInTheDocument();
  expect(screen.queryByText("스켈레톤")).not.toBeInTheDocument();
});

test("권한이 필요 없는 페이지는 준비되면 바로 본문을 그립니다", () => {
  renderWithSession(<PageGate skeleton={skeleton}><Body /></PageGate>);
  expect(screen.getByText("본문:단원")).toBeInTheDocument();
});
```

- [ ] **Step 2: 실패를 확인한다** — Run: `npx vitest run src/features/auth/PageGate.test.tsx src/components/ui/Skeleton.test.tsx` Expected: FAIL (모듈 없음, `Skeleton` 미export).

- [ ] **Step 3: 스켈레톤 조각을 추가한다** — `web/src/components/ui/index.tsx` 끝에 추가:

```tsx
// 내용 자리를 잡는 막대입니다. 화면 읽기 프로그램에는 감춥니다.
export function Skeleton({ className, width, height }: { className?: string; width?: string; height?: string }) {
  return <span aria-hidden="true" className={join(styles.skeleton, className)} style={{ width, height }} />;
}

// 목록 행 모양의 자리 표시입니다. 데이터를 받는 동안 목록 자리에 두며, label이 있으면 그 문구를 알립니다.
export function SkeletonRows({ count = 4, label, className }: { count?: number; label?: string; className?: string }) {
  return <div className={join(styles.skeletonRows, className)} role={label ? "status" : undefined}>
    {label && <span className={styles.srOnly}>{label}</span>}
    {Array.from({ length: count }, (_, index) => <div key={index} className={styles.skeletonRow} aria-hidden="true">
      <span className={styles.skeleton} style={{ width: `${48 + ((index * 17) % 36)}%` }} />
      <span className={styles.skeleton} style={{ width: "18%" }} />
    </div>)}
  </div>;
}
```

`web/src/components/ui/ui.module.css`의 `@media (max-width: 760px)` 블록 앞에 추가:

```css
.skeleton { display: block; height: 1em; border-radius: var(--radius-small); background: var(--color-neutral-background); animation: skeletonPulse 1.6s ease-in-out infinite; }
.skeletonRows { display: grid; }
.skeletonRow { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); min-height: var(--control-large); padding-block: var(--space-4); border-bottom: 1px solid var(--color-line); }
.srOnly { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@keyframes skeletonPulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
@media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
```

- [ ] **Step 4: 대기 그림을 만든다** — `web/src/features/auth/WaitingScore.tsx`:

```tsx
import styles from "./WaitingScore.module.css";

// 첫 화면의 흐르는 오선과 음표를 줄인 대기 표시입니다. 음표 하나가 오선을 따라 천천히 오갑니다.
export function WaitingScore() {
  return <svg className={styles.score} viewBox="0 0 240 72" aria-hidden="true" focusable="false">
    <g className={styles.staff}>
      {[18, 28, 38, 48, 58].map((y) => <path key={y} d={`M0 ${y} C60 ${y - 6} 120 ${y + 6} 180 ${y} S236 ${y - 4} 240 ${y}`} />)}
    </g>
    <g className={styles.note}>
      <ellipse rx="7" ry="5" transform="rotate(-20)" />
      <path d="M6 -1 V-28" />
    </g>
  </svg>;
}
```

`web/src/features/auth/WaitingScore.module.css`:

```css
.score { display: block; width: 200px; max-width: 100%; height: auto; color: var(--color-brand); overflow: visible; }
.staff path { fill: none; stroke: currentColor; stroke-width: 1.5; opacity: .45; }
.note { fill: currentColor; stroke: currentColor; stroke-width: 2; animation: travel 2.8s ease-in-out infinite alternate; }
@keyframes travel {
  0% { transform: translate(36px, 43px); }
  50% { transform: translate(120px, 33px); }
  100% { transform: translate(204px, 43px); }
}
@media (prefers-reduced-motion: reduce) { .note { animation: none; transform: translate(120px, 33px); } }
```

- [ ] **Step 5: 문지기를 만든다** — `web/src/features/auth/PageGate.tsx`:

```tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ActionLink, Button, Feedback } from "../../components/ui";
import { can, type Permission } from "./session";
import { useSessionState } from "./SessionProvider";
import { WaitingScore } from "./WaitingScore";
import styles from "./PageGate.module.css";

const SLOW_AFTER_MS = 3000;

// 각 라우트 페이지가 본문을 감쌉니다. 대기·느린 대기·실패·권한 없음 화면은 여기서만 그립니다.
export function PageGate({ skeleton, permission, children }: {
  skeleton: ReactNode;
  permission?: Permission;
  children: ReactNode;
}) {
  const { status, session, refresh } = useSessionState();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (status !== "loading") return;
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (status === "failed") {
    return <div className={styles.message}>
      <Feedback tone="error">서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.</Feedback>
      <Button variant="secondary" onClick={() => { setSlow(false); refresh(); }}>다시 시도</Button>
    </div>;
  }
  if (status === "loading" || !session) {
    return <div className={styles.waiting} aria-busy="true">
      <span className={styles.srOnly} role="status">불러오는 중입니다.</span>
      {skeleton}
      {slow && <div className={styles.slow}>
        <WaitingScore />
        <p role="status">서버를 깨우고 있습니다. 오랜만에 접속하면 1분 정도 걸릴 수 있어요.</p>
      </div>}
    </div>;
  }
  if (permission && !can(session, permission)) {
    return <div className={styles.message}>
      <p>이 기능을 쓸 권한이 없습니다.</p>
      <ActionLink href="/dashboard" variant="secondary">일정으로 가기</ActionLink>
    </div>;
  }
  return children;
}
```

`web/src/features/auth/PageGate.module.css`:

```css
.waiting { position: relative; }
.slow {
  position: absolute; top: var(--space-20); left: 50%; transform: translateX(-50%);
  display: grid; justify-items: center; gap: var(--space-4);
  width: min(calc(100% - var(--page-gutter) * 2), 420px);
  padding: var(--space-8) var(--space-6);
  border: 1px solid var(--color-line); border-radius: var(--radius-panel); background: var(--color-surface);
  text-align: center;
}
.slow p { margin: 0; color: var(--color-muted); font-size: var(--text-label); line-height: 1.6; word-break: keep-all; }
.message { composes: readingPage from "../../components/ui/ui.module.css"; display: grid; justify-items: start; gap: var(--space-4); }
.message p { margin: 0; }
.srOnly { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (max-width: 760px) { .slow { top: var(--space-12); } }
```

- [ ] **Step 6: 통과를 확인한다** — Run: `npx vitest run src/features/auth src/components/ui && npx eslint src/features/auth src/components && npx tsc --noEmit` Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add web/src/components/ui web/src/features/auth/WaitingScore.tsx web/src/features/auth/WaitingScore.module.css web/src/features/auth/PageGate.tsx web/src/features/auth/PageGate.module.css web/src/features/auth/PageGate.test.tsx
git commit -m "feat: 스켈레톤 조각과 대기 그림, 페이지 문지기 추가

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 레이아웃과 헤더

**Files:**
- Modify: `web/src/app/(member)/layout.tsx`, `web/src/app/(admin)/layout.tsx`
- Modify: `web/src/features/member/MemberNavigation.tsx`, `web/src/features/member/AdminNavigation.tsx`
- Test: `web/src/features/member/MemberNavigation.test.tsx`(새로 만듦), `web/src/features/member/AdminNavigation.test.tsx`

**Interfaces:**
- Consumes: `SessionProvider`, `useSessionState`, `renderWithSession`, `sessionFixture`.

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `web/src/features/member/MemberNavigation.test.tsx`:

```tsx
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemberNavigation } from "./MemberNavigation";
import { SessionProvider } from "../auth/SessionProvider";
import { getSession } from "../auth/session";
import { renderWithSession, sessionFixture } from "../../test/session";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("../auth/session", async (importOriginal) => ({ ...await importOriginal<typeof import("../auth/session")>(), getSession: vi.fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("세션을 기다리는 동안에도 로고와 로그아웃을 보여 줍니다", () => {
  vi.mocked(getSession).mockReturnValue(new Promise(() => undefined));
  render(<SessionProvider><MemberNavigation /></SessionProvider>);
  expect(screen.getByRole("link", { name: "전남대학교 합창단 일정" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "운영진" })).not.toBeInTheDocument();
});

test("운영진에게는 이름과 운영진 메뉴를 보여 줍니다", () => {
  renderWithSession(<MemberNavigation />, sessionFixture({ name: "수석", permissions: ["MANAGE_EVENTS", "VIEW_MINUTES"] }));
  expect(screen.getByText("수석")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "운영진" })).toBeInTheDocument();
});

test("회의록 보기만 있는 단원에게는 운영진 메뉴가 없습니다", () => {
  renderWithSession(<MemberNavigation />, sessionFixture({ name: "단원" }));
  expect(screen.getByText("단원")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "운영진" })).not.toBeInTheDocument();
});
```

`web/src/features/member/AdminNavigation.test.tsx`를 아래로 바꿉니다:

```tsx
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { AdminNavigation } from "./AdminNavigation";
import { renderWithSession, sessionFixture } from "../../test/session";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/events" }));

afterEach(cleanup);

test("수석에게는 공지·행사 관리와 단원 계정만 보입니다", () => {
  renderWithSession(<AdminNavigation />, sessionFixture({ name: "수석",
    permissions: ["MANAGE_EVENTS", "WRITE_MINUTES", "VIEW_MEMBERS", "VIEW_MINUTES"] }));
  expect(screen.getByRole("link", { name: "행사 관리" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "단원 계정" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "가입 승인" })).not.toBeInTheDocument();
});

test("사이트 관리자에게는 모든 메뉴가 보입니다", () => {
  renderWithSession(<AdminNavigation />, sessionFixture({ name: "관리자", admin: true }));
  expect(screen.getByRole("link", { name: "가입 승인" })).toBeInTheDocument();
});
```

- [ ] **Step 2: 실패를 확인한다** — Run: `npx vitest run src/features/member/MemberNavigation.test.tsx src/features/member/AdminNavigation.test.tsx` Expected: FAIL (헤더가 세션 context를 읽지 않음).

- [ ] **Step 3: 헤더를 바꾼다** — `MemberNavigation.tsx`에서 `useEffect`, `useState<MemberSession | null>`, `getSession`, `ApiRequestError` import와 세션 effect 전체를 지우고, 함수 맨 위에 `const { session } = useSessionState();`를 둡니다(`import { useSessionState } from "../auth/SessionProvider";`). 로그아웃 처리(`router.replace("/login")`)와 나머지 JSX는 그대로 둡니다. `AdminNavigation.tsx`도 같은 방식으로 `useEffect`/`useState`/`getSession`을 지우고 `const { session } = useSessionState();`를 씁니다.

- [ ] **Step 4: 레이아웃을 감싼다** — `web/src/app/(member)/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { SessionProvider } from "../../features/auth/SessionProvider";
import { MemberNavigation } from "../../features/member/MemberNavigation";
import styles from "./layout.module.css";

export default function MemberLayout({ children }: { children: ReactNode }) {
  return <SessionProvider>
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#member-content">본문으로 건너뛰기</a>
      <MemberNavigation />
      {children}
    </div>
  </SessionProvider>;
}
```

`web/src/app/(admin)/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { SessionProvider } from "../../features/auth/SessionProvider";
import { AdminNavigation } from "../../features/member/AdminNavigation";
import { MemberNavigation } from "../../features/member/MemberNavigation";
import styles from "./layout.module.css";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <SessionProvider requireStaff>
    <div className={styles.shell}>
      <MemberNavigation />
      <AdminNavigation />
      {children}
    </div>
  </SessionProvider>;
}
```

- [ ] **Step 5: 통과를 확인한다** — Run: `npx vitest run src/features/member && npx eslint src/features/member src/app && npx tsc --noEmit` Expected: 헤더 테스트 PASS. 이 시점에는 아직 페이지들이 자기 `getSession()`을 쓰므로 다른 테스트가 깨지면 안 됩니다. 깨지면 원인을 보고합니다.

- [ ] **Step 6: 커밋**

```bash
git add "web/src/app/(member)/layout.tsx" "web/src/app/(admin)/layout.tsx" web/src/features/member/MemberNavigation.tsx web/src/features/member/AdminNavigation.tsx web/src/features/member/MemberNavigation.test.tsx web/src/features/member/AdminNavigation.test.tsx
git commit -m "feat: 회원·운영진 레이아웃이 세션 provider로 헤더와 본문을 감쌈

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## 페이지 옮기기 절차 (Task 5–8 공통)

각 페이지에 대해 아래를 모두 합니다. 페이지별 값은 각 작업의 표에 있습니다.

1. **라우트 페이지를 감싼다.** `app/.../page.tsx`가 본문을 `<PageGate skeleton={<X스켈레톤 />} permission="...">`로 감쌉니다. 운영진 라우트가 이미 `<main>`으로 감싸고 있으면 `<main>` 안쪽에 둡니다. 클라이언트 라우트(`useParams`를 쓰는 곳)는 주소 검사 결과를 그대로 두고, 정상 주소일 때의 본문만 감쌉니다.
2. **스켈레톤을 만든다.** 기능 폴더에 `X스켈레톤`을 화면 옆 파일(`XxxSkeleton.tsx`)로 만듭니다. 실제 화면과 같은 바깥 틀(같은 CSS module의 `page`/`readingPage` 클래스, 제목 자리, 주요 영역의 배치)을 쓰고, 내용은 `Skeleton`과 `SkeletonRows`로 채웁니다. 배치용 CSS가 더 필요하면 그 기능의 CSS module에 `skeleton…` 클래스로 추가하고 토큰만 씁니다. 스켈레톤은 상태를 알리지 않습니다(`SkeletonRows`에 `label`을 주지 않음). 문지기가 이미 알립니다.
3. **본문에서 세션 받기를 지운다.** `getSession()` 호출, 그 결과로 하던 리다이렉트(`router.replace("/login")`, `"/application-status"`, `"/dashboard"`), 승인 여부 검사, "운영진만…" 같은 권한 거부 분기와 그 상태(`authorized` 등)를 지웁니다. 세션이 필요한 곳은 함수 맨 위의 `const session = useSession();`로 읽습니다(`import { useSession } from "../auth/SessionProvider";`). 화면 안의 세부 권한 분기(`can(session, ...)`로 버튼·영역을 숨기는 것)는 남깁니다. 더 이상 쓰지 않는 `useRouter`, `ApiRequestError` import, effect 의존성의 `router`를 지웁니다. 데이터 effect는 세션을 기다리지 않고 바로 데이터를 받습니다.
4. **불러오는 중 문구를 스켈레톤으로 바꾼다.** 표의 문구 자리를 `<SkeletonRows count={n} label="(기존 문구 그대로)" />` 또는 그 자리 모양에 맞는 스켈레톤으로 바꿉니다. `label`에는 기존 문구를 글자 그대로 넣어 화면 읽기 프로그램과 테스트가 같은 문구를 찾게 합니다.
5. **테스트를 옮긴다.** 그 화면의 테스트에서 `vi.mock("../auth/session", ...)`의 `getSession` 목과, 세션 리다이렉트만을 위한 `next/navigation` 목을 지웁니다. `render(<X />)`를 `renderWithSession(<X />, sessionFixture({...}))`로 바꿉니다(기존 테스트가 쓰던 세션 값을 그대로 옮김: 예 `admin: true`, `memberType: "OB"`). 승인 대기 리다이렉트·권한 거부를 확인하던 테스트는 지웁니다. 그 동작은 provider와 문지기 테스트가 맡습니다. 기존의 나머지 동작 단언은 지우거나 약하게 바꾸지 않습니다.
6. **운영진 라우트는 권한 짝을 고정한다.** 운영진 라우트마다 `app/(admin)/admin/<경로>/page.test.tsx`를 만들어, 그 권한이 없는 세션으로 라우트 페이지를 그리면 `이 기능을 쓸 권한이 없습니다.`가 보이는지 확인합니다. 라우트 페이지가 데이터를 받지 않도록 본문 기능 module을 목으로 잡아도 됩니다(`vi.mock("../../../../features/...", () => ({ X: () => <p>본문</p> }))`). 클라이언트 라우트는 `next/navigation`의 `useParams`를 목으로 잡습니다.
7. **확인한다.** `npx vitest run <바꾼 기능 폴더와 라우트>`, `npx eslint <바꾼 경로>`, `npx tsc --noEmit`. 그리고 `grep -rn "getSession" web/src/features web/src/app` 결과에서 이번 작업의 파일이 사라졌는지 확인합니다.

---

### Task 5: 일정 화면 (대시보드, 행사 상세, 현장 출석)

| 라우트 | 본문 | 권한 | 스켈레톤 | 문구 자리 |
| --- | --- | --- | --- | --- |
| `app/(member)/dashboard/page.tsx` | `EventCalendar` | 없음 | `EventCalendarSkeleton`: 제목 막대, 왼쪽 달력(월 제목+버튼 자리, 요일 줄, 7×5 칸), 오른쪽 열(행 6줄), 아래 공지 행 3줄, 출석 행 3줄. `EventCalendar.module.css`의 `dashboard`/`grid` 배치를 그대로 씁니다 | `EventCalendar.tsx:193`(일정), `:230`(공지), `:238`(출석) |
| `app/(member)/events/[id]/page.tsx` | `EventPage` | 없음 | `EventPageSkeleton`: 뒤로 가기 막대, 제목 막대, `eventPageCard` 틀 안에 제목·시간·본문 3줄·버튼 자리 | `EventPage.tsx:80`(행사). `:77`의 작은 "확인 중"은 그대로 둡니다 |
| `app/(member)/events/[id]/check-in/page.tsx` | `CheckInPanel` | 없음 | `CheckInSkeleton`: 제목 막대, 상태 막대, 입력칸·버튼 블록. 라우트의 기존 `<main>` 틀을 씁니다 | 없음(`CheckInPanel`은 세션을 받지 않음) |

추가 사항:
- `EventCalendar`는 세션의 `memberType`으로 OB 대상 행사를 거릅니다. `useSession()`의 값을 그대로 씁니다. 세션 effect 안에서 하던 행사 로드는 세션 없이 바로 시작합니다. 달을 바꿔도 `/auth/me`를 다시 받지 않는지 테스트로 확인합니다(`getSession`을 목으로 잡지 않으므로, 대신 `getEvents` 호출만 늘어나는지 확인).
- `EventCalendar.test.tsx`의 `getSession: () => getSession()` 우회와 승인 대기 리다이렉트 테스트(`:117` 부근)를 지웁니다.
- `EventPage`의 "운영진 출석 관리" 링크는 `can(session, "MANAGE_EVENTS")`로 계속 가립니다.

커밋 메시지: `refactor: 일정 화면이 세션 provider와 페이지 문지기를 쓰도록 변경`

---

### Task 6: 공지와 내 출석

| 라우트 | 본문 | 권한 | 스켈레톤 | 문구 자리 |
| --- | --- | --- | --- | --- |
| `app/(member)/notices/page.tsx` | `NoticeList` | 없음 | `NoticeListSkeleton`: `NoticeList.module.css`의 `page` 틀, 제목 막대, 행 5줄 | `NoticeList.tsx:83`(공지 상세), `:92`(공지 목록) |
| `app/(member)/attendance/page.tsx` | `MyAttendancePage` | 없음 | `MyAttendanceSkeleton`: `MyAttendancePage.module.css`의 `page` 틀, 제목 막대, 행 4줄 | `MyAttendancePage.tsx:24` |

추가 사항:
- `notices/page.tsx`는 서버 컴포넌트로 `searchParams`를 읽어 `NoticeList`에 넘깁니다. 이 처리는 그대로 두고 `<PageGate>`로 감쌉니다.
- `NoticePoll.tsx:66`의 "투표를 불러오는 중입니다."도 `SkeletonRows count={2} label=...`로 바꿉니다. `NoticePoll`은 세션을 받지 않으므로 다른 변경은 없습니다.
- `NoticeList.test.tsx`, `NoticeListPoll.test.tsx`의 세션 목을 지우고 `renderWithSession`을 씁니다. `NoticeList.test.tsx`가 `./NoticePoll`을 목으로 잡는 것은 그대로 둡니다.
- `MyAttendancePage`는 세션을 받지 않습니다. 라우트 감싸기와 문구 교체만 합니다.

커밋 메시지: `refactor: 공지와 내 출석 화면에 페이지 문지기와 스켈레톤 적용`

---

### Task 7: 단원 계정과 가입 승인

| 라우트 | 본문 | 권한 | 스켈레톤 | 문구 자리 |
| --- | --- | --- | --- | --- |
| `app/(admin)/admin/members/page.tsx` | `MemberAccountManager` | `VIEW_MEMBERS` | `MemberAccountSkeleton`: `AdminPages.module.css`의 `page` 틀, 제목 막대, 두 칸 `grid`에 패널 두 개(입력칸 3개 자리·행 3줄), 아래 행 4줄 | `MemberAccountManager.tsx:102`, `:135` |
| `app/(admin)/admin/applications/page.tsx` | `ApplicationQueue` | `APPROVE_APPLICATIONS` | `ApplicationQueueSkeleton`: `page` 틀, 제목 막대, 안내 한 줄, 행 3줄 | `ApplicationQueue.tsx:71` |

추가 사항:
- `MemberAccountManager`가 세션을 받기 전까지 그리던 대기·오류 화면(`:102` 부근의 조기 반환)은 문지기가 대신하므로 지웁니다. 세션은 `useSession()`으로 읽고 `MemberRegistration`, `MemberRow`, `MemberRoles`에는 지금처럼 prop으로 넘깁니다.
- **자기 직책 변경 뒤 세션 갱신**: 회원 행의 `onChanged`에서, 바뀐 행이 자기 자신(`item.id === session.id`)이면 `useSessionState().refresh()`도 부릅니다. 테스트: 자기 행의 직책을 추가하면 `getSession`이 다시 불리는지(provider를 `initialSession`으로 시작하고 `../auth/session`의 `getSession`만 목으로 잡아 확인), 다른 사람 행이면 불리지 않는지.
- `ApplicationQueue`의 `authorized` 상태와 "운영진만" 분기, 401 처리 테스트(`ApplicationQueue.test.tsx:25`)와 수석 거부 테스트(`:91` 부근)를 지웁니다. 거부는 Step 6의 라우트 테스트로 옮겨 확인합니다.
- `MemberAccountManager.test.tsx`의 "VIEW_MEMBERS만 있는 세션은 접근 해제·단원 추가·파트·기수 저장이 숨겨진다" 테스트는 남기고 `renderWithSession`으로 옮깁니다.

커밋 메시지: `refactor: 단원 계정과 가입 승인 화면에 페이지 문지기 적용, 자기 직책 변경 뒤 세션 갱신`

---

### Task 8: 공지 관리, 행사 관리, 출석 관리

| 라우트 | 본문 | 권한 | 스켈레톤 | 문구 자리 |
| --- | --- | --- | --- | --- |
| `app/(admin)/admin/notices/page.tsx` | `NoticeEditor` | `MANAGE_EVENTS` | `NoticeEditorSkeleton`: `page` 틀, 제목 막대, 두 칸 `grid`에 왼쪽 행 5줄, 오른쪽 패널(입력칸 2개·큰 입력칸 자리) | `NoticeEditor.tsx:166`(투표 정보) |
| `app/(admin)/admin/events/page.tsx` | `EventEditor` | `MANAGE_EVENTS` | `EventEditorSkeleton`: `page` 틀, 제목 막대, 일괄 등록 패널(달력 7×5 칸 자리·입력칸 2개), 아래 행 5줄 | `EventEditor.tsx:130`, `AdminEventRsvps.tsx:26` |
| `app/(admin)/admin/events/[id]/attendance/page.tsx` | `AdminAttendancePanel` | `MANAGE_EVENTS` | `AdminAttendanceSkeleton`: `page` 틀, 뒤로 가기 막대, 제목 막대, 두 칸 `grid`에 패널 두 개(버튼 자리·행 4줄) | 없음 |

추가 사항:
- `NoticeEditor`의 "운영진만…" 분기, `EventEditor`의 `/dashboard`·`/application-status` 리다이렉트, `AdminAttendancePanel`의 "운영진만 출석을 관리할 수 있습니다." 예외와 "로그인이 필요합니다." 처리를 지웁니다.
- `EventEditor`의 세션 effect 안에서 하던 첫 목록 로드와 버전 ref(`listRequestVersion`, `currentMonth`)는 동작을 바꾸지 말고 세션 단계만 걷어냅니다. 달을 바꿀 때 `/auth/me`를 다시 받지 않게 됩니다.
- 각 테스트(`NoticeEditor.test.tsx`, `EventEditor.test.tsx`, `AdminAttendancePanel.test.tsx`)는 `renderWithSession(..., sessionFixture({ admin: true }))`로 옮깁니다. 리다이렉트 단언(`router.replace`)은 지웁니다.

커밋 메시지: `refactor: 공지·행사·출석 관리 화면에 페이지 문지기와 스켈레톤 적용`

---

### Task 9: 마무리와 화면 확인

**Files:**
- Modify: `docs/design-system.md`
- Add to git: `CONTEXT.md`, `docs/adr/0001-transport-owns-session-redirects.md`, 스펙·계획 문서(이미 커밋돼 있으면 생략)

- [ ] **Step 1: 남은 직접 호출을 확인한다** — `grep -rn "getSession" web/src --include=*.tsx --include=*.ts | grep -v test` 결과가 `features/auth/session.ts`(정의), `features/auth/SessionProvider.tsx`, `app/(auth)/application-status/page.tsx`만이어야 합니다. `grep -rn "불러오는 중입니다" web/src --include=*.tsx | grep -v test` 결과는 모두 `label=` 또는 `PageGate`여야 합니다.
- [ ] **Step 2: 전체 검사** — `npx vitest run`, `npx eslint`, `npx tsc --noEmit`, `npx next build`를 모두 통과시킵니다.
- [ ] **Step 3: 디자인 문서** — `docs/design-system.md`의 "공통 컴포넌트" 절에 한 단락을 추가합니다: 회원·운영진 화면은 레이아웃의 세션 provider가 세션을 한 번 받고, 라우트 페이지는 `PageGate`로 본문을 감싸 스켈레톤과 권한을 넘긴다는 것, 네 화면 상태와 문구, 3초 기준, 대기 그림(오선·음표 SVG)과 투명도 펄스, 모션 줄이기 동작. "적용 검증 기록"에 이번 작업의 날짜(2026-10-04)와 검증 결과를 추가합니다.
- [ ] **Step 4: 화면 확인** — 저장소 밖 목업(스크래치 폴더의 `mock.mjs`, 포트 3100, 개발 서버 3000으로 프록시)에 `/auth/me`의 지연(`MOCK_ME_DELAY_MS`), 실패(`MOCK_ME_FAIL=1`이면 502), 권한 목록(`MOCK_ME_PERMS`, 쉼표 구분, `MOCK_ME_ADMIN=1`) 환경 변수를 추가합니다(저장소에 커밋하지 않음). 개발 서버가 3000에서 응답하지 않으면 `web`에서 `npm run dev`를 백그라운드로 띄웁니다. Playwright(`web/node_modules/@playwright/test`의 `chromium`)로 1440×900과 390×844에서 다음을 캡처하고, 캡처 파일을 직접 열어 확인합니다.
  - 대기 직후 스켈레톤: `/dashboard`, `/notices`, `/admin/members`, `/admin/events`(지연 10초, 캡처는 1초 시점)
  - 3초 경과 대기 그림과 문구: `/dashboard`(지연 10초, 캡처는 4초 시점)
  - 실패와 다시 시도: `/notices`(`MOCK_ME_FAIL=1`)
  - 권한 없음: `/admin/applications`(권한 `MANAGE_EVENTS,VIEW_MINUTES`)
  - 준비된 화면: `/dashboard`, `/admin/members`(지연 없음)

  각 캡처에서 가로 넘침이 없는지, 스켈레톤의 바깥 틀이 실제 화면과 같은 위치에 있는지, 헤더가 대기 중에도 보이는지 확인합니다. 캡처 파일은 스크래치패드에 남기고 저장소에 넣지 않습니다.
- [ ] **Step 5: 커밋**

```bash
git add CONTEXT.md docs/adr docs/design-system.md
git commit -m "docs: 세션 module 용어·결정 기록과 디자인 시스템 갱신

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
