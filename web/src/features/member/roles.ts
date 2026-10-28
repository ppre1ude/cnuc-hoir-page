import type { Department, MemberRoleItem, Part, Role, Unit } from "../auth/session";

export const partLabel: Record<Part, string> = { SOPRANO: "소프라노", ALTO: "알토", TENOR: "테너", BASS: "베이스", PIANO: "피아노" };
export const roleLabel: Record<Role, string> = {
  PRESIDENT: "단장", VICE_PRESIDENT: "부단장", TREASURER: "총무", DEPARTMENT_HEAD: "부장", DEPARTMENT_MEMBER: "부원", SECTION_LEAD: "수석",
};
export const departmentLabel: Record<Department, string> = { PLANNING_PR: "기획·홍보부", MANAGEMENT: "관리부" };
export const unitLabel: Record<Unit, string> = { PLANNING: "기획계", PR: "홍보계", SCORES: "악보계", SUPPLIES: "비품계" };
export const unitsOf: Record<Department, Unit[]> = { PLANNING_PR: ["PLANNING", "PR"], MANAGEMENT: ["SCORES", "SUPPLIES"] };
export const parts = Object.keys(partLabel) as Part[];
export const roles = Object.keys(roleLabel) as Role[];
export const departments = Object.keys(departmentLabel) as Department[];

// "소프라노 5기"처럼 파트와 기수만 적습니다. 둘 다 없으면 빈 문자열입니다.
export function rosterDetail({ part, cohort }: { part: Part | null; cohort: number | null }): string {
  return [part && partLabel[part], cohort != null && `${cohort}기`].filter(Boolean).join(" ");
}

// 운영진 명단은 이메일을 보이지 않으므로 "김민지 · 소프라노 5기"처럼 파트와 기수로 동명이인을 가립니다.
export function rosterName({ name, part, cohort }: { name: string; part: Part | null; cohort: number | null }): string {
  const detail = rosterDetail({ part, cohort });
  return detail ? `${name} · ${detail}` : name;
}

// "소프라노수석", "기획·홍보부 부장", "관리부 악보계 부원"처럼 안내문과 같은 표기를 만듭니다.
export function describeRole(item: Pick<MemberRoleItem, "role" | "department" | "unit" | "part">): string {
  if (item.role === "SECTION_LEAD" && item.part) return `${partLabel[item.part]}수석`;
  if (item.role === "DEPARTMENT_HEAD" && item.department) return `${departmentLabel[item.department]} 부장`;
  if (item.role === "DEPARTMENT_MEMBER" && item.department && item.unit) return `${departmentLabel[item.department]} ${unitLabel[item.unit]} 부원`;
  return roleLabel[item.role];
}
