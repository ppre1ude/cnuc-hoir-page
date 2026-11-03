"use client";

import { useState, type FormEvent } from "react";
import { Button, Input, Select, Feedback, StatusBadge } from "../../components/ui";
import { ApiRequestError } from "../../lib/api";
import { can, type Department, type MemberSession, type Part, type Role, type Unit } from "../auth/session";
import { assignMemberRole, removeMemberRole, setSiteAdmin, updateMemberProfile, type MemberItem } from "./adminMembers";
import { departmentLabel, departments, describeRole, partLabel, parts, roleLabel, roles, unitLabel, unitsOf } from "./roles";
import styles from "./AdminPages.module.css";

export const memberTypeLabel = { ACTIVE: "활동 단원", OB: "OB" } as const;

// 구분·파트·기수·직책을 항목 이름 칸과 값 칸으로 나눈 표로 보여, 어느 값이 무엇인지 헷갈리지 않게 합니다.
export function MemberFacts({ item }: { item: MemberItem }) {
  return <dl className={styles.facts}>
    <div><dt>단원 구분</dt><dd>{item.memberType ? memberTypeLabel[item.memberType] : "미지정"}</dd></div>
    <div><dt>파트</dt><dd>{item.part ? partLabel[item.part] : "미지정"}</dd></div>
    <div><dt>기수</dt><dd>{item.cohort === null ? "미지정" : `${item.cohort}기`}</dd></div>
    <div><dt>직책</dt><dd>{item.roles.length === 0 ? "없음"
      : item.roles.map((assigned) => <StatusBadge key={assigned.id} tone="positive">{describeRole(assigned)}</StatusBadge>)}</dd></div>
  </dl>;
}

// 직책 폼이 안 보이는 이유를 그 자리에서 알립니다. 승인과 단원 구분이 먼저라는 걸 화면이 말해 줘야 합니다.
function roleBlocker(item: MemberItem): string {
  if (item.status === "APPROVAL_PENDING") return "가입을 승인하면 직책을 줄 수 있습니다.";
  if (item.status !== "APPROVED") return "승인된 활동 단원에게만 직책을 줄 수 있습니다.";
  if (item.memberType === "OB") return "OB는 직책을 가질 수 없습니다. 활동 단원으로 바꾸면 직책을 줄 수 있습니다.";
  if (item.memberType === null) return "단원 구분을 활동 단원으로 저장하면 직책을 줄 수 있습니다.";
  return "";
}

export function MemberRoles({ item, session, open, onChanged }:
  { item: MemberItem; session: MemberSession; open?: boolean; onChanged: () => void }) {
  // 기본값이 실제 직책이면 손이 미끄러져 눌러도 직책이 붙으므로 빈 선택으로 시작합니다.
  const [role, setRole] = useState<Role | "">("");
  const [department, setDepartment] = useState<Department>("PLANNING_PR");
  const [unit, setUnit] = useState<Unit>("PLANNING");
  const [part, setPart] = useState<Part>("SOPRANO");
  const [profilePart, setProfilePart] = useState<Part | "">(item.part ?? "");
  const [cohort, setCohort] = useState(item.cohort === null ? "" : String(item.cohort));
  const [memberType, setMemberType] = useState<"ACTIVE" | "OB" | "">(item.memberType ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const leadership = can(session, "MANAGE_SITE_ADMINS");
  const approved = item.status === "APPROVED";
  const blocker = roleBlocker(item);
  const eligible = blocker === "";
  // 단장·부단장은 사이트 관리자만 지정합니다.
  const choices = roles.filter((value) => leadership || (value !== "PRESIDENT" && value !== "VICE_PRESIDENT"));
  if (!can(session, "MANAGE_ROLES")) return null;

  async function run(action: () => Promise<unknown>, failure: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await action(); onChanged(); }
    catch (caught) { setError(caught instanceof ApiRequestError ? caught.message : failure); }
    finally { setBusy(false); }
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role) return;
    const input = role === "SECTION_LEAD" ? { role, part }
      : role === "DEPARTMENT_HEAD" ? { role, department }
      : role === "DEPARTMENT_MEMBER" ? { role, department, unit } : { role };
    void run(async () => { await assignMemberRole(item.id, input); setRole(""); }, "직책을 추가하지 못했습니다.");
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (memberType === "OB" && item.memberType !== "OB" && item.roles.length > 0
      && !window.confirm(`OB로 바꾸면 ${item.name}의 직책(${item.roles.map(describeRole).join(", ")})이 모두 해제됩니다. 계속할까요?`)) return;
    // 운영진이 구분을 바꿨을 때만 보냅니다. 파트만 저장해도 비어 있던 구분이 활동 단원으로 바뀌면 안 됩니다.
    void run(() => updateMemberProfile(item.id, { part: profilePart || null, cohort: cohort.trim() ? Number(cohort) : null,
      ...(approved && memberType && memberType !== item.memberType ? { memberType } : {}) }), "단원 정보를 저장하지 못했습니다.");
  }

  // 한 화면에 단원마다 같은 입력과 버튼이 반복되므로, 화면 읽기 프로그램에는 이름을 붙여 구분합니다.
  return <details className={styles.more} open={open}>
    <summary aria-label={`${item.name} 단원 정보 수정`}>단원 정보 수정</summary>
    <div className={styles.roles}>
      <form className={styles.inlineForm} onSubmit={saveProfile}>
        {approved && <>
          <label htmlFor={`member-type-${item.id}`}>단원 구분</label>
          <Select id={`member-type-${item.id}`} aria-label={`${item.name} 단원 구분`} value={memberType} onChange={(event) => setMemberType(event.target.value as "ACTIVE" | "OB" | "")}>
            {item.memberType === null && <option value="">미지정</option>}
            <option value="ACTIVE">활동 단원</option><option value="OB">OB</option>
          </Select>
        </>}
        <label htmlFor={`part-${item.id}`}>파트</label>
        <Select id={`part-${item.id}`} aria-label={`${item.name} 파트`} value={profilePart} onChange={(event) => setProfilePart(event.target.value as Part | "")}>
          <option value="">미지정</option>{parts.map((value) => <option key={value} value={value}>{partLabel[value]}</option>)}
        </Select>
        <label htmlFor={`cohort-${item.id}`}>기수</label>
        <Input id={`cohort-${item.id}`} aria-label={`${item.name} 기수`} type="number" min={1} value={cohort} onChange={(event) => setCohort(event.target.value)} />
        <Button variant="secondary" type="submit" disabled={busy} aria-label={`${item.name} 정보 저장`}>저장</Button>
      </form>
      {item.roles.length > 0 && <div className={styles.roleList}>
        {item.roles.map((assigned) => (leadership || (assigned.role !== "PRESIDENT" && assigned.role !== "VICE_PRESIDENT")) && <Button key={assigned.id} variant="secondary" type="button" disabled={busy}
          aria-label={`${item.name} ${describeRole(assigned)} 해제`} onClick={() => void run(() => removeMemberRole(item.id, assigned.id), "직책을 해제하지 못했습니다.")}>{describeRole(assigned)} 해제</Button>)}
      </div>}
      {eligible ? <form className={styles.inlineForm} onSubmit={add}>
        <label htmlFor={`role-${item.id}`}>추가할 직책</label>
        <Select id={`role-${item.id}`} aria-label={`${item.name} 추가할 직책`} value={role} onChange={(event) => setRole(event.target.value as Role | "")}>
          <option value="">선택</option>
          {choices.map((value) => <option key={value} value={value}>{roleLabel[value]}</option>)}
        </Select>
        {(role === "DEPARTMENT_HEAD" || role === "DEPARTMENT_MEMBER") && <>
          <label htmlFor={`department-${item.id}`}>부서</label>
          <Select id={`department-${item.id}`} aria-label={`${item.name} 부서`} value={department} onChange={(event) => { const next = event.target.value as Department; setDepartment(next); setUnit(unitsOf[next][0]); }}>
            {departments.map((value) => <option key={value} value={value}>{departmentLabel[value]}</option>)}
          </Select>
        </>}
        {role === "DEPARTMENT_MEMBER" && <>
          <label htmlFor={`unit-${item.id}`}>계</label>
          <Select id={`unit-${item.id}`} aria-label={`${item.name} 계`} value={unit} onChange={(event) => setUnit(event.target.value as Unit)}>
            {unitsOf[department].map((value) => <option key={value} value={value}>{unitLabel[value]}</option>)}
          </Select>
        </>}
        {role === "SECTION_LEAD" && <>
          <label htmlFor={`lead-part-${item.id}`}>파트</label>
          <Select id={`lead-part-${item.id}`} aria-label={`${item.name} 수석 파트`} value={part} onChange={(event) => setPart(event.target.value as Part)}>
            {parts.map((value) => <option key={value} value={value}>{partLabel[value]}</option>)}
          </Select>
        </>}
        <Button variant="secondary" type="submit" disabled={busy || !role} aria-label={`${item.name} 직책 추가`}>직책 추가</Button>
      </form> : <p className={styles.hint}>{blocker}</p>}
      {leadership && eligible && item.id !== session.id && <Button variant={item.admin ? "danger" : "secondary"} type="button" disabled={busy}
        aria-label={`${item.name} ${item.admin ? "사이트 관리자 해제" : "사이트 관리자 지정"}`}
        onClick={() => void run(() => setSiteAdmin(item.id, !item.admin), "사이트 관리자 권한을 바꾸지 못했습니다.")}>
        {item.admin ? "사이트 관리자 해제" : "사이트 관리자 지정"}</Button>}
      {error && <Feedback tone="error">{error}</Feedback>}
    </div>
  </details>;
}
