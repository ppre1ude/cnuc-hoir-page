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
