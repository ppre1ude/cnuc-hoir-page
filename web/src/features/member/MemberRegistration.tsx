"use client";

import { Button, Input, Select, Feedback, StatusBadge } from "../../components/ui";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ApiRequestError } from "../../lib/api";
import { can, type MemberSession } from "../auth/session";
import { addAllowlist, addOperatorPreapproval, getAllowlist, getOperatorPreapprovals,
  removeAllowlist, removeOperatorPreapproval } from "./adminMembers";
import styles from "./AdminPages.module.css";

type Pending = { id: number; email: string; memberType: "ACTIVE" | "OB"; name?: string | null };
type PendingPage = { items: Pending[]; page: number; size: number; total: number };

// 이 칸은 계정을 만드는 곳이 아니라, 이메일을 미리 등록해 그 구글 계정의 첫 로그인을 자동 승인하는 곳입니다.
// 이름만으로는 그 뜻이 전해지지 않아, 제목 아래에 늘 보이는 설명 칸을 둡니다.
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
      setError(caught instanceof ApiRequestError ? caught.message : "미리 승인하지 못했습니다.");
    } finally { setBusy(false); }
  }

  return <section aria-labelledby="register-title">
    <h2 id="register-title">미리 승인</h2>
    <div className={styles.callout}>
      <p>새 단원의 Gmail 주소를 여기에 등록해 두면, 그 사람이 구글 계정으로 처음 로그인할 때 가입 승인을 거치지 않고 바로 단원이 됩니다. 등록하지 않은 사람이 로그인하면 가입 승인 페이지에 올라오니 거기서 승인하면 됩니다. Gmail이 아닌 주소는 자동 승인이 되지 않으니 아래 1회용 링크로 초대해 주세요.</p>
    </div>
    <div className={styles.registerGrid}>
      <div>
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
          <Button variant="primary" type="submit" disabled={busy}>미리 승인</Button>
        </form>}
        {error && <Feedback tone="error">{error}</Feedback>}
        {can(session, "APPROVE_APPLICATIONS") && children}
      </div>
      {can(session, "MANAGE_ALLOWLIST") && <div>
        <h3 id="pending-title">미리 승인한 이메일</h3>
        <p className={styles.hint}>아직 로그인하지 않은 사람입니다. 로그인하면 이 목록에서 사라지고 계정 목록에 나타납니다. 여기서 삭제해도 이미 승인된 계정은 그대로입니다.</p>
        <ul className={styles.pendingList} aria-labelledby="pending-title">
          {can(session, "MANAGE_SITE_ADMINS") && <PendingList key={`admin-${revision}`} admin load={getOperatorPreapprovals} remove={removeOperatorPreapproval} />}
          <PendingList key={`member-${revision}`} load={getAllowlist} remove={removeAllowlist} />
        </ul>
      </div>}
    </div>
  </section>;
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
    }).catch(() => { if (alive) setError("미리 승인한 이메일을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [load, page, revision]);

  async function removeItem(id: number) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await remove(id);
      setRevision((value) => value + 1);
    } catch { setError("삭제하지 못했습니다."); }
    finally { setBusy(false); }
  }

  // 사이트 관리자 목록과 단원 목록이 한 ul 안에 이어지므로, 줄 사이의 안내와 페이지 넘김도 li로 둡니다.
  return <>
    {/* 사이트 관리자 줄과 한 목록에 이어지므로, 단원 쪽이 비었다는 것만 말합니다. */}
    {!admin && data?.items.length === 0 && <li className={styles.pendingNote}>미리 승인한 단원 이메일이 없습니다.</li>}
    {data?.items.map((item) => <li className={styles.pendingRow} key={item.id}>
      <div>
        <strong>{item.name || item.email}</strong>
        {item.name && <span>{item.email}</span>}
        <StatusBadge>{item.memberType === "OB" ? "OB" : "활동 단원"}</StatusBadge>
        {admin && <StatusBadge tone="positive">사이트 관리자</StatusBadge>}
      </div>
      <Button variant="danger" size="small" type="button" disabled={busy} aria-label={`${item.email} 삭제`}
        onClick={() => removeItem(item.id)}>삭제</Button>
    </li>)}
    {data && data.total > data.size && <li><nav className={styles.pagination} aria-label={admin ? "사이트 관리자 미리 승인 페이지" : "단원 미리 승인 페이지"}>
      <Button variant="secondary" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</Button>
      <span>{page + 1} / {Math.ceil(data.total / data.size)}</span>
      <Button variant="secondary" type="button" disabled={(page + 1) * data.size >= data.total} onClick={() => setPage(page + 1)}>다음</Button>
    </nav></li>}
    {error && <li className={styles.pendingNote}><Feedback tone="error">{error}</Feedback></li>}
  </>;
}
