"use client";

import { useState, type FormEvent } from "react";
import { Button, Input, Select, Feedback, StatusBadge } from "../../components/ui";
import { ApiRequestError } from "../../lib/api";
import { can, type Department, type MemberSession, type Part, type Role, type Unit } from "../auth/session";
import { assignMemberRole, removeMemberRole, setSiteAdmin, updateMemberProfile, type MemberItem } from "./adminMembers";
import { departmentLabel, departments, describeRole, partLabel, parts, roleLabel, roles, unitLabel, unitsOf } from "./roles";
import styles from "./AdminPages.module.css";

export function MemberRoles({ item, session, onChanged }: { item: MemberItem; session: MemberSession; onChanged: () => void }) {
  const [role, setRole] = useState<Role>("TREASURER");
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
  const eligible = approved && item.memberType === "ACTIVE";
  // 단장·부단장은 사이트 관리자만 지정합니다.
  const choices = roles.filter((value) => leadership || (value !== "PRESIDENT" && value !== "VICE_PRESIDENT"));

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
    const input = role === "SECTION_LEAD" ? { role, part }
      : role === "DEPARTMENT_HEAD" ? { role, department }
      : role === "DEPARTMENT_MEMBER" ? { role, department, unit } : { role };
    void run(() => assignMemberRole(item.id, input), "직책을 추가하지 못했습니다.");
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (memberType === "OB" && item.memberType !== "OB" && item.roles.length > 0
      && !window.confirm(`OB로 바꾸면 ${item.name}의 직책(${item.roles.map(describeRole).join(", ")})이 모두 해제됩니다. 계속할까요?`)) return;
    // 운영진이 구분을 바꿨을 때만 보냅니다. 파트만 저장해도 비어 있던 구분이 활동 단원으로 바뀌면 안 됩니다.
    void run(() => updateMemberProfile(item.id, { part: profilePart || null, cohort: cohort.trim() ? Number(cohort) : null,
      ...(approved && memberType && memberType !== item.memberType ? { memberType } : {}) }), "단원 정보를 저장하지 못했습니다.");
  }

  if (!can(session, "MANAGE_ROLES")) {
    return <p className={styles.roleList}>
      {item.part && <span>{partLabel[item.part]}</span>}{item.cohort !== null && <span>{item.cohort}기</span>}
      {item.roles.map((assigned) => <StatusBadge key={assigned.id} tone="positive">{describeRole(assigned)}</StatusBadge>)}
      {item.admin && <StatusBadge tone="neutral">사이트 관리자</StatusBadge>}
    </p>;
  }

  // 한 화면에 단원마다 같은 입력과 버튼이 반복되므로, 화면 읽기 프로그램에는 이름을 붙여 구분합니다.
  return <div className={styles.roles}>
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
    <p className={styles.roleList}>
      {item.roles.length === 0 && <span>직책 없음</span>}
      {item.roles.map((assigned) => <span key={assigned.id} className={styles.roleChip}>{describeRole(assigned)}
        {(leadership || (assigned.role !== "PRESIDENT" && assigned.role !== "VICE_PRESIDENT")) && <Button variant="unstyled" type="button" disabled={busy}
          aria-label={`${item.name} ${describeRole(assigned)} 해제`} onClick={() => void run(() => removeMemberRole(item.id, assigned.id), "직책을 해제하지 못했습니다.")}>×</Button>}
      </span>)}
      {item.admin && <StatusBadge tone="neutral">사이트 관리자</StatusBadge>}
    </p>
    {eligible && <form className={styles.inlineForm} onSubmit={add}>
      <label htmlFor={`role-${item.id}`}>추가할 직책</label>
      <Select id={`role-${item.id}`} aria-label={`${item.name} 추가할 직책`} value={role} onChange={(event) => setRole(event.target.value as Role)}>
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
      <Button variant="secondary" type="submit" disabled={busy} aria-label={`${item.name} 직책 추가`}>직책 추가</Button>
    </form>}
    {leadership && eligible && item.id !== session.id && <Button variant={item.admin ? "danger" : "secondary"} type="button" disabled={busy}
      aria-label={`${item.name} ${item.admin ? "사이트 관리자 해제" : "사이트 관리자 지정"}`}
      onClick={() => void run(() => setSiteAdmin(item.id, !item.admin), "사이트 관리자 권한을 바꾸지 못했습니다.")}>
      {item.admin ? "사이트 관리자 해제" : "사이트 관리자 지정"}</Button>}
    {error && <Feedback tone="error">{error}</Feedback>}
  </div>;
}
