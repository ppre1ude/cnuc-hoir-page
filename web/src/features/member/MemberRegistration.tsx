"use client";

import { Button, Input, Select, Feedback } from "../../components/ui";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ApiRequestError } from "../../lib/api";
import { can, type MemberSession } from "../auth/session";
import { addAllowlist, addOperatorPreapproval, getAllowlist, getOperatorPreapprovals,
  removeAllowlist, removeOperatorPreapproval } from "./adminMembers";
import styles from "./AdminPages.module.css";

type Pending = { id: number; email: string; memberType: "ACTIVE" | "OB"; name?: string | null };
type PendingPage = { items: Pending[]; page: number; size: number; total: number };

export function MemberRegistration({ session, children }: { session: MemberSession; children?: ReactNode }) {
  const [revision, setRevision] = useState(0);
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  // 구글이 주소 소유를 보증하는 Gmail만 로그인 즉시 승인되므로, 다른 주소와 gmial 같은 오타를 입력 중에 알려 줍니다.
  const notGmail = email.trim() !== "" && !email.trim().toLowerCase().endsWith("@gmail.com");

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const address = email.trim();
    const memberType = String(values.get("memberType")) as "ACTIVE" | "OB";
    setBusy(true);
    setError("");
    try {
      if (admin) await addOperatorPreapproval({ email: address, memberType });
      else await addAllowlist({ email: address, memberType, name: String(values.get("name") ?? "").trim() });
      // 여러 명을 이어서 넣을 때 구분이 활동 단원으로 돌아가 OB를 잘못 등록하지 않도록 구분은 그대로 둡니다.
      (form.elements.namedItem("name") as HTMLInputElement).value = "";
      setEmail("");
      (form.elements.namedItem("email") as HTMLInputElement).focus();
      setAdmin(false);
      setRevision((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "등록하지 못했습니다.");
    } finally { setBusy(false); }
  }

  return <div className={styles.grid}>
    <section className={styles.panel} aria-labelledby="register-title">
      <div className={styles.panelHeader}><h2 id="register-title">단원 추가</h2></div>
      {can(session, "MANAGE_ALLOWLIST") && <form className={styles.form} onSubmit={add}>
        <label htmlFor="register-email">구글 계정 이메일</label>
        <Input id="register-email" name="email" type="email" maxLength={254} required
          value={email} onChange={(event) => setEmail(event.target.value)}
          aria-describedby={notGmail ? "register-email-warning" : undefined} />
        {notGmail && <p id="register-email-warning" className={styles.hint}>@gmail.com 주소가 아니면 로그인해도 바로 승인되지 않습니다. 철자를 확인하고, 맞는 주소라면 그 단원이 로그인한 뒤 가입 승인에서 직접 승인해 주세요.</p>}
        <label htmlFor="register-name">이름 (선택)</label>
        <Input id="register-name" name="name" maxLength={100} disabled={admin} />
        <label htmlFor="register-type">단원 구분</label>
        <Select id="register-type" name="memberType" defaultValue="ACTIVE">
          <option value="ACTIVE">활동 단원</option><option value="OB">OB</option>
        </Select>
        {can(session, "MANAGE_SITE_ADMINS") && <label className={styles.check}><Input type="checkbox" checked={admin} onChange={(event) => setAdmin(event.target.checked)} /> 사이트 관리자 권한도 부여</label>}
        <Button variant="primary" type="submit" disabled={busy}>등록</Button>
        <p className={styles.hint}>@gmail.com 주소는 그 구글 계정으로 로그인하면 바로 승인됩니다. 다른 주소로 만든 구글 계정은 로그인하면 가입 승인에 올라오니 직접 승인해 주세요. 사이트 관리자 권한은 사이트 관리자만 줄 수 있습니다.</p>
      </form>}
      {error && <Feedback tone="error">{error}</Feedback>}
      {can(session, "APPROVE_APPLICATIONS") && children}
    </section>
    {can(session, "MANAGE_ALLOWLIST") && <section className={styles.panel} aria-labelledby="pending-title">
      <div className={styles.panelHeader}><h2 id="pending-title">로그인을 기다리는 등록</h2></div>
      <p className={styles.hint}>등록을 삭제해도 이미 승인된 계정과 권한은 유지됩니다. 필요하면 계정 목록에서 접근을 해제해 주세요.</p>
      {can(session, "MANAGE_SITE_ADMINS") && <PendingList key={`admin-${revision}`} admin load={getOperatorPreapprovals} remove={removeOperatorPreapproval} />}
      <PendingList key={`member-${revision}`} load={getAllowlist} remove={removeAllowlist} />
    </section>}
  </div>;
}

function PendingList({ admin = false, load, remove }: {
  admin?: boolean; load: (page: number) => Promise<PendingPage>; remove: (id: number) => Promise<void>;
}) {
  const [data, setData] = useState<PendingPage | null>(null);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    load(page).then((value) => {
      if (!alive) return;
      if (page > 0 && value.items.length === 0 && value.total <= page * value.size) {
        setData(null);
        setPage(Math.max(0, Math.ceil(value.total / value.size) - 1));
      } else setData(value);
    }).catch(() => { if (alive) setError("등록 목록을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [load, page, revision]);

  async function removeItem(id: number) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await remove(id);
      setRevision((value) => value + 1);
    } catch { setError("등록을 삭제하지 못했습니다."); }
    finally { setBusy(false); }
  }

  return <>
    {!admin && data?.items.length === 0 && <p className={styles.hint}>등록된 단원 이메일이 없습니다.</p>}
    {data?.items.map((item) => <article className={styles.pendingRow} key={item.id}>
      <div>
        <h2>{item.name || item.email}</h2>
        <p>{item.name ? `${item.email} · ` : ""}{item.memberType === "OB" ? "OB" : "활동 단원"}{admin ? " · 사이트 관리자" : ""}</p>
      </div>
      <Button variant="danger" size="small" type="button" disabled={busy} aria-label={`${item.email} 등록 삭제`}
        onClick={() => removeItem(item.id)}>삭제</Button>
    </article>)}
    {data && data.total > data.size && <nav className={styles.pagination} aria-label={admin ? "운영진 등록 페이지" : "단원 등록 페이지"}>
      <Button variant="secondary" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</Button>
      <span>{page + 1} / {Math.ceil(data.total / data.size)}</span>
      <Button variant="secondary" type="button" disabled={(page + 1) * data.size >= data.total} onClick={() => setPage(page + 1)}>다음</Button>
    </nav>}
    {error && <Feedback tone="error">{error}</Feedback>}
  </>;
}
