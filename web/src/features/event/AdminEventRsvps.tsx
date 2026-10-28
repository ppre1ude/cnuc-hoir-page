"use client";

import { Button, Feedback, SkeletonRows } from "../../components/ui";

import { useEffect, useState } from "react";
import { getAdminEventRsvps, type AdminEventRsvps as Rsvps } from "./events";
import { rosterName } from "../member/roles";
import styles from "./EventEditor.module.css";

export function AdminEventRsvps({ eventId }: { eventId: number }) {
  const [data, setData] = useState<Rsvps | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    // 새로고침과 다시 시도는 기억해 둔 응답을 건너뛰고 새로 받습니다.
    getAdminEventRsvps(eventId, retry ? "reload" : undefined).then((result) => { if (alive) setData(result); })
      .catch(() => { if (alive) setError("참석 응답 현황을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [eventId, retry]);

  return <div className={styles.rsvpSummary}>
    <h3>참석 응답 <Button variant="secondary" type="button" disabled={!data && !error} onClick={() => {
      setData(null); setError(""); setRetry((value) => value + 1);
    }}>새로고침</Button></h3>
    {error && <Feedback tone="error">{error} <Button variant="secondary" type="button" onClick={() => { setError(""); setRetry((value) => value + 1); }}>다시 시도</Button></Feedback>}
    {!data && !error && <SkeletonRows count={3} label="응답을 불러오는 중입니다." />}
    {data && <>
      <p className={styles.rsvpCounts}><span>참석 {data.attending}</span><span>불참 {data.absent}</span><span>미응답 {data.unanswered}</span></p>
      <ul className={styles.rsvpMembers}>
        {data.members.map((member) => <li key={member.memberId}><span>{rosterName(member)}</span>
          <strong>{member.choice === "ATTENDING" ? "참석" : member.choice === "ABSENT" ? "불참" : "미응답"}</strong></li>)}
      </ul>
    </>}
  </div>;
}
