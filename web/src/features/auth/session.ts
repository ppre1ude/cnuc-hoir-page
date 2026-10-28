import { apiRequest } from "../../lib/api";
import type { ScheduleKind } from "../event/events";

export type Part = "SOPRANO" | "ALTO" | "TENOR" | "BASS" | "PIANO";
export type Role = "PRESIDENT" | "VICE_PRESIDENT" | "TREASURER" | "DEPARTMENT_HEAD" | "DEPARTMENT_MEMBER" | "SECTION_LEAD";
export type Department = "PLANNING_PR" | "MANAGEMENT";
export type Unit = "PLANNING" | "PR" | "SCORES" | "SUPPLIES";
export type Permission = "MANAGE_SITE_ADMINS" | "MANAGE_ROLES" | "REVOKE_ACCESS" | "MANAGE_ALLOWLIST"
  | "APPROVE_APPLICATIONS" | "MANAGE_FULL_REHEARSALS" | "MANAGE_PART_REHEARSALS" | "MANAGE_PART_ATTENDANCE" | "MANAGE_EVENTS"
  | "WRITE_MINUTES" | "DELETE_MINUTES" | "VIEW_MEMBERS" | "VIEW_MINUTES";
export type MemberRoleItem = { id: number; role: Role; department: Department | null; unit: Unit | null; part: Part | null };

export type MemberSession = {
  id: number;
  name: string;
  email?: string;
  status: "INVITED" | "EMAIL_PENDING" | "APPROVAL_PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
  memberType: "ACTIVE" | "OB" | null;
  admin: boolean;
  part?: Part | null;
  cohort?: number | null;
  roles?: MemberRoleItem[];
  permissions?: Permission[];
};

// 사이트 관리자는 모든 권한을 가집니다. 서버가 권한 목록을 함께 주지만 화면은 이 함수로만 판단합니다.
export function can(session: MemberSession | null | undefined, permission: Permission): boolean {
  return Boolean(session && session.status === "APPROVED" && (session.admin || session.permissions?.includes(permission)));
}

// 수석 직책에 붙은 파트입니다. 수석은 이 파트의 파트연습만 다룹니다.
export function leadParts(session: MemberSession | null | undefined): Part[] {
  if (!session || session.status !== "APPROVED" || session.memberType !== "ACTIVE") return [];
  return (session.roles ?? []).flatMap((role) => role.role === "SECTION_LEAD" && role.part ? [role.part] : []);
}

// 일정 등록·수정 권한입니다. 서버의 EventAccess.canManage와 같습니다.
// 정기연습과 비정기연습은 단장·부단장, 파트연습은 단장·부단장과 그 파트 수석, 행사는 운영진 전원입니다.
export function canManageEvent(session: MemberSession | null | undefined, kind: ScheduleKind,
  part: Part | null): boolean {
  if (kind === "REGULAR_REHEARSAL" || kind === "EXTRA_REHEARSAL") return can(session, "MANAGE_FULL_REHEARSALS");
  if (kind === "PART_REHEARSAL") return can(session, "MANAGE_PART_REHEARSALS") || (part != null && leadParts(session).includes(part));
  return can(session, "MANAGE_EVENTS");
}

// 응답 집계와 출석 관리 권한입니다. 파트연습은 단장단(총무 포함)과 그 파트 수석, 그 밖은 운영진 전원입니다.
export function canManageRoster(session: MemberSession | null | undefined,
  event: { kind: ScheduleKind; part: Part | null }): boolean {
  if (event.kind === "PART_REHEARSAL") {
    return can(session, "MANAGE_PART_ATTENDANCE") || (event.part != null && leadParts(session).includes(event.part));
  }
  return can(session, "MANAGE_EVENTS");
}

// 회원 메뉴에 "운영진"을 보여 줄지 정합니다. 회의록 보기는 모든 활동 단원의 권한이라 제외합니다.
export function isStaff(session: MemberSession | null | undefined): boolean {
  return Boolean(session && session.status === "APPROVED" && (session.admin || session.permissions?.some((permission) => permission !== "VIEW_MINUTES")));
}

export function getGoogleNonce(): Promise<{ nonce: string }> {
  return apiRequest<{ nonce: string }>("/auth/google/nonce");
}

// 일정과 운영진 화면은 레이아웃마다 SessionProvider가 새로 생깁니다. 오갈 때 스켈레톤이 깜빡이지 않게
// 마지막으로 받은 승인 세션을 먼저 그립니다. 다른 사람의 세션이 보이지 않게 로그인·로그아웃 때 비웁니다.
// 로그인·로그아웃이 시작되면 번호가 바뀝니다. 그 전에 보낸 /auth/me 응답이 늦게 와도 옛 세션을 다시 기억하지 않게 합니다.
let lastSession: MemberSession | null = null;
let generation = 0;
export function rememberedSession(): MemberSession | null { return lastSession; }
export function sessionGeneration(): number { return generation; }
export function rememberSession(session: MemberSession | null, since = generation) {
  if (since === generation) lastSession = session;
}
function forgetSession() { lastSession = null; generation++; }

export function loginWithGoogle(credential: string): Promise<MemberSession> {
  forgetSession();
  return apiRequest<MemberSession>("/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
}

export function logout(): Promise<void> {
  forgetSession();
  return apiRequest<void>("/auth/logout", { method: "POST" });
}

export function getSession(): Promise<MemberSession> {
  return apiRequest<MemberSession>("/auth/me");
}

export type Application = { name: string; cohort: number; part: Part };

export function saveApplication(application: Application): Promise<MemberSession> {
  return apiRequest<MemberSession>("/auth/application", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(application),
  });
}

export function completeAccountSetup(token: string, credential: string): Promise<MemberSession> {
  forgetSession();
  return apiRequest<MemberSession>("/auth/account-setup/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, credential }),
  });
}
