"use client";

import { Button, Feedback, PageHeader } from "../../components/ui";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "../../lib/api";
import { getSession, type MemberSession } from "../auth/session";
import { getNotices, type Notice } from "../notice/notices";
import { type ChoirEvent, type EventRsvpChoice, getEvents, getMyEventRsvps, monthBounds, seoulDateKey } from "./events";
import { EventDetail } from "./EventDetail";
import { EventRsvp } from "./EventRsvp";
import { attendanceLabel, getEventAttendance, getMyAttendance, type AttendanceState } from "../attendance/attendance";
import styles from "./EventCalendar.module.css";

function moveMonth(month: string, offset: number) {
  const [year, number] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, number - 1 + offset, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(month: string) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number, 0)).getUTCDate();
}

function mondayOffset(month: string) {
  const [year, number] = month.split("-").map(Number);
  return (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;
}

export function EventCalendar() {
  const router = useRouter();
  const [month, setMonth] = useState(() => seoulDateKey(new Date()).slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(() => seoulDateKey(new Date()));
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [session, setSession] = useState<MemberSession | null>(null);
  const [events, setEvents] = useState<ChoirEvent[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [attendance, setAttendance] = useState<AttendanceState[]>([]);
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceState | null>(null);
  const [attendanceError, setAttendanceError] = useState("");
  const [rsvpByEvent, setRsvpByEvent] = useState<Record<number, EventRsvpChoice>>({});
  const [rsvpLoadedMonth, setRsvpLoadedMonth] = useState("");
  const [rsvpError, setRsvpError] = useState("");
  const [rsvpRetry, setRsvpRetry] = useState(0);
  const [noticesLoaded, setNoticesLoaded] = useState(false);
  const [noticeError, setNoticeError] = useState("");
  const [noticeRetry, setNoticeRetry] = useState(0);
  const [loadedMonth, setLoadedMonth] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    const { from, to } = monthBounds(month);
    getSession().then(async (member) => {
      if (!alive) return;
      if (member.status !== "APPROVED") { router.replace("/application-status"); return; }
      setSession(member);
      const monthEvents = await getEvents(from, to);
      if (!alive) return;
      setEvents(monthEvents);
      setLoadedMonth(month);
      setError("");
    }).catch((caught) => {
      if (!alive) return;
      if (caught instanceof ApiRequestError && caught.status === 401) router.replace("/login");
      else setError("일정을 불러오지 못했습니다.");
    });
    return () => { alive = false; };
  }, [month, retry, router]);

  useEffect(() => {
    if (session?.status !== "APPROVED") return;
    let alive = true;
    const { from, to } = monthBounds(month);
    getMyEventRsvps(from, to).then((items) => {
      if (!alive) return;
      setRsvpByEvent(Object.fromEntries(items.filter((item) => item.choice !== null)
        .map((item) => [item.eventId, item.choice as EventRsvpChoice])));
      setRsvpLoadedMonth(month); setRsvpError("");
    }).catch(() => { if (alive) { setRsvpLoadedMonth(""); setRsvpError("참석 응답을 불러오지 못했습니다."); } });
    return () => { alive = false; };
  }, [month, session?.status, rsvpRetry]);

  useEffect(() => {
    if (session?.status !== "APPROVED") return;
    let alive = true;
    getNotices(0).then((recent) => {
      if (!alive) return;
      setNotices(recent.items.slice(0, 3));
      setNoticesLoaded(true);
      setNoticeError("");
    }).catch((caught) => {
      if (!alive) return;
      if (caught instanceof ApiRequestError && caught.status === 401) router.replace("/login");
      else {
        setNotices([]);
        setNoticeError("공지를 불러오지 못했습니다.");
      }
    });
    return () => { alive = false; };
  }, [session?.status, noticeRetry, router]);

  useEffect(() => {
    if (session?.status !== "APPROVED") return;
    let alive = true;
    getMyAttendance().then((value) => { if (alive) { setAttendance(value); setAttendanceError(""); } })
      .catch(() => { if (alive) setAttendanceError("출석 기록을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [session?.status]);

  function changeMonth(offset: number) {
    const next = moveMonth(month, offset);
    setMonth(next);
    setSelectedDate(`${next}-01`);
    setSelectedEventId(null);
    setLoadedMonth("");
    setRsvpLoadedMonth("");
    setError("");
  }

  const monthEvents = loadedMonth === month && !error ? events : [];
  const dayEvents = monthEvents.filter((event) => {
    const first = seoulDateKey(event.startAt);
    const last = seoulDateKey(new Date(new Date(event.endAt).getTime() - 1));
    return first <= selectedDate && selectedDate <= last;
  });
  const sortedEvents = [...monthEvents].sort((first, second) => first.startAt.localeCompare(second.startAt));
  const upcomingEvent = sortedEvents.find((event) => seoulDateKey(event.startAt) >= selectedDate);
  const selected = dayEvents.find((event) => event.id === selectedEventId)
    ?? dayEvents[0] ?? upcomingEvent ?? sortedEvents[sortedEvents.length - 1];
  const selectedId = selected?.id;
  useEffect(() => {
    if (session?.status !== "APPROVED" || selectedId == null) return;
    let alive = true;
    const refresh = () => getEventAttendance(selectedId)
      .then((value) => { if (alive) setSelectedAttendance(value); })
      .catch(() => { if (alive) setSelectedAttendance(null); });
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [selectedId, session?.status]);
  const slots = Array.from({ length: mondayOffset(month) }, (_, index) => `blank-${index}`);
  const days = Array.from({ length: daysInMonth(month) }, (_, index) => index + 1);

  return <main className={styles.dashboard}>
    <PageHeader title="일정" className={styles.hero} />
    {error && <div role="alert" className={styles.error}>{error} <Button variant="secondary" type="button" onClick={() => setRetry(retry + 1)}>다시 시도</Button></div>}
    <div className={styles.grid}>
      <section aria-label="행사 달력" className={`${styles.card} ${styles.calendar}`}>
        <div className={styles.calendarHeader}>
          <h2>{month.replace("-", "년 ")}월</h2>
          <div className={styles.monthControls}>
            <Button variant="secondary" type="button" onClick={() => changeMonth(-1)} aria-label="이전 달">←</Button>
            <Button variant="secondary" type="button" onClick={() => changeMonth(1)} aria-label="다음 달">→</Button>
          </div>
        </div>
        <div className={styles.weekdays}>{["월", "화", "수", "목", "금", "토", "일"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className={styles.days}>
          {slots.map((slot) => <span key={slot} aria-hidden="true" />)}
          {days.map((day) => {
            const key = `${month}-${String(day).padStart(2, "0")}`;
            const eventsOnDay = monthEvents.filter((event) => {
              const first = seoulDateKey(event.startAt);
              const last = seoulDateKey(new Date(new Date(event.endAt).getTime() - 1));
              return first <= key && key <= last;
            });
            const count = eventsOnDay.length;
            return <Button variant="unstyled" type="button" key={key} className={`${styles.day} ${key === selectedDate ? styles.selectedDay : ""}`}
              onClick={() => { setSelectedDate(key); setSelectedEventId(null); }} aria-pressed={key === selectedDate}
              aria-label={`${day}일${count ? `, 행사 ${count}개` : ""}`}>
              <span className={styles.dayNumber}>{day}</span>
              {count > 0 && <span className={styles.dayEvent}>{eventsOnDay[0].title}</span>}
              {count > 1 && <span className={styles.moreEvents}>+{count - 1}</span>}
              {count > 0 && <i aria-hidden="true" />}
            </Button>;
          })}
        </div>
        <div className={styles.dayList}>
          <h3>{Number(selectedDate.slice(-2))}일 일정</h3>
          {dayEvents.length === 0 && <p>일정 없음</p>}
          {dayEvents.map((event) => <Button variant="unstyled" key={event.id} type="button" className={styles.eventButton}
            aria-pressed={selected?.id === event.id} onClick={() => setSelectedEventId(event.id)}>{event.title}</Button>)}
        </div>
      </section>
      <div className={styles.rightColumn}>
      <section aria-label="선택한 행사" className={`${styles.card} ${styles.detail}`}>
        <div className={styles.sectionHeader}><h2>이달의 행사</h2></div>
        {rsvpError && <Feedback tone="error">{rsvpError} <Button variant="secondary" type="button" onClick={() => {
          setRsvpError(""); setRsvpRetry((value) => value + 1);
        }}>다시 시도</Button></Feedback>}
        {sortedEvents.length === 0 && <p className={styles.empty}>등록된 행사가 없습니다.</p>}
        {sortedEvents.length > 0 && <div className={styles.eventList}>
          {sortedEvents.map((event) => {
            const date = seoulDateKey(event.startAt);
            return <div key={event.id} className={styles.eventRow}>
              <Button variant="unstyled" type="button" className={styles.eventSelect} aria-pressed={selected?.id === event.id}
                onClick={() => { setSelectedDate(date); setSelectedEventId(event.id); }}>
                <span className={styles.eventDate}>{date.slice(5).replace("-", ".")}</span>
                <span className={styles.eventTitle}>{event.title}</span>
              </Button>
              {rsvpLoadedMonth === month && <EventRsvp key={`${event.id}-${event.startAt}`} compact event={event}
                memberType={session?.memberType ?? null} choice={rsvpByEvent[event.id] ?? null}
                onSaved={(choice) => setRsvpByEvent((current) => ({ ...current, [event.id]: choice }))} />}
            </div>;
          })}
        </div>}
        {selected && <div className={styles.selectedEvent}><EventDetail event={selected} memberType={session?.memberType ?? null}
          checkInOpen={selectedAttendance?.eventId === selected.id && selectedAttendance.checkInOpen} link />
          {rsvpLoadedMonth === month && <EventRsvp key={`${selected.id}-${selected.startAt}`} event={selected} memberType={session?.memberType ?? null}
            choice={rsvpByEvent[selected.id] ?? null} onSaved={(choice) => setRsvpByEvent((current) => ({ ...current, [selected.id]: choice }))} />}
        </div>}
      </section>
      <section aria-label="최근 공지" className={`${styles.card} ${styles.notices}`}>
        <div className={styles.sectionHeader}><h2>공지</h2><Link href="/notices">전체 보기 <span aria-hidden="true">→</span></Link></div>
        {noticeError && <Feedback tone="error">{noticeError} <Button variant="secondary" type="button" onClick={() => { setNoticeError(""); setNoticesLoaded(false); setNoticeRetry(noticeRetry + 1); }}>다시 시도</Button></Feedback>}
        {!noticeError && !noticesLoaded && <p role="status">공지를 불러오는 중입니다.</p>}
        {!noticeError && noticesLoaded && notices.length === 0 && <p>게시된 공지가 없습니다.</p>}
        {!noticeError && notices.map((notice) => <Link key={notice.id} href="/notices" className={styles.noticeItem}>{notice.title}<span aria-hidden="true">→</span></Link>)}
      </section>
      </div>
      <section aria-label="내 출석 요약" className={`${styles.card} ${styles.attendance}`}>
        <div className={styles.sectionHeader}><h2>내 출석</h2><Link href="/attendance">전체 보기 <span aria-hidden="true">→</span></Link></div>
        {attendanceError && <Feedback tone="error">{attendanceError}</Feedback>}
        {!attendanceError && attendance.length === 0 && <p className={styles.empty}>출석 기록이 없습니다.</p>}
        {!attendanceError && attendance.slice(0, 3).map((item) => <Link key={item.eventId} href={`/events/${item.eventId}`} className={styles.attendanceRow}>
          <span>{item.eventTitle}</span><strong>{attendanceLabel[item.status]}</strong>
        </Link>)}
      </section>
    </div>
  </main>;
}
