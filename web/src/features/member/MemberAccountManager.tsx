"use client";

import { Button, Input, Select, Feedback, PageHeader, SkeletonRows, StatusBadge } from "../../components/ui";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiRequestError } from "../../lib/api";
import { can, type MemberSession, type Part } from "../auth/session";
import { useSession, useSessionState } from "../auth/SessionProvider";
import { approveApplication, cancelRejection, getMembers, inviteMember, reissueAccountSetup, rejectApplication, revokeMember,
  type IssuedInvitation, type MemberItem, type MemberPage } from "./adminMembers";
import styles from "./AdminPages.module.css";
import { MemberRegistration } from "./MemberRegistration";
import { MemberFacts, MemberRoles } from "./MemberRoles";
import { partLabel, parts } from "./roles";

// 상태는 이름 옆 배지로 보입니다. 누군가를 기다리는 계정은 노랑, 막힌 계정은 빨강, 쓰고 있는 계정은 조용한 회색입니다.
const statusLabel: Record<MemberItem["status"], string> = { INVITED: "초대 대기", EMAIL_PENDING: "이메일 확인 대기",
  APPROVAL_PENDING: "승인 대기", APPROVED: "사용 중", REJECTED: "가입 반려", REVOKED: "접근 해제" };
const statusTone = (status: MemberItem["status"]) =>
  status === "APPROVED" ? "neutral" : status === "REJECTED" || status === "REVOKED" ? "negative" : "attention";

export function MemberAccountManager() {
  const session = useSession();
  const { refresh: refreshSession } = useSessionState();
  const [data, setData] = useState<MemberPage | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<IssuedInvitation | null>(null);
  const [opened, setOpened] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [part, setPart] = useState<Part | "">("");
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    getMembers().then((result) => { if (alive) setData(result); })
      .catch(() => { if (alive) setError("단원 계정을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [refresh]);

  // 검색과 파트 필터는 받아 둔 전체 목록을 브라우저에서 거릅니다. 고른 사람은 걸러져도 상세에 남아 있습니다.
  const needle = query.trim().toLowerCase();
  const shown = (data?.items ?? []).filter((item) =>
    (!needle || item.name.toLowerCase().includes(needle)) && (!part || item.part === part));
  const current = data?.items.find((item) => item.id === selected) ?? null;

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    setIssued(null);
    try {
      const result = await inviteMember({
        name: String(values.get("name") ?? "").trim(),
        email: String(values.get("email") ?? "").trim(),
        memberType: String(values.get("memberType")) as "ACTIVE" | "OB",
      });
      setIssued(result);
      form.reset();
      setRefresh((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof ApiRequestError && caught.code === "EMAIL_ALREADY_USED"
        ? "이미 등록된 이메일입니다." : "계정을 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  // 행 단위 작업은 모두 같은 틀입니다. 끝나면 목록을 다시 받고, 실패하면 결과 자리에 이유를 적습니다.
  async function act(work: () => Promise<unknown>, failure: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setIssued(null);
    setOpened(null);
    try {
      await work();
      setRefresh((value) => value + 1);
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  const renew = (id: number) => act(async () => setIssued(await reissueAccountSetup(id)),
    "계정 설정 링크를 발급하지 못했습니다. 계정 상태를 확인해 주세요.");
  const revoke = (id: number, reason: string) => act(() => revokeMember(id, reason), "접근을 해제하지 못했습니다. 계정 상태를 확인해 주세요.");
  const reopen = (id: number) => act(() => cancelRejection(id), "반려를 취소하지 못했습니다. 계정 상태를 확인해 주세요.");
  // 승인한 행의 정보 수정을 바로 펼쳐, 목록에서 다시 찾지 않고 그 자리에서 직책까지 이어서 줍니다.
  const approve = (id: number, type: "ACTIVE" | "OB") => act(async () => { await approveApplication(id, type); setOpened(id); },
    "승인하지 못했습니다. 이미 처리된 신청일 수 있으니 목록을 새로 확인해 주세요.");
  const reject = (id: number, reason: string) => act(() => rejectApplication(id, reason), "반려하지 못했습니다. 계정 상태를 확인해 주세요.");

  const link = issued && typeof window !== "undefined"
    ? `${window.location.origin}/activate#token=${issued.token}` : "";
  // 결과는 목록 위에 그려져, 아래쪽 행에서 발급하거나 실패하면 휴대폰에서는 화면 밖에 뜹니다. 그래서 결과로 화면을 옮깁니다.
  const result = useRef<HTMLDivElement>(null);
  useEffect(() => { if (link || error) result.current?.scrollIntoView({ block: "center" }); }, [link, error]);
  // 초점이 발급 버튼에 남으면 Tab으로 위쪽 링크에 닿지 못하고 화면 읽기 사용자는 결과를 모릅니다.
  const linkTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (link) linkTitle.current?.focus({ preventScroll: true }); }, [link]);

  return <section className={styles.page}>
    <PageHeader title="단원 계정" />
    {(can(session, "MANAGE_ALLOWLIST") || can(session, "APPROVE_APPLICATIONS")) && <MemberRegistration session={session}>
      <details className={styles.more}>
        <summary>Gmail이 아닌 경우: 1회용 링크로 초대</summary>
        <p className={styles.hint}>Gmail이 아니라서 로그인해도 자동 승인되지 않는 주소에 씁니다. 계정을 먼저 만들고 1회용 링크를 발급하니, 24시간 안에 본인에게 직접 전달해 주세요.</p>
        <form className={styles.form} aria-label="1회용 링크로 초대" onSubmit={create}>
          <label htmlFor="invite-name">이름</label>
          <Input id="invite-name" name="name" maxLength={100} required />
          <label htmlFor="invite-email">구글 계정 이메일</label>
          <Input id="invite-email" name="email" type="email" maxLength={254} required />
          <label htmlFor="invite-type">단원 구분</label>
          <Select id="invite-type" name="memberType" defaultValue="ACTIVE">
            <option value="ACTIVE">활동 단원</option><option value="OB">OB</option>
          </Select>
          <Button variant="primary" type="submit" disabled={busy}>1회용 링크 발급</Button>
        </form>
      </details>
    </MemberRegistration>}
    <div ref={result}>{error && <Feedback tone="error">{error}</Feedback>}
    {link && <section className={`${styles.panel} ${styles.issued}`} aria-labelledby="link-title">
      <div className={styles.panelHeader}><h2 id="link-title" ref={linkTitle} tabIndex={-1}>발급된 링크</h2></div>
      <p className={styles.hint}>이 링크는 한 번만 표시됩니다. 24시간 안에 해당 단원에게 비공개로 전달해 주세요.</p>
      <label className={styles.fieldLabel} htmlFor="issued-link">구글 계정 연결 링크</label>
      <Input id="issued-link" className={styles.linkInput} value={link} readOnly onFocus={(event) => event.currentTarget.select()} />
      <div className={styles.actions}><Button variant="secondary" type="button"
        onClick={() => navigator.clipboard.writeText(link).catch(() => setError("복사하지 못했습니다. 링크를 직접 선택해 주세요."))}>링크 복사</Button></div>
    </section>}</div>
    <section aria-labelledby="members-title" className={styles.memberSection}>
      <h2 id="members-title">계정 목록</h2>
      {!data && error && <Button variant="secondary" type="button" onClick={() => { setError(""); setRefresh((value) => value + 1); }}>다시 시도</Button>}
      <div className={styles.workspace} data-view={current ? "detail" : "list"}>
        <div className={styles.roster}>
          <div className={styles.filters}>
            <Input type="search" aria-label="이름 검색" placeholder="이름 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
            <Select aria-label="파트로 거르기" value={part} onChange={(event) => setPart(event.target.value as Part | "")}>
              <option value="">모든 파트</option>
              {parts.map((value) => <option key={value} value={value}>{partLabel[value]}</option>)}
            </Select>
          </div>
          {!data && !error && <SkeletonRows count={6} label="계정 목록을 불러오는 중입니다." />}
          <ul className={styles.rosterList} aria-label="단원 목록">
            {shown.map((item) => <li key={item.id}>
              <button type="button" className={styles.rosterRow} aria-current={selected === item.id ? "true" : undefined} onClick={() => setSelected(item.id)}>
                <strong>{item.name}</strong>
                <span>{item.part ? partLabel[item.part] : "파트 미지정"}</span>
                {item.status !== "APPROVED" && <small data-tone={statusTone(item.status)}>{statusLabel[item.status]}</small>}
              </button>
            </li>)}
          </ul>
          {data?.items.length === 0 && <p>등록된 계정이 없습니다.</p>}
          {data && data.items.length > 0 && shown.length === 0 && <p>조건에 맞는 단원이 없습니다.</p>}
        </div>
        <div className={styles.detail}>
          <Button variant="secondary" size="small" type="button" className={styles.toList} onClick={() => setSelected(null)}>목록으로</Button>
          {current ? <MemberDetail key={current.id} item={current} busy={busy} session={session} opened={opened === current.id} onChanged={() => {
            setRefresh((value) => value + 1);
            // 자기 직책·파트가 바뀌면 권한과 메뉴가 달라지므로 세션도 다시 받습니다.
            if (current.id === session.id) refreshSession();
          }} onRenew={() => renew(current.id)} onRevoke={(reason) => revoke(current.id, reason)}
            onReopen={() => reopen(current.id)} onApprove={(type) => approve(current.id, type)} onReject={(reason) => reject(current.id, reason)} />
            : <p className={styles.placeholder}>왼쪽 목록에서 단원을 고르면 여기에 정보가 나옵니다.</p>}
        </div>
      </div>
    </section>
  </section>;
}

// 승인 직후 안내는 이 자리에서 실제로 할 수 있는 일만 말합니다. 직책 권한이 없으면 승인 사실만, OB면 파트·기수 확인까지만 안내합니다.
function approvedNote(item: MemberItem, session: MemberSession): string {
  if (!can(session, "MANAGE_ROLES")) return "승인했습니다.";
  if (item.memberType !== "ACTIVE") return "승인했습니다. 파트와 기수를 확인해 주세요.";
  return "승인했습니다. 파트와 기수를 확인하고 직책을 더해 주세요.";
}

function MemberDetail({ item, busy, session, opened, onChanged, onRenew, onRevoke, onReopen, onApprove, onReject }: {
  item: MemberItem; busy: boolean; session: MemberSession; opened: boolean; onChanged: () => void;
  onRenew: () => void; onRevoke: (reason: string) => void; onReopen: () => void;
  onApprove: (type: "ACTIVE" | "OB") => void; onReject: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  // 사이트 관리자·단장·부단장 계정의 접근 해제는 사이트 관리자만 할 수 있습니다.
  const leadership = item.admin || item.roles.some((role) => role.role === "PRESIDENT" || role.role === "VICE_PRESIDENT");
  return <article>
    <div className={styles.rowHeader}>
      <h2>{item.name}</h2>
      <StatusBadge tone={statusTone(item.status)}>{statusLabel[item.status]}</StatusBadge>
      {item.admin && <StatusBadge>사이트 관리자</StatusBadge>}
    </div>
    {item.email && <p>{item.email}</p>}
    <MemberFacts item={item} />
    {can(session, "APPROVE_APPLICATIONS") && item.status === "APPROVAL_PENDING"
      && <PendingApproval item={item} busy={busy} onApprove={onApprove} onReject={onReject} />}
    {opened && <Feedback tone="success">{approvedNote(item, session)}</Feedback>}
    {/* 승인되면 구분이 바뀌므로 폼의 입력값을 새로 잡습니다. */}
    <MemberRoles key={`${item.status}-${item.memberType}`} item={item} session={session} open={opened} onChanged={onChanged} />
    {can(session, "APPROVE_APPLICATIONS") && (item.status === "REVOKED" || !item.googleLinked && (item.status === "INVITED" || item.status === "APPROVED")) && <div className={styles.actions}>
      <Button variant="secondary" type="button" disabled={busy} onClick={onRenew}
        aria-label={`${item.name} ${item.status === "INVITED" ? "초대 링크 다시 발급" : item.status === "REVOKED" ? "다시 초대" : "계정 연결 링크 발급"}`}>
        {item.status === "INVITED" ? "초대 링크 다시 발급" : item.status === "REVOKED" ? "다시 초대" : "계정 연결 링크 발급"}
      </Button>
    </div>}
    {can(session, "APPROVE_APPLICATIONS") && item.status === "REJECTED" && <div className={styles.actions}>
      <Button variant="secondary" type="button" disabled={busy} onClick={onReopen} aria-label={`${item.name} 반려 취소`}>반려 취소</Button>
    </div>}
    {can(session, "REVOKE_ACCESS") && (!leadership || can(session, "MANAGE_SITE_ADMINS")) && (item.status === "APPROVED" || item.status === "INVITED")
      && item.id !== session.id && <details className={styles.more}>
      <summary aria-label={`${item.name} 접근 해제`}>접근 해제</summary>
      <div className={styles.fieldGroup}>
        <label htmlFor={`revoke-${item.id}`}>{item.name} 접근 해제 이유</label>
        <Input id={`revoke-${item.id}`} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
        <div className={styles.actions}><Button variant="danger" type="button" disabled={busy || !reason.trim()}
          onClick={() => onRevoke(reason.trim())}>{item.name} 접근 해제</Button></div>
      </div>
    </details>}
  </article>;
}

// 승인 대기 행에서 운영진이 할 일을 한 상자에 모읍니다. 가입 승인 화면으로 옮겨 가지 않아도 이 자리에서 끝납니다.
function PendingApproval({ item, busy, onApprove, onReject }:
  { item: MemberItem; busy: boolean; onApprove: (type: "ACTIVE" | "OB") => void; onReject: (reason: string) => void }) {
  const [type, setType] = useState<"ACTIVE" | "OB">("ACTIVE");
  const [reason, setReason] = useState("");
  return <div className={styles.approval}>
    <p className={styles.hint}>구글 계정으로 로그인해 가입을 신청했습니다. 이름, 파트, 기수가 아는 단원과 맞는지 확인하고 단원 구분을 골라 승인해 주세요. 승인하면 이 자리에서 바로 직책을 줄 수 있고, 본인은 다시 로그인해야 합니다.</p>
    <form className={styles.inlineForm} onSubmit={(event) => { event.preventDefault(); onApprove(type); }}>
      <label htmlFor={`approve-${item.id}`}>단원 구분</label>
      <Select id={`approve-${item.id}`} aria-label={`${item.name} 단원 구분`} value={type} onChange={(event) => setType(event.target.value as "ACTIVE" | "OB")}>
        <option value="ACTIVE">활동 단원</option><option value="OB">OB</option>
      </Select>
      <Button variant="primary" type="submit" disabled={busy} aria-label={`${item.name} 승인`}>승인</Button>
    </form>
    <details className={styles.more}>
      <summary aria-label={`${item.name} 가입 신청 반려`}>가입 신청 반려</summary>
      <div className={styles.fieldGroup}>
        <label htmlFor={`reject-${item.id}`}>{item.name} 반려 이유</label>
        <Input id={`reject-${item.id}`} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
        <div className={styles.actions}><Button variant="danger" type="button" disabled={busy || !reason.trim()}
          onClick={() => { if (window.confirm(`${item.name}의 가입 신청을 반려할까요? 반려한 뒤에도 이 화면에서 취소할 수 있습니다.`)) onReject(reason.trim()); }}>{item.name} 반려</Button></div>
      </div>
    </details>
  </div>;
}
