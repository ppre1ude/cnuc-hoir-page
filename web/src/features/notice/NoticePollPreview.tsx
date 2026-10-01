"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "../../components/ui";
import type { PollSummary } from "./notices";
import styles from "./NoticeList.module.css";

export function NoticePollPreview({ id, poll }: { id: string; poll: PollSummary }) {
  const [now, setNow] = useState(() => Date.now());
  const deadline = new Date(poll.closesAt).getTime();
  const closed = poll.closed || now >= deadline;
  useEffect(() => {
    if (closed) return;
    // 목록을 열어 둔 동안에도 마감 시각에 상태를 갱신한다.
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(deadline - now + 1, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [closed, deadline, now]);
  const choice = poll.myChoice === 1 ? poll.firstOption : poll.myChoice === 2 ? poll.secondOption : null;
  const label = closed ? "마감" : choice ?? "미참여";
  return <StatusBadge id={id} tone={!closed && choice ? "positive" : "neutral"} className={styles.pollBadge}>
    {label}{closed && choice && ` · ${choice}`}
  </StatusBadge>;
}
