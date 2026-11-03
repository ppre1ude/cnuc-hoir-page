"use client";

import { ActionLink, Button, Feedback, PageHeader, Pagination, SkeletonRows, StatusBadge } from "../../components/ui";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePageParam } from "../../lib/pageParam";
import { getAdminNotices, type NoticePage } from "./notices";
import styles from "./NoticeManager.module.css";

// 작성 화면이 저장을 마치고 돌아올 때 ?done=으로 알리는 결과입니다.
const doneMessages: Record<string, string> = { published: "공지를 게시했습니다.", draft: "초안으로 저장했습니다." };
const date = (value: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" }).format(new Date(value));

// 공지 관리의 목록 화면입니다. 행을 누르면 수정 화면으로, 제목 옆 버튼으로 새 공지 작성으로 갑니다.
export function NoticeManager() {
  const [page, setPage] = usePageParam();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<NoticePage | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [done] = useState(() => doneMessages[params.get("done") ?? ""] ?? "");

  // 결과 안내는 한 번만 보이면 되므로 주소에서 done을 지웁니다. 쪽은 그대로 둡니다.
  const doneParam = params.get("done");
  const query = params.toString();
  useEffect(() => {
    if (!doneParam) return;
    const search = new URLSearchParams(query);
    search.delete("done");
    const rest = search.toString();
    router.replace(rest ? `${pathname}?${rest}` : pathname, { scroll: false });
  }, [doneParam, query, router, pathname]);

  useEffect(() => {
    let alive = true;
    getAdminNotices(page).then((result) => {
      if (!alive) return;
      const last = Math.max(0, Math.ceil(result.total / result.size) - 1);
      if (page > last) { setPage(last); return; }
      setData(result);
      setError("");
    }).catch(() => { if (alive) setError("공지 목록을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [page, retry, setPage]);

  const visible = !error && data?.page === page ? data : null;
  // 2쪽 이상에서는 수정 화면이 돌아올 쪽을 알 수 있게 행 링크에 쪽을 싣습니다.
  const href = (id: number) => page > 0 ? `/admin/notices/${id}?page=${page + 1}` : `/admin/notices/${id}`;
  function changePage(next: number) {
    setPage(next);
    const top = document.getElementById("notice-manager");
    top?.focus();
    top?.scrollIntoView?.({ block: "start" });
  }

  return <section className={styles.page} id="notice-manager" tabIndex={-1}>
    <PageHeader title="공지 관리" actions={<ActionLink href="/admin/notices/new">새 공지 작성</ActionLink>} />
    {done && <Feedback tone="success">{done}</Feedback>}
    {error && <><Feedback tone="error">{error}</Feedback>
      <Button variant="secondary" type="button" onClick={() => { setError(""); setData(null); setRetry((value) => value + 1); }}>다시 시도</Button></>}
    {!visible && !error && <SkeletonRows count={5} label="공지 목록을 불러오는 중입니다." />}
    {visible?.items.length === 0 && <p className={styles.empty}>작성된 공지가 없습니다. 새 공지 작성으로 첫 공지를 올려 주세요.</p>}
    {visible && visible.items.length > 0 && <ul className={styles.list} aria-label="공지 목록">
      {visible.items.map((notice) => <li key={notice.id}>
        <Link className={styles.row} href={href(notice.id)}>
          <strong>{notice.title}</strong>
          <StatusBadge tone={notice.published ? "neutral" : "attention"}>{notice.published ? "게시" : "초안"}</StatusBadge>
          <time dateTime={notice.publishedAt ?? notice.updatedAt}>{date(notice.publishedAt ?? notice.updatedAt)}</time>
          <span className={styles.arrow} aria-hidden="true">→</span>
        </Link>
      </li>)}
    </ul>}
    {visible && <Pagination label="공지 관리 페이지" page={page} size={visible.size} total={visible.total} onChange={changePage} />}
  </section>;
}
