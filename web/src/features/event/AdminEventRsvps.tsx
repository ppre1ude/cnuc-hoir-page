"use client";

import { useEffect, useState } from "react";
import { getAdminEventRsvps, type AdminEventRsvps as Rsvps } from "./events";
import styles from "./EventEditor.module.css";

export function AdminEventRsvps({ eventId }: { eventId: number }) {
  const [data, setData] = useState<Rsvps | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    getAdminEventRsvps(eventId).then((result) => { if (alive) setData(result); })
      .catch(() => { if (alive) setError("참석 응답 현황을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [eventId, retry]);

  return <div className={styles.rsvpSummary}>
    <h3>참석 응답 <button type="button" disabled={!data && !error} onClick={() => {
      setData(null); setError(""); setRetry((value) => value + 1);
    }}>새로고침</button></h3>
    {error && <p role="alert">{error} <button type="button" onClick={() => { setError(""); setRetry((value) => value + 1); }}>다시 시도</button></p>}
    {!data && !error && <p role="status">응답을 불러오는 중입니다.</p>}
    {data && <>
      <p className={styles.rsvpCounts}>참석 {data.attending} · 불참 {data.absent} · 미응답 {data.unanswered}</p>
      <ul className={styles.rsvpMembers}>
        {data.members.map((member) => <li key={member.memberId}><span>{member.name}<br />{member.email}</span>
          <strong>{member.choice === "ATTENDING" ? "참석" : member.choice === "ABSENT" ? "불참" : "미응답"}</strong></li>)}
      </ul>
    </>}
  </div>;
}
