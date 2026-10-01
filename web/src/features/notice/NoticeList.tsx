"use client";

import { Button, Feedback, PageHeader } from "../../components/ui";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "../../lib/api";
import { getSession } from "../auth/session";
import { getNotice, getNotices, type Notice, type NoticePage, type PollView } from "./notices";
import { NoticePoll } from "./NoticePoll";
import { NoticePollPreview } from "./NoticePollPreview";
import styles from "./NoticeList.module.css";

function dateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function NoticeList({ initialNoticeId = null }: { initialNoticeId?: number | null }) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [data, setData] = useState<NoticePage | null>(null);
  const [selected, setSelected] = useState<Notice | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(initialNoticeId);
  const [approved, setApproved] = useState(false);
  const [detailRetry, setDetailRetry] = useState(0);
  const [listError, setListError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [retry, setRetry] = useState(0);
  const updatePoll = useCallback((noticeId: number, poll: PollView) => {
    setData((current) => current ? {
      ...current, items: current.items.map((notice) => notice.id === noticeId ? { ...notice, poll } : notice),
    } : current);
  }, []);

  useEffect(() => {
    let alive = true;
    getSession().then(async (session) => {
      if (session.status !== "APPROVED") {
        if (alive) router.replace("/application-status");
        return;
      }
      if (!alive) return;
      setApproved(true);
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

  useEffect(() => {
    if (!approved || selectedId === null) return;
    let alive = true;
    getNotice(selectedId).then((notice) => {
      if (alive) { setSelected(notice); setDetailError(""); }
    }).catch(() => { if (alive) setDetailError("공지를 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [approved, selectedId, detailRetry]);

  function open(id: number | null) {
    setSelected(null);
    setDetailError("");
    setSelectedId(id === selectedId ? null : id);
  }

  function close() {
    (document.getElementById(`notice-trigger-${selectedId}`) ?? document.getElementById("member-content"))?.focus();
    open(null);
  }

  const visibleData = !listError && data?.page === page ? data : null;
  const visibleNotice = selected?.id === selectedId ? selected : null;
  const isInList = visibleData?.items.some((notice) => notice.id === selectedId);
  function detail() {
    return <section aria-label="공지 본문" className={styles.detail}>
      {detailError ? <><Feedback tone="error">{detailError}</Feedback><Button variant="secondary" onClick={() => { setDetailError(""); setDetailRetry((value) => value + 1); }}>다시 시도</Button></>
        : !visibleNotice ? <p role="status">공지를 불러오는 중입니다.</p>
        : <><p className={styles.body}>{visibleNotice.body}</p><NoticePoll key={visibleNotice.id} noticeId={visibleNotice.id} onChanged={updatePoll} /></>}
      <Button variant="ghost" className={styles.close} onClick={close}>닫기</Button>
    </section>;
  }

  return <main id="member-content" tabIndex={-1} className={styles.page}>
    <PageHeader title="공지" />
    {listError && <><Feedback tone="error">{listError}</Feedback><Button variant="secondary" type="button" onClick={() => { setListError(""); setData(null); setRetry(retry + 1); }}>다시 시도</Button></>}
    {!visibleData && !listError && <p role="status">공지를 불러오는 중입니다.</p>}
    {visibleData?.items.length === 0 && <p>게시된 공지가 없습니다.</p>}
    {approved && visibleData && selectedId !== null && !isInList && <article className={styles.standalone}>
      <h2>{visibleNotice?.title ?? "선택한 공지"}</h2>
      {detail()}
    </article>}
    <div className={styles.list}>{visibleData?.items.map((notice) => <article key={notice.id} className={`${styles.row} ${selectedId === notice.id ? styles.expanded : ""}`}>
      <h2><Button variant="unstyled" id={`notice-trigger-${notice.id}`} aria-expanded={selectedId === notice.id}
        aria-controls={`notice-body-${notice.id}`} aria-describedby={notice.poll ? `notice-poll-status-${notice.id}` : undefined} onClick={() => open(notice.id)}>
        <span>{notice.title}</span><span className={styles.chevron} aria-hidden="true">{selectedId === notice.id ? "−" : "+"}</span>
      </Button></h2>
      <div className={styles.rowMeta}>
        {notice.poll && <NoticePollPreview id={`notice-poll-status-${notice.id}`} poll={notice.poll} />}
        <p className={styles.meta}>{notice.author}{notice.publishedAt && <> · <time dateTime={notice.publishedAt}>{dateTime(notice.publishedAt)}</time></>}</p>
      </div>
      <div id={`notice-body-${notice.id}`} hidden={selectedId !== notice.id}>
        {selectedId === notice.id && detail()}
      </div>
    </article>)}</div>
    {visibleData && visibleData.total > visibleData.size && <nav aria-label="공지 목록 페이지" className={styles.pagination}>
      <Button variant="secondary" type="button" disabled={page === 0} onClick={() => { open(null); setPage(page - 1); }}>이전</Button>
      <span aria-label={`${Math.ceil(visibleData.total / visibleData.size)}페이지 중 ${page + 1}페이지`}>{page + 1} / {Math.ceil(visibleData.total / visibleData.size)}</span>
      <Button variant="secondary" type="button" disabled={(page + 1) * visibleData.size >= visibleData.total} onClick={() => { open(null); setPage(page + 1); }}>다음</Button>
    </nav>}
  </main>;
}
