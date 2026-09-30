"use client";

import { Button, Feedback, PageHeader } from "../../components/ui";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "../../lib/api";
import { getSession } from "../auth/session";
import { getNotice, getNotices, type Notice, type NoticePage } from "./notices";
import { NoticePoll } from "./NoticePoll";
import styles from "./NoticeList.module.css";

function dateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function NoticeList() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [data, setData] = useState<NoticePage | null>(null);
  const [selected, setSelected] = useState<Notice | null>(null);
  const [listError, setListError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    getSession().then(async (session) => {
      if (session.status !== "APPROVED") {
        if (alive) router.replace("/application-status");
        return;
      }
      const result = await getNotices(page);
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

  async function open(id: number) {
    setDetailError("");
    try { setSelected(await getNotice(id)); }
    catch { setDetailError("공지를 불러오지 못했습니다."); }
  }

  const visibleData = !listError && data?.page === page ? data : null;
  return <section className={styles.page}>
    <PageHeader title="공지" />
    {listError && <><Feedback tone="error">{listError}</Feedback><Button variant="secondary" type="button" onClick={() => { setListError(""); setData(null); setRetry(retry + 1); }}>다시 시도</Button></>}
    {detailError && <Feedback tone="error">{detailError}</Feedback>}
    {!visibleData && !listError && <p role="status">공지를 불러오는 중입니다.</p>}
    {visibleData?.items.length === 0 && <p>게시된 공지가 없습니다.</p>}
    <div className={styles.list}>{visibleData?.items.map((notice) => <article key={notice.id} className={styles.row}>
      <h2><Button variant="secondary" type="button" onClick={() => open(notice.id)}>{notice.title}</Button></h2>
      <p>{notice.author} · {notice.publishedAt && dateTime(notice.publishedAt)}</p>
    </article>)}</div>
    {selected && <article aria-label="공지 본문" className={styles.detail}>
      <h2>{selected.title}</h2>
      <p className={styles.meta}>{selected.author} · {dateTime(selected.createdAt)}</p>
      <p className={styles.body}>{selected.body}</p>
      <NoticePoll key={selected.id} noticeId={selected.id} />
      <Button variant="secondary" type="button" onClick={() => setSelected(null)}>닫기</Button>
    </article>}
    {visibleData && visibleData.total > visibleData.size && <nav aria-label="공지 목록 페이지" className={styles.pagination}>
      <Button variant="secondary" type="button" disabled={page === 0} onClick={() => { setSelected(null); setDetailError(""); setPage(page - 1); }}>이전</Button>
      <span>{page + 1} / {Math.ceil(visibleData.total / visibleData.size)}</span>
      <Button variant="secondary" type="button" disabled={(page + 1) * visibleData.size >= visibleData.total} onClick={() => { setSelected(null); setDetailError(""); setPage(page + 1); }}>다음</Button>
    </nav>}
  </section>;
}
