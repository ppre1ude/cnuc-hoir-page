import { apiRequest } from "../../lib/api";

export type Part = "SOPRANO" | "ALTO" | "TENOR" | "BASS" | "PIANO";
export type Role = "PRESIDENT" | "VICE_PRESIDENT" | "TREASURER" | "DEPARTMENT_HEAD" | "DEPARTMENT_MEMBER" | "SECTION_LEAD";
export type Department = "PLANNING_PR" | "MANAGEMENT";
export type Unit = "PLANNING" | "PR" | "SCORES" | "SUPPLIES";
export type Permission = "MANAGE_SITE_ADMINS" | "MANAGE_ROLES" | "REVOKE_ACCESS" | "MANAGE_ALLOWLIST"
  | "APPROVE_APPLICATIONS" | "MANAGE_FULL_REHEARSALS" | "MANAGE_PART_REHEARSALS" | "MANAGE_EVENTS"
  | "WRITE_MINUTES" | "DELETE_MINUTES" | "VIEW_MEMBERS" | "VIEW_MINUTES";
export type MemberRoleItem = { id: number; role: Role; department: Department | null; unit: Unit | null; part: Part | null };

export type MemberSession = {
  id: number;
  name: string;
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
  return Boolean(session && (session.admin || session.permissions?.includes(permission)));
}

// 회원 메뉴에 "운영진"을 보여 줄지 정합니다. 회의록 보기는 모든 활동 단원의 권한이라 제외합니다.
export function isStaff(session: MemberSession | null | undefined): boolean {
  return Boolean(session && (session.admin || session.permissions?.some((permission) => permission !== "VIEW_MINUTES")));
}

export function getGoogleNonce(): Promise<{ nonce: string }> {
  return apiRequest<{ nonce: string }>("/auth/google/nonce");
}

export function loginWithGoogle(credential: string): Promise<MemberSession> {
  return apiRequest<MemberSession>("/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
}

export function logout(): Promise<void> {
  return apiRequest<void>("/auth/logout", { method: "POST" });
}

export function getSession(): Promise<MemberSession> {
  return apiRequest<MemberSession>("/auth/me");
}

export function completeAccountSetup(token: string, credential: string): Promise<MemberSession> {
  return apiRequest<MemberSession>("/auth/account-setup/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, credential }),
  });
}
