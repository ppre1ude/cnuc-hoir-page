"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "../../lib/api";
import { getSession } from "../auth/session";
import { getNotice, getNotices, type Notice, type NoticePage } from "./notices";

function dateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function NoticeList() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [data, setData] = useState<NoticePage | null>(null);
  const [selected, setSelected] = useState<Notice | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    getSession().then(async (session) => {
      if (session.status !== "APPROVED") {
        if (alive) router.replace("/application-status");
        return;
      }
      const result = await getNotices(page);
      if (alive) setData(result);
    }).catch((caught) => {
      if (!alive) return;
      if (caught instanceof ApiRequestError && caught.status === 401) router.replace("/login");
      else setError("공지 목록을 불러오지 못했습니다.");
    });
    return () => { alive = false; };
  }, [page, router]);

  async function open(id: number) {
    setError("");
    try { setSelected(await getNotice(id)); }
    catch { setError("공지를 불러오지 못했습니다."); }
  }

  return <section>
    <h1>공지사항</h1>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">공지를 불러오는 중입니다.</p>}
    {data?.items.length === 0 && <p>게시된 공지가 없습니다.</p>}
    {data?.items.map((notice) => <article key={notice.id}>
      <h2><button type="button" onClick={() => open(notice.id)}>{notice.title}</button></h2>
      <p>{notice.author} · {notice.publishedAt && dateTime(notice.publishedAt)}</p>
    </article>)}
    {selected && <article aria-label="공지 본문">
      <h2>{selected.title}</h2>
      <p>작성자: {selected.author}</p>
      <p>작성: {dateTime(selected.createdAt)} · 수정: {dateTime(selected.updatedAt)}</p>
      <p style={{ whiteSpace: "pre-wrap" }}>{selected.body}</p>
      <button type="button" onClick={() => setSelected(null)}>닫기</button>
    </article>}
    {data && data.total > data.size && <nav aria-label="공지 목록 페이지">
      <button type="button" disabled={page === 0} onClick={() => { setSelected(null); setPage(page - 1); }}>이전</button>
      <span>{page + 1} / {Math.ceil(data.total / data.size)}</span>
      <button type="button" disabled={(page + 1) * data.size >= data.total} onClick={() => { setSelected(null); setPage(page + 1); }}>다음</button>
    </nav>}
  </section>;
}
