"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiRequestError } from "../../lib/api";
import { addAllowlist, getAllowlist, removeAllowlist, type AllowlistPage } from "./adminMembers";
import styles from "./AdminPages.module.css";

export function AllowlistManager() {
  const [data, setData] = useState<AllowlistPage | null>(null);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    getAllowlist(page).then((value) => {
      if (!alive) return;
      if (page > 0 && value.items.length === 0 && value.total <= page * value.size) {
        setData(null);
        setPage(Math.max(0, Math.ceil(value.total / value.size) - 1));
      } else setData(value);
    })
      .catch(() => { if (alive) setError("자동 승인 명단을 불러오지 못했습니다."); });
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
      await addAllowlist({
        email: String(values.get("email") ?? "").trim(),
        memberType: String(values.get("memberType")) as "ACTIVE" | "OB",
        name: String(values.get("name") ?? "").trim(),
      });
      form.reset();
      setPage(0);
      setRevision((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "명단에 등록하지 못했습니다.");
    } finally { setBusy(false); }
  }

  async function remove(id: number) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await removeAllowlist(id);
      setRevision((value) => value + 1);
    } catch { setError("명단에서 삭제하지 못했습니다."); }
    finally { setBusy(false); }
  }

  return <section className={styles.memberSection} aria-labelledby="allowlist-title">
    <h2 id="allowlist-title">자동 승인 명단</h2>
    <div className={styles.grid}>
      <form className={`${styles.panel} ${styles.form}`} onSubmit={add}>
        <label htmlFor="allowlist-email">자동 승인 이메일</label>
        <input id="allowlist-email" name="email" type="email" maxLength={254} required />
        <label htmlFor="allowlist-name">이름 (선택)</label>
        <input id="allowlist-name" name="name" maxLength={100} />
        <label htmlFor="allowlist-type">단원 구분</label>
        <select id="allowlist-type" name="memberType" defaultValue="ACTIVE">
          <option value="ACTIVE">활동 단원</option><option value="OB">OB</option>
        </select>
        <button className={styles.button} type="submit" disabled={busy}>명단에 추가</button>
      </form>
      <div className={styles.panel}>
        {data?.items.length === 0 && <p>등록된 이메일이 없습니다.</p>}
        <div className={styles.list}>{data?.items.map((item) => <article className={styles.row} key={item.id}>
          <h2>{item.name || item.email}</h2>
          <p>{item.email} · {item.memberType === "OB" ? "OB" : "활동 단원"}</p>
          <button className={styles.danger} type="button" disabled={busy} onClick={() => remove(item.id)}>명단에서 삭제</button>
        </article>)}</div>
        {data && data.total > data.size && <nav className={styles.pagination} aria-label="자동 승인 명단 페이지">
          <button className={styles.secondary} type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button>
          <span>{page + 1} / {Math.ceil(data.total / data.size)}</span>
          <button className={styles.secondary} type="button" disabled={(page + 1) * data.size >= data.total} onClick={() => setPage(page + 1)}>다음</button>
        </nav>}
      </div>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </section>;
}
