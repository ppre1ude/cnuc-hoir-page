"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "../../lib/api";
import { getSession } from "../auth/session";
import { createNotice, getAdminNotices, updateNotice, type Notice, type NoticePage } from "./notices";

export function NoticeEditor() {
  const router = useRouter();
  const [data, setData] = useState<NoticePage | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Notice | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [published, setPublished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    let alive = true;
    getSession().then(async (session) => {
      if (!session.admin || session.status !== "APPROVED") {
        if (alive) setCanEdit(false);
        if (alive) setError("운영진만 공지를 편집할 수 있습니다.");
        return;
      }
      if (alive) setCanEdit(true);
      const result = await getAdminNotices(page);
      if (alive) {
        setData(result);
        setListError("");
      }
    }).catch((caught) => {
      if (!alive) return;
      if (caught instanceof ApiRequestError && caught.status === 401) router.replace("/login");
      else setListError("공지 목록을 불러오지 못했습니다.");
    });
    return () => { alive = false; };
  }, [page, retry, router]);

  function edit(notice: Notice) {
    setSelected(notice);
    setTitle(notice.title);
    setBody(notice.body);
    setPublished(notice.published);
  }

  function clear() {
    setSelected(null);
    setTitle("");
    setBody("");
    setPublished(false);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const input = { title: title.trim(), body, published };
      if (selected) await updateNotice(selected.id, input);
      else await createNotice(input);
      clear();
      setSaved(true);
    } catch {
      setError("공지를 저장하지 못했습니다.");
      setBusy(false);
      return;
    }
    try {
      setData(await getAdminNotices(page));
      setListError("");
    } catch {
      setData(null);
      setListError("공지는 저장됐지만 목록을 새로고침하지 못했습니다.");
    } finally { setBusy(false); }
  }

  const visibleData = !listError && data?.page === page ? data : null;
  return <section>
    <h1>공지 관리</h1>
    {error && <p role="alert">{error}</p>}
    {saved && <p role="status">공지를 저장했습니다.</p>}
    {listError && <><p role="alert">{listError}</p><button type="button" onClick={() => { setListError(""); setData(null); setRetry(retry + 1); }}>다시 시도</button></>}
    {visibleData && <>
      {visibleData.items.length === 0 && <p>작성된 공지가 없습니다.</p>}
      {visibleData.items.map((notice) => <button type="button" key={notice.id} onClick={() => edit(notice)}>
        {notice.title} ({notice.published ? "게시" : "초안"})
      </button>)}
      {visibleData.total > visibleData.size && <nav aria-label="공지 관리 페이지">
        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button>
        <span>{page + 1} / {Math.ceil(visibleData.total / visibleData.size)}</span>
        <button type="button" disabled={(page + 1) * visibleData.size >= visibleData.total} onClick={() => setPage(page + 1)}>다음</button>
      </nav>}
    </>}
    {canEdit &&
      <form onSubmit={save}>
        <h2>{selected ? "공지 수정" : "공지 작성"}</h2>
        <label htmlFor="notice-title">제목</label>
        <input id="notice-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required />
        <label htmlFor="notice-body">본문</label>
        <textarea id="notice-body" value={body} onChange={(event) => setBody(event.target.value)} maxLength={10000} required />
        <label htmlFor="notice-published">게시</label>
        <input id="notice-published" type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
        <button type="submit" disabled={busy || !title.trim() || !body.trim()}>저장</button>
        {selected && <button type="button" onClick={clear}>새 공지</button>}
      </form>
    }
  </section>;
}
