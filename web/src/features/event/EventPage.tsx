"use client";

import { Button, Feedback, PageHeader, StatusBadge } from "../../components/ui";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { canManageRoster } from "../auth/session";
import { useSession } from "../auth/SessionProvider";
import { getEvent, getMyEventRsvp, type ChoirEvent, type EventRsvpChoice } from "./events";
import { EventDetail } from "./EventDetail";
import { EventPageSkeleton } from "./EventPageSkeleton";
import { EventRsvp } from "./EventRsvp";
import { attendanceTone, getEventAttendance, memberAttendanceLabel, type AttendanceState } from "../attendance/attendance";
import styles from "./EventCalendar.module.css";

export function EventPage() {
  const session = useSession();
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<ChoirEvent | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [attendance, setAttendance] = useState<AttendanceState | null>(null);
  const [attendanceError, setAttendanceError] = useState("");
  const [rsvpChoice, setRsvpChoice] = useState<EventRsvpChoice | null>(null);
  const [rsvpLoaded, setRsvpLoaded] = useState(false);
  const [rsvpError, setRsvpError] = useState("");
  const [rsvpRetry, setRsvpRetry] = useState(0);

  useEffect(() => {
    const eventId = Number(id);
    if (!Number.isSafeInteger(eventId) || eventId < 1) return;
    let alive = true;
    let timer: number | undefined;
    getEvent(eventId).then((item) => {
      if (!alive) return;
      setEvent(item);
      const refreshAttendance = () => getEventAttendance(eventId).then((state) => {
        if (alive) { setAttendance(state); setAttendanceError(""); }
      }).catch(() => {
        if (alive) { setAttendance(null); setAttendanceError("출석 상태를 불러오지 못했습니다."); }
      });
      void refreshAttendance();
      timer = window.setInterval(refreshAttendance, 15000);
    }).catch(() => { if (alive) setError("일정을 불러오지 못했습니다."); });
    return () => { alive = false; if (timer !== undefined) window.clearInterval(timer); };
  }, [id, retry]);

  useEffect(() => {
    if (!event) return;
    let alive = true;
    getMyEventRsvp(event.id).then((response) => {
      if (alive) { setRsvpChoice(response.choice); setRsvpLoaded(true); setRsvpError(""); }
    }).catch(() => { if (alive) setRsvpError("참석 응답을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [event, rsvpRetry]);

  const validId = Number.isSafeInteger(Number(id)) && Number(id) >= 1;
  // 세션을 기다릴 때와 같은 틀을 이어 씁니다. 제목을 받기 전에 "일정"이라는 제목을 띄우면 없어진 일정 페이지처럼 보입니다.
  if (validId && !event && !error) return <main id="member-content" tabIndex={-1}>
    <span role="status" className={styles.srOnly}>일정을 불러오는 중입니다.</span><EventPageSkeleton />
  </main>;

  return <main id="member-content" tabIndex={-1} className={styles.eventPage}>
    <Link className={styles.backLink} href="/dashboard">← 홈</Link>
    <PageHeader title={event?.title ?? "일정"} />
    {error && <Feedback tone="error">{error} <Button variant="secondary" onClick={() => { setError(""); setRetry((value) => value + 1); }}>다시 시도</Button></Feedback>}
    {!validId ? <p>일정 주소를 확인해 주세요.</p> :
      event && <div className={styles.eventPageCard}><EventDetail event={event} memberType={session.memberType} part={session.part}
        checkInOpen={attendance?.checkInOpen ?? false} showTitle={false} />
        {rsvpLoaded && <EventRsvp key={`${event.id}-${event.startAt}`} event={event} memberType={session.memberType} part={session.part} choice={rsvpChoice} onSaved={setRsvpChoice} />}
        {rsvpError && <Feedback tone="error">{rsvpError} <Button variant="secondary" type="button" onClick={() => {
          setRsvpError(""); setRsvpRetry((value) => value + 1);
        }}>다시 시도</Button></Feedback>}
        {/* 취소된 일정은 남은 출석 기록이 있을 때만 보여 줍니다. */}
        {!(event.cancelledAt && attendance?.status === "NOT_ELIGIBLE") && <div className={styles.eventAttendance}><strong>내 출석</strong>{attendance ? <StatusBadge tone={attendanceTone(attendance.status)}>{memberAttendanceLabel(attendance)}</StatusBadge> : !attendanceError && <span role="status">확인 중</span>}</div>}
        {attendanceError && <Feedback tone="error">{attendanceError}</Feedback>}
        {canManageRoster(session, event) && <p><Link href={`/admin/events/${event.id}/attendance`}>운영진 출석 관리</Link></p>}</div>}
  </main>;
}
