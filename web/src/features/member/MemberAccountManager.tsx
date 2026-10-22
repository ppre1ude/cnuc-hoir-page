"use client";

import { Button, Input, Select, Feedback, PageHeader, SkeletonRows } from "../../components/ui";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiRequestError } from "../../lib/api";
import { can, type MemberSession } from "../auth/session";
import { useSession, useSessionState } from "../auth/SessionProvider";
import { cancelRejection, getMembers, inviteMember, reissueAccountSetup, revokeMember,
  type IssuedInvitation, type MemberItem, type MemberPage } from "./adminMembers";
import styles from "./AdminPages.module.css";
import { MemberRegistration } from "./MemberRegistration";
import { MemberRoles } from "./MemberRoles";

export function MemberAccountManager() {
  const session = useSession();
  const { refresh: refreshSession } = useSessionState();
  const [data, setData] = useState<MemberPage | null>(null);
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<IssuedInvitation | null>(null);

  useEffect(() => {
    let alive = true;
    getMembers(page).then((result) => { if (alive) setData(result); })
      .catch(() => { if (alive) setError("단원 계정을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [page, refresh]);

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
      setPage(0);
      setRefresh((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof ApiRequestError && caught.code === "EMAIL_ALREADY_USED"
        ? "이미 등록된 이메일입니다." : "계정을 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function renew(id: number) {
    if (busy) return;
    setBusy(true);
    setError("");
    setIssued(null);
    try {
      setIssued(await reissueAccountSetup(id));
      setRefresh((value) => value + 1);
    } catch {
      setError("계정 설정 링크를 발급하지 못했습니다. 계정 상태를 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number, reason: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setIssued(null);
    try {
      await revokeMember(id, reason);
      setRefresh((value) => value + 1);
    } catch {
      setError("접근을 해제하지 못했습니다. 계정 상태를 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function reopen(id: number) {
    if (busy) return;
    setBusy(true);
    setError("");
    setIssued(null);
    try {
      await cancelRejection(id);
      setRefresh((value) => value + 1);
    } catch {
      setError("반려를 취소하지 못했습니다. 계정 상태를 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

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
        <summary>구글 로그인으로 승인되지 않는 경우</summary>
        <p className={styles.hint}>구글이 이메일 소유를 확인하지 못하는 주소라서 로그인해도 승인되지 않을 때 사용합니다. 계정을 먼저 만들고 1회용 링크를 발급하니, 24시간 안에 본인에게 직접 전달해 주세요.</p>
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
      {data?.items.length === 0 && <p>등록된 계정이 없습니다.</p>}
      <div className={styles.list}>{!data && !error && <SkeletonRows count={4} label="계정 목록을 불러오는 중입니다." />}
        {data?.items.map((item) => <MemberRow key={item.id} item={item} busy={busy} session={session} onChanged={() => {
          setRefresh((value) => value + 1);
          // 자기 직책·파트가 바뀌면 권한과 메뉴가 달라지므로 세션도 다시 받습니다.
          if (item.id === session.id) refreshSession();
        }} onRenew={() => renew(item.id)} onRevoke={(reason) => revoke(item.id, reason)}
          onReopen={() => reopen(item.id)} />)}</div>
      {data && data.total > data.size && <nav className={styles.pagination} aria-label="계정 목록 페이지">
        <Button variant="secondary" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</Button>
        <span>{page + 1} / {Math.ceil(data.total / data.size)}</span>
        <Button variant="secondary" type="button" disabled={(page + 1) * data.size >= data.total} onClick={() => setPage(page + 1)}>다음</Button>
      </nav>}
    </section>
  </section>;
}

function MemberRow({ item, busy, session, onChanged, onRenew, onRevoke, onReopen }: {
  item: MemberItem; busy: boolean; session: MemberSession; onChanged: () => void;
  onRenew: () => void; onRevoke: (reason: string) => void; onReopen: () => void;
}) {
  const [reason, setReason] = useState("");
  const status = item.status === "INVITED" ? "초대 대기" : item.status === "APPROVED" ? "사용 중"
    : item.status === "REVOKED" ? "접근 해제" : item.status === "EMAIL_PENDING" ? "이전 가입 확인 대기"
    : item.status === "APPROVAL_PENDING" ? "이전 가입 승인 대기" : "가입 반려";
  // 사이트 관리자·단장·부단장 계정의 접근 해제는 사이트 관리자만 할 수 있습니다.
  const leadership = item.admin || item.roles.some((role) => role.role === "PRESIDENT" || role.role === "VICE_PRESIDENT");
  const type = item.memberType === "OB" ? "OB" : item.memberType === "ACTIVE" ? "활동 단원" : "구분 미지정";
  return <article className={styles.row}>
    <h2>{item.name}</h2>
    <p>{[item.email, type, status].filter(Boolean).join(" · ")}</p>
    <MemberRoles item={item} session={session} onChanged={onChanged} />
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
