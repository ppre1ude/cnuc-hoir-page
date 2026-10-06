"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiRequestError, onPermissionDenied, redirectTo } from "../../lib/api";
import { getSession, isStaff, type MemberSession } from "./session";

export type SessionStatus = "loading" | "ready" | "failed";
type SessionState = { status: SessionStatus; session: MemberSession | null; refresh: () => void };

const SessionContext = createContext<SessionState | null>(null);

// 회원·운영진 레이아웃이 감쌉니다. /auth/me를 마운트 때 한 번 받고, 다시 시도·권한 부족 알림·자기 직책 변경 때만 다시 받습니다.
// 마운트 때 요청만 실패하면 곧바로 한 번 더 받습니다. 잠든 서버가 깨어나는 사이 첫 요청이 중계에서 끊기는 경우가 있기 때문입니다.
export function SessionProvider({ children, requireStaff = false, initialSession }: {
  children: ReactNode;
  requireStaff?: boolean;
  initialSession?: MemberSession;
}) {
  const [session, setSession] = useState<MemberSession | null>(initialSession ?? null);
  const [status, setStatus] = useState<SessionStatus>(initialSession ? "ready" : "loading");
  const latest = useRef(0);
  const hasSession = useRef(Boolean(initialSession));

  const load = useCallback((retries = 0) => {
    const attempt = (left: number) => {
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
        if (hasSession.current) return;
        if (left > 0) { attempt(left - 1); return; }
        setStatus("failed");
      });
    };
    attempt(retries);
  }, [requireStaff]);

  const refresh = useCallback(() => {
    if (!hasSession.current) setStatus("loading");
    load();
  }, [load]);

  useEffect(() => {
    // 처음 값이 있으면 받지 않습니다. StrictMode가 effect를 다시 실행해도 같습니다.
    if (!hasSession.current) load(1);
    const unsubscribe = onPermissionDenied(load);
    // 레이아웃이 바뀌어 사라진 provider의 늦은 응답이 사용자가 고른 페이지를 덮지 않게 합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- DOM ref가 아니라 요청 번호이고, 정리 시점의 최신 값을 무효로 만드는 것이 목적이다.
    return () => { unsubscribe(); latest.current++; };
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
