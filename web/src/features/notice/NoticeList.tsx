"use client";

import { Button, Feedback, Linkify, PageHeader, Pagination, SkeletonRows } from "../../components/ui";

import { useCallback, useEffect, useState } from "react";
import { usePageParam } from "../../lib/pageParam";
import { getNotice, getNotices, type Notice, type NoticePage, type PollView } from "./notices";
import { NoticePoll } from "./NoticePoll";
import { NoticePollPreview } from "./NoticePollPreview";
import styles from "./NoticeList.module.css";

function dateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function NoticeList({ initialNoticeId = null }: { initialNoticeId?: number | null }) {
  const [page, setPage] = usePageParam();
  const [data, setData] = useState<NoticePage | null>(null);
  // 현재 쪽에 없는 공지(?notice=로 바로 연 지난 공지)만 상세 API로 받아 여기에 둡니다.
  const [standalone, setStandalone] = useState<Notice | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(initialNoticeId);
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
    getNotices(page).then((result) => {
      if (!alive) return;
      // 범위 밖 쪽(손으로 적은 번호, 공지가 줄어든 뒤의 새로고침)은 마지막 쪽으로 보정하고 주소도 고칩니다.
      const last = Math.max(0, Math.ceil(result.total / result.size) - 1);
      if (page > last) { setPage(last); return; }
      setData(result);
      setListError("");
    }).catch(() => { if (alive) setListError("공지 목록을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [page, retry, setPage]);

  const visibleData = !listError && data?.page === page ? data : null;
  const listed = visibleData?.items.find((notice) => notice.id === selectedId) ?? null;
  const isListed = listed !== null;
  const listSettled = visibleData !== null || listError !== "";

  // 목록 안의 공지는 받아 둔 본문을 바로 펼치므로, 목록이 온 뒤 거기에 없는 공지만 따로 받습니다.
  useEffect(() => {
    if (selectedId === null || isListed || !listSettled) return;
    let alive = true;
    getNotice(selectedId).then((notice) => {
      if (alive) { setStandalone(notice); setDetailError(""); }
    }).catch(() => { if (alive) setDetailError("공지를 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [selectedId, detailRetry, isListed, listSettled]);

  function open(id: number | null) {
    setStandalone(null);
    setDetailError("");
    setSelectedId(id === selectedId ? null : id);
  }

  function close() {
    (document.getElementById(`notice-trigger-${selectedId}`) ?? document.getElementById("member-content"))?.focus();
    open(null);
  }

  // 이전과 다음이 목록 맨 아래에 있어 그대로 두면 새 쪽의 끝에 서게 됩니다. 본문 영역 머리로 옮기고 초점도 둡니다.
  function changePage(next: number) {
    open(null);
    setPage(next);
    const main = document.getElementById("member-content");
    main?.focus();
    main?.scrollIntoView?.({ block: "start" });
  }

  const visibleNotice = listed ?? (standalone?.id === selectedId ? standalone : null);
  function detail() {
    return <section aria-label="공지 본문" className={styles.detail}>
      {detailError ? <><Feedback tone="error">{detailError}</Feedback><Button variant="secondary" onClick={() => { setDetailError(""); setDetailRetry((value) => value + 1); }}>다시 시도</Button></>
        : !visibleNotice ? <SkeletonRows count={3} label="공지를 불러오는 중입니다." />
        : <><p className={styles.body}><Linkify text={visibleNotice.body} /></p><NoticePoll key={visibleNotice.id} noticeId={visibleNotice.id} onChanged={updatePoll} /></>}
      <Button variant="ghost" className={styles.close} onClick={close}>닫기</Button>
    </section>;
  }

  return <main id="member-content" tabIndex={-1} className={styles.page}>
    <PageHeader title="공지" />
    {listError && <><Feedback tone="error">{listError}</Feedback><Button variant="secondary" type="button" onClick={() => { setListError(""); setData(null); setRetry(retry + 1); }}>다시 시도</Button></>}
    {visibleData?.items.length === 0 && <p>게시된 공지가 없습니다.</p>}
    {visibleData && selectedId !== null && !isListed && <article className={styles.standalone}>
      <h2>{visibleNotice?.title ?? "선택한 공지"}</h2>
      {detail()}
    </article>}
    <div className={styles.list}>{!visibleData && !listError && <SkeletonRows count={5} label="공지를 불러오는 중입니다." />}
      {visibleData?.items.map((notice) => <article key={notice.id} className={`${styles.row} ${selectedId === notice.id ? styles.expanded : ""}`}>
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
    {visibleData && <Pagination label="공지 목록 페이지" page={page} size={visibleData.size} total={visibleData.total} onChange={changePage} />}
  </main>;
}
