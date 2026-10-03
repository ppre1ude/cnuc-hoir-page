"use client";

import { Button, Input, Select, Feedback, PageHeader } from "../../components/ui";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "../../lib/api";
import { can, getSession, type MemberSession } from "../auth/session";
import { getMembers, inviteMember, reissueAccountSetup, revokeMember,
  type IssuedInvitation, type MemberItem, type MemberPage } from "./adminMembers";
import styles from "./AdminPages.module.css";
import { MemberRegistration } from "./MemberRegistration";
import { MemberRoles } from "./MemberRoles";

export function MemberAccountManager() {
  const router = useRouter();
  const [data, setData] = useState<MemberPage | null>(null);
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<IssuedInvitation | null>(null);
  const [session, setSession] = useState<MemberSession | null>(null);

  useEffect(() => {
    let alive = true;
    getSession().then((current) => {
      if (!can(current, "VIEW_MEMBERS") || current.status !== "APPROVED") throw new Error("PERMISSION_REQUIRED");
      if (alive) setSession(current);
      return getMembers(page);
    }).then((result) => { if (alive) setData(result); }).catch((caught) => {
      if (!alive) return;
      if (caught instanceof ApiRequestError && caught.status === 401) router.replace("/login");
      else setError("단원 계정을 불러오지 못했습니다.");
    });
    return () => { alive = false; };
  }, [page, refresh, router]);

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

  const link = issued && typeof window !== "undefined"
    ? `${window.location.origin}/activate#token=${issued.token}` : "";

  if (!session) return <section className={styles.page}>
    <PageHeader title="단원 계정" />
    {error ? <><Feedback tone="error">{error}</Feedback>
      <Button variant="secondary" type="button" onClick={() => { setError(""); setRefresh((value) => value + 1); }}>다시 시도</Button></>
      : <p role="status">계정 목록을 불러오는 중입니다.</p>}
  </section>;

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
    {error && <Feedback tone="error">{error}</Feedback>}
    {link && <section className={`${styles.panel} ${styles.issued}`} aria-labelledby="link-title">
      <div className={styles.panelHeader}><h2 id="link-title">발급된 링크</h2></div>
      <p className={styles.hint}>이 링크는 한 번만 표시됩니다. 24시간 안에 해당 단원에게 비공개로 전달해 주세요.</p>
      <label className={styles.fieldLabel} htmlFor="issued-link">구글 계정 연결 링크</label>
      <Input id="issued-link" className={styles.linkInput} value={link} readOnly onFocus={(event) => event.currentTarget.select()} />
      <div className={styles.actions}><Button variant="secondary" type="button"
        onClick={() => navigator.clipboard.writeText(link).catch(() => setError("복사하지 못했습니다. 링크를 직접 선택해 주세요."))}>링크 복사</Button></div>
    </section>}
    <section aria-labelledby="members-title" className={styles.memberSection}>
      <h2 id="members-title">계정 목록</h2>
      {!data && !error && <p role="status">계정 목록을 불러오는 중입니다.</p>}
      {!data && error && <Button variant="secondary" type="button" onClick={() => { setError(""); setRefresh((value) => value + 1); }}>다시 시도</Button>}
      {data?.items.length === 0 && <p>등록된 계정이 없습니다.</p>}
      <div className={styles.list}>{data?.items.map((item) => <MemberRow key={item.id} item={item} busy={busy}
        session={session} onChanged={() => setRefresh((value) => value + 1)} onRenew={() => renew(item.id)} onRevoke={(reason) => revoke(item.id, reason)} />)}</div>
      {data && data.total > data.size && <nav className={styles.pagination} aria-label="계정 목록 페이지">
        <Button variant="secondary" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</Button>
        <span>{page + 1} / {Math.ceil(data.total / data.size)}</span>
        <Button variant="secondary" type="button" disabled={(page + 1) * data.size >= data.total} onClick={() => setPage(page + 1)}>다음</Button>
      </nav>}
    </section>
  </section>;
}

function MemberRow({ item, busy, session, onChanged, onRenew, onRevoke }: {
  item: MemberItem; busy: boolean; session: MemberSession; onChanged: () => void;
  onRenew: () => void; onRevoke: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const status = item.status === "INVITED" ? "초대 대기" : item.status === "APPROVED" ? "사용 중"
    : item.status === "REVOKED" ? "접근 해제" : item.status === "EMAIL_PENDING" ? "이전 가입 확인 대기"
    : item.status === "APPROVAL_PENDING" ? "이전 가입 승인 대기" : "가입 반려";
  const type = item.memberType === "OB" ? "OB" : item.memberType === "ACTIVE" ? "활동 단원" : "구분 미지정";
  return <article className={styles.row}>
    <h2>{item.name}</h2>
    <p>{item.email} · {type} · {status}</p>
    <MemberRoles item={item} session={session} onChanged={onChanged} />
    {can(session, "APPROVE_APPLICATIONS") && (item.status === "REVOKED" || !item.googleLinked && (item.status === "INVITED" || item.status === "APPROVED")) && <div className={styles.actions}>
      <Button variant="secondary" type="button" disabled={busy} onClick={onRenew}>
        {item.status === "INVITED" ? "초대 링크 다시 발급" : item.status === "REVOKED" ? "다시 초대" : "계정 연결 링크 발급"}
      </Button>
    </div>}
    {can(session, "REVOKE_ACCESS") && (item.status === "APPROVED" || item.status === "INVITED")
      && item.id !== session.id && <div className={styles.fieldGroup}>
      <label htmlFor={`revoke-${item.id}`}>접근 해제 이유</label>
      <Input id={`revoke-${item.id}`} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
      <div className={styles.actions}><Button variant="danger" type="button" disabled={busy || !reason.trim()}
        onClick={() => onRevoke(reason.trim())}>접근 해제</Button></div>
    </div>}
  </article>;
}
