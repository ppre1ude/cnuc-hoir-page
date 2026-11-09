"use client";

import { ActionLink, BackLink, Button, Facts, Feedback, Linkify, PageHeader, Panel, Section, StatusBadge } from "../../components/ui";
import ui from "../../components/ui/ui.module.css";
import { pollWhileVisible } from "../../lib/poll";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { canManageRoster } from "../auth/session";
import { useSession } from "../auth/SessionProvider";
import { eventAudienceLabel, eventEndLabel, getEvent, getMyEventRsvp, isEventTarget, seoulDateTime, type ChoirEvent, type EventRsvpChoice } from "./events";
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
    let stop: (() => void) | undefined;
    getEvent(eventId).then((item) => {
      if (!alive) return;
      setEvent(item);
      const refreshAttendance = () => getEventAttendance(eventId).then((state) => {
        if (alive) { setAttendance(state); setAttendanceError(""); }
      }).catch(() => {
        if (alive) { setAttendance(null); setAttendanceError("출석 상태를 불러오지 못했습니다."); }
      });
      void refreshAttendance();
      stop = pollWhileVisible(refreshAttendance);
    }).catch(() => { if (alive) setError("일정을 불러오지 못했습니다."); });
    return () => { alive = false; stop?.(); };
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

  return <main id="member-content" tabIndex={-1} className={ui.readingPage}>
    <BackLink href="/dashboard">← 홈</BackLink>
    <PageHeader title={event?.title ?? "일정"} />
    {error && <Feedback tone="error">{error} <Button variant="secondary" onClick={() => { setError(""); setRetry((value) => value + 1); }}>다시 시도</Button></Feedback>}
    {!validId ? <p>일정 주소를 확인해 주세요.</p> :
      event && <Panel>
        <Facts items={[
          { label: "일시", value: <span className={event.cancelledAt ? styles.cancelled : undefined}>
            <time dateTime={event.startAt}>{seoulDateTime(event.startAt)}</time><span aria-hidden="true"> ~ </span><time dateTime={event.endAt}>{eventEndLabel(event)}</time>
          </span> },
          { label: "대상", value: <StatusBadge tone={event.obEligible ? "positive" : "neutral"}>{eventAudienceLabel(event, session.memberType)}</StatusBadge> },
          ...(event.cancelledAt ? [{ label: "상태", value: <StatusBadge tone="neutral">취소된 일정입니다</StatusBadge> }] : []),
        ]} />
        {event.description && <p className={styles.description}><Linkify text={event.description} /></p>}
        {rsvpLoaded && <EventRsvp layout="section" key={`${event.id}-${event.startAt}`} event={event} memberType={session.memberType} part={session.part} choice={rsvpChoice} onSaved={setRsvpChoice} />}
        {rsvpError && <Feedback tone="error">{rsvpError} <Button variant="secondary" type="button" onClick={() => {
          setRsvpError(""); setRsvpRetry((value) => value + 1);
        }}>다시 시도</Button></Feedback>}
        {/* 취소된 일정은 남은 출석 기록이 있을 때만 보여 줍니다. */}
        {!(event.cancelledAt && attendance?.status === "NOT_ELIGIBLE") && <Section title="내 출석"
          badge={attendance ? <StatusBadge tone={attendanceTone(attendance.status)}>{memberAttendanceLabel(attendance)}</StatusBadge> : !attendanceError && <span role="status">확인 중</span>}
          actions={canManageRoster(session, event) && <ActionLink variant="secondary" href={`/admin/events/${event.id}/attendance`}>운영진 출석 관리</ActionLink>}>
          {attendanceError && <Feedback tone="error">{attendanceError}</Feedback>}
          {attendance?.checkInOpen && isEventTarget(event, { memberType: session.memberType, part: session.part }) &&
            <ActionLink variant="primary" href={`/events/${event.id}/check-in`}>현장 출석하기</ActionLink>}
        </Section>}
        {/* 내 출석 섹션이 빠지는 취소 일정에서도 운영진은 남은 기록을 고치러 갈 수 있어야 합니다. */}
        {event.cancelledAt && attendance?.status === "NOT_ELIGIBLE" && canManageRoster(session, event) &&
          <div className={ui.actions}><ActionLink variant="secondary" href={`/admin/events/${event.id}/attendance`}>운영진 출석 관리</ActionLink></div>}
      </Panel>}
  </main>;
}
