"use client";

import { Button, Input, Select, Feedback } from "../../components/ui";

import { useEffect, useState, type FormEvent } from "react";
import { ApiRequestError } from "../../lib/api";
import { addOperatorPreapproval, getOperatorPreapprovals, removeOperatorPreapproval,
  type OperatorPreapprovalPage } from "./adminMembers";
import styles from "./AdminPages.module.css";

export function OperatorPreapprovalManager() {
  const [data, setData] = useState<OperatorPreapprovalPage | null>(null);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    getOperatorPreapprovals(page).then((value) => {
      if (!alive) return;
      if (page > 0 && value.items.length === 0 && value.total <= page * value.size) {
        setData(null);
        setPage(Math.max(0, Math.ceil(value.total / value.size) - 1));
      } else setData(value);
    }).catch(() => { if (alive) setError("운영진 사전 등록 목록을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [page, revision]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await addOperatorPreapproval({
        email: String(values.get("email") ?? "").trim(),
        memberType: String(values.get("memberType")) as "ACTIVE" | "OB",
      });
      form.reset();
      setPage(0);
      setRevision((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "운영진을 사전 등록하지 못했습니다.");
    } finally { setBusy(false); }
  }

  async function remove(id: number) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await removeOperatorPreapproval(id);
      setRevision((value) => value + 1);
    } catch { setError("운영진 사전 등록을 삭제하지 못했습니다."); }
    finally { setBusy(false); }
  }

  return <section className={styles.memberSection} aria-labelledby="operator-preapproval-title">
    <h2 id="operator-preapproval-title">운영진 사전 등록</h2>
    <p>등록한 이메일의 구글 계정으로 로그인하면 운영진 권한이 부여됩니다. 로그인 전에 해당 이메일의 소유자를 확인해 주세요. 등록을 삭제해도 이미 부여된 권한은 유지됩니다.</p>
    <div className={styles.grid}>
      <form className={`${styles.panel} ${styles.form}`} onSubmit={add}>
        <label htmlFor="operator-preapproval-email">구글 계정 이메일</label>
        <Input id="operator-preapproval-email" name="email" type="email" maxLength={254} required />
        <label htmlFor="operator-preapproval-type">단원 구분</label>
        <Select id="operator-preapproval-type" name="memberType" defaultValue="ACTIVE">
          <option value="ACTIVE">활동 단원</option><option value="OB">OB</option>
        </Select>
        <Button variant="primary" type="submit" disabled={busy}>운영진 사전 등록</Button>
      </form>
      <div className={styles.panel}>
        {data?.items.length === 0 && <p>사전 등록된 운영진이 없습니다.</p>}
        <div className={styles.list}>{data?.items.map((item) => <article className={styles.row} key={item.id}>
          <h2>{item.email}</h2>
          <p>{item.memberType === "OB" ? "OB" : "활동 단원"}</p>
          <Button variant="danger" type="button" disabled={busy} onClick={() => remove(item.id)}>사전 등록 삭제</Button>
        </article>)}</div>
        {data && data.total > data.size && <nav className={styles.pagination} aria-label="운영진 사전 등록 페이지">
          <Button variant="secondary" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</Button>
          <span>{page + 1} / {Math.ceil(data.total / data.size)}</span>
          <Button variant="secondary" type="button" disabled={(page + 1) * data.size >= data.total} onClick={() => setPage(page + 1)}>다음</Button>
        </nav>}
      </div>
    </div>
    {error && <Feedback tone="error">{error}</Feedback>}
  </section>;
}
