"use client";

import { ActionLink, Button, Feedback } from "../../components/ui";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiRequestError } from "../../lib/api";
import { getAdminNotice, getAdminNoticePoll, type AdminPollView, type Notice } from "./notices";
import { NoticeForm } from "./NoticeForm";
import { NoticeFormSkeleton } from "./NoticeFormSkeleton";
import styles from "../member/AdminPages.module.css";

// 공지 수정 화면의 불러오기 부분입니다. 공지와 투표를 받아 폼에 넘기고, 저장되면 바뀐 공지와 투표를 다시 받습니다.
export function NoticeEdit({ noticeId }: { noticeId: number }) {
  const pageParam = useSearchParams().get("page");
  // 목록에서 2쪽 이상에서 들어왔으면 돌아갈 때 그 쪽으로 보냅니다.
  const returnTo = Number(pageParam) > 1 ? `/admin/notices?page=${pageParam}` : "/admin/notices";
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<"" | "missing" | "failed">("");
  const [retry, setRetry] = useState(0);
  const [poll, setPoll] = useState<AdminPollView | null>(null);
  const [pollState, setPollState] = useState<"loading" | "ready" | "failed">("loading");
  const [pollRetry, setPollRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    getAdminNotice(noticeId).then((value) => { if (alive) setNotice(value); }).catch((caught: unknown) => {
      if (alive) setError(caught instanceof ApiRequestError && caught.status === 404 ? "missing" : "failed");
    });
    return () => { alive = false; };
  }, [noticeId, retry]);

  // 다시 받는 동안 이전 투표와 폼을 그대로 둡니다. 스켈레톤으로 바꾸면 폼이 내려가 쓰던 내용과 저장 안내가 사라집니다.
  useEffect(() => {
    let alive = true;
    getAdminNoticePoll(noticeId).then((value) => { if (alive) { setPoll(value); setPollState("ready"); } }).catch((caught: unknown) => {
      if (!alive) return;
      if (caught instanceof ApiRequestError && caught.status === 404) { setPoll(null); setPollState("ready"); }
      else setPollState("failed");
    });
    return () => { alive = false; };
  }, [noticeId, pollRetry]);

  if (error === "missing") return <section className={styles.page}>
    <Feedback tone="error">공지를 찾을 수 없습니다.</Feedback>
    <div className={styles.actions}><ActionLink variant="secondary" href={returnTo}>공지 관리로</ActionLink></div>
  </section>;
  if (error === "failed") return <section className={styles.page}>
    <Feedback tone="error">공지를 불러오지 못했습니다.</Feedback>
    <div className={styles.actions}><Button variant="secondary" type="button" onClick={() => { setError(""); setRetry((value) => value + 1); }}>다시 시도</Button></div>
  </section>;
  if (!notice || pollState === "loading") return <NoticeFormSkeleton />;
  return <>
    {pollState === "failed" && <section className={styles.page}><Feedback tone="error">투표 정보를 불러오지 못했습니다.
      <Button variant="secondary" type="button" onClick={() => setPollRetry((value) => value + 1)}>다시 시도</Button></Feedback></section>}
    <NoticeForm key={notice.id} mode="edit" notice={notice} poll={poll} pollUnknown={pollState === "failed"} returnTo={returnTo}
      onSaved={(saved) => { setNotice(saved); setPollRetry((value) => value + 1); }} />
  </>;
}
