"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ApiRequestError } from "../../lib/api";
import { getSession, type MemberSession } from "../auth/session";
import { getEvent, type ChoirEvent } from "./events";
import { EventDetail } from "./EventDetail";
import styles from "./EventCalendar.module.css";

export function EventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<ChoirEvent | null>(null);
  const [session, setSession] = useState<MemberSession | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const eventId = Number(id);
    if (!Number.isSafeInteger(eventId) || eventId < 1) return;
    let alive = true;
    getSession().then(async (member) => {
      if (!alive) return;
      if (member.status !== "APPROVED") { router.replace("/application-status"); return; }
      const item = await getEvent(eventId);
      if (!alive) return;
      setSession(member);
      setEvent(item);
    }).catch((caught) => {
      if (!alive) return;
      if (caught instanceof ApiRequestError && caught.status === 401) router.replace("/login");
      else setError("행사를 불러오지 못했습니다.");
    });
    return () => { alive = false; };
  }, [id, router]);

  return <div className={styles.dashboard}>
    <p><Link href="/dashboard">← 달력으로 돌아가기</Link></p>
    {error && <p role="alert">{error}</p>}
    {!Number.isSafeInteger(Number(id)) || Number(id) < 1 ? <p>행사 주소를 확인해 주세요.</p> :
      event && session ? <div className={styles.card}><EventDetail event={event} memberType={session.memberType} />
        <p className={styles.muted}>출석 상태는 행사별 출석 기능이 연결되면 표시됩니다.</p></div>
        : !error && <p role="status">행사를 불러오는 중입니다.</p>}
  </div>;
}
