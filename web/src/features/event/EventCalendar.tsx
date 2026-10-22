"use client";

import { ActionLink, Button, Feedback, PageHeader, SkeletonRows, StatusBadge } from "../../components/ui";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "../auth/SessionProvider";
import { getNotices, type Notice } from "../notice/notices";
import { type ChoirEvent, type EventRsvpChoice, getEvents, getMyEventRsvps, monthBounds, seoulDateKey } from "./events";
import { EventDetail } from "./EventDetail";
import { EventRsvp } from "./EventRsvp";
import { attendanceDate, getEventAttendance, getMyAttendance, memberAttendanceLabel, type AttendanceState } from "../attendance/attendance";
import { memberLinks } from "../member/memberLinks";
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

// 월말에도 다음 주 연습에 바로 응답할 수 있게 이번 달은 오늘부터 14일 뒤까지 함께 받습니다.
function eventRange(month: string) {
  const bounds = monthBounds(month);
  if (month !== seoulDateKey(new Date()).slice(0, 7)) return bounds;
  const soon = new Date(Date.now() + 14 * 86_400_000).toISOString();
  return soon > bounds.to ? { from: bounds.from, to: soon } : bounds;
}

export function EventCalendar() {
  const session = useSession();
  const [month, setMonth] = useState(() => seoulDateKey(new Date()).slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(() => seoulDateKey(new Date()));
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [events, setEvents] = useState<ChoirEvent[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [attendance, setAttendance] = useState<AttendanceState[]>([]);
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceState | null>(null);
  const [attendanceError, setAttendanceError] = useState("");
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);
  const [attendanceRetry, setAttendanceRetry] = useState(0);
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
    const { from, to } = eventRange(month);
    getEvents(from, to).then((monthEvents) => {
      if (!alive) return;
      setEvents(monthEvents);
      setLoadedMonth(month);
      setError("");
    }).catch(() => { if (alive) setError("일정을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [month, retry]);

  useEffect(() => {
    let alive = true;
    const { from, to } = eventRange(month);
    getMyEventRsvps(from, to).then((items) => {
      if (!alive) return;
      setRsvpByEvent(Object.fromEntries(items.filter((item) => item.choice !== null)
        .map((item) => [item.eventId, item.choice as EventRsvpChoice])));
      setRsvpLoadedMonth(month); setRsvpError("");
    }).catch(() => { if (alive) { setRsvpLoadedMonth(""); setRsvpError("참석 응답을 불러오지 못했습니다."); } });
    return () => { alive = false; };
  }, [month, rsvpRetry]);

  useEffect(() => {
    let alive = true;
    getNotices(0).then((recent) => {
      if (!alive) return;
      setNotices(recent.items.slice(0, 3));
      setNoticesLoaded(true);
      setNoticeError("");
    }).catch(() => {
      if (!alive) return;
      setNotices([]);
      setNoticeError("공지를 불러오지 못했습니다.");
    });
    return () => { alive = false; };
  }, [noticeRetry]);

  useEffect(() => {
    let alive = true;
    getMyAttendance().then((value) => { if (alive) { setAttendance(value); setAttendanceLoaded(true); setAttendanceError(""); } })
      .catch(() => { if (alive) setAttendanceError("출석 기록을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [attendanceRetry]);

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
    if (selectedId == null) return;
    let alive = true;
    const refresh = () => getEventAttendance(selectedId)
      .then((value) => { if (alive) setSelectedAttendance(value); })
      .catch(() => { if (alive) setSelectedAttendance(null); });
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [selectedId]);
  const offset = mondayOffset(month);
  const weeks = Array.from({ length: Math.ceil((offset + daysInMonth(month)) / 7) }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const day = week * 7 + weekday - offset + 1;
      return day > 0 && day <= daysInMonth(month) ? day : null;
    }));
  const today = seoulDateKey(new Date());
  const eventsLoaded = loadedMonth === month && !error;

  return <main id="member-content" tabIndex={-1} className={styles.dashboard}>
    <PageHeader title="일정" className={styles.hero} actions={memberLinks.map((link) => <ActionLink key={link.href} variant="secondary"
      href={link.href} target="_blank" rel="noopener noreferrer">{link.label} <span aria-hidden="true">↗</span></ActionLink>)} />
    {error && <div role="alert" className={styles.error}>{error} <Button variant="secondary" type="button" onClick={() => setRetry(retry + 1)}>다시 시도</Button></div>}
    <div className={styles.grid}>
      <section aria-label="일정 달력"className={`${styles.card} ${styles.calendar}`}>
        <div className={styles.calendarHeader}>
          <h2 id="calendar-month" aria-live="polite" aria-atomic="true">{month.replace("-", "년 ")}월</h2>
          <div className={styles.monthControls}>
            <Button variant="secondary" type="button" onClick={() => changeMonth(-1)} aria-label="이전 달">←</Button>
            <Button variant="secondary" type="button" onClick={() => changeMonth(1)} aria-label="다음 달">→</Button>
          </div>
        </div>
        <table className={styles.calendarTable} aria-labelledby="calendar-month">
          <thead><tr>{["월", "화", "수", "목", "금", "토", "일"].map((day) => <th key={day} scope="col"><abbr title={`${day}요일`}>{day}</abbr></th>)}</tr></thead>
          <tbody>{weeks.map((week, index) => <tr key={index}>{week.map((day, weekday) => {
            if (day === null) return <td key={`blank-${weekday}`} />;
            const key = `${month}-${String(day).padStart(2, "0")}`;
            const eventsOnDay = monthEvents.filter((event) => {
              const first = seoulDateKey(event.startAt);
              const last = seoulDateKey(new Date(new Date(event.endAt).getTime() - 1));
              return first <= key && key <= last;
            });
            const count = eventsOnDay.length;
            return <td key={key}><Button variant="unstyled" type="button" className={`${styles.day} ${key === selectedDate ? styles.selectedDay : ""}`}
              onClick={() => { setSelectedDate(key); setSelectedEventId(null); }} aria-pressed={key === selectedDate}
              aria-current={key === today ? "date" : undefined}
              aria-label={`${month.replace("-", "년 ")}월 ${day}일${count ? `, 일정 ${count}개` : ""}`}>
              <span className={styles.dayNumber}>{day}</span>
              {count > 0 && <span className={styles.dayEvent}>{eventsOnDay[0].title}</span>}
              {count > 1 && <span className={styles.moreEvents}>+{count - 1}</span>}
              {count > 0 && <i aria-hidden="true" />}
            </Button></td>;
          })}</tr>)}</tbody>
        </table>
        <div className={styles.dayList}>
          <h3>{Number(selectedDate.slice(-2))}일 일정</h3>
          {!eventsLoaded && !error && <SkeletonRows count={1} label="일정을 불러오는 중입니다." className={styles.skeletonDayList} />}
          {eventsLoaded && dayEvents.length === 0 && <p>일정 없음</p>}
          {dayEvents.map((event) => <Button variant="unstyled" key={event.id} type="button" className={styles.eventButton}
            aria-pressed={selected?.id === event.id} onClick={() => setSelectedEventId(event.id)}>{event.title}</Button>)}
        </div>
      </section>
      <div className={styles.rightColumn}>
      <section aria-label="선택한 일정" className={`${styles.card} ${styles.detail}`}>
        <div className={styles.sectionHeader}><h2>이달의 일정</h2></div>
        {rsvpError && <Feedback tone="error">{rsvpError} <Button variant="secondary" type="button" onClick={() => {
          setRsvpError(""); setRsvpRetry((value) => value + 1);
        }}>다시 시도</Button></Feedback>}
        {eventsLoaded && sortedEvents.length === 0 && <p className={styles.empty}>등록된 일정이 없습니다.</p>}
        {sortedEvents.length > 0 && <ul className={styles.eventList}>
          {sortedEvents.map((event) => {
            const date = seoulDateKey(event.startAt);
            return <li key={event.id} className={`${styles.eventRow} ${selected?.id === event.id ? styles.activeEvent : ""}`}>
              <Button variant="unstyled" type="button" className={styles.eventSelect} aria-pressed={selected?.id === event.id}
                onClick={() => { setSelectedDate(date); setSelectedEventId(event.id); }}>
                <time dateTime={event.startAt} className={styles.eventDate}>{date.slice(5).replace("-", ".")}</time>
                <span className={styles.eventTitle}>{event.title}</span>
              </Button>
              {rsvpLoadedMonth === month && <EventRsvp key={`${event.id}-${event.startAt}`} compact event={event}
                memberType={session.memberType} choice={rsvpByEvent[event.id] ?? null}
                onSaved={(choice) => setRsvpByEvent((current) => ({ ...current, [event.id]: choice }))} />}
            </li>;
          })}
        </ul>}
        {selected && <div className={styles.selectedEvent}><EventDetail event={selected} memberType={session.memberType}
          checkInOpen={selectedAttendance?.eventId === selected.id && selectedAttendance.checkInOpen} link />
        </div>}
      </section>
      <section aria-label="최근 공지" className={`${styles.card} ${styles.notices}`}>
        <div className={styles.sectionHeader}><h2>공지</h2><Link href="/notices">전체 보기 <span aria-hidden="true">→</span></Link></div>
        {noticeError && <Feedback tone="error">{noticeError} <Button variant="secondary" type="button" onClick={() => { setNoticeError(""); setNoticesLoaded(false); setNoticeRetry(noticeRetry + 1); }}>다시 시도</Button></Feedback>}
        {!noticeError && !noticesLoaded && <SkeletonRows count={3} label="공지를 불러오는 중입니다." />}
        {!noticeError && noticesLoaded && notices.length === 0 && <p>게시된 공지가 없습니다.</p>}
        {!noticeError && notices.map((notice) => <Link key={notice.id} href={`/notices?notice=${notice.id}`} className={styles.noticeItem}><span>{notice.title}</span><span aria-hidden="true">→</span></Link>)}
      </section>
      </div>
      <section aria-label="내 출석 요약" className={`${styles.card} ${styles.attendance}`}>
        <div className={styles.sectionHeader}><h2>내 출석</h2><Link href="/attendance">전체 보기 <span aria-hidden="true">→</span></Link></div>
        {attendanceError && <Feedback tone="error">{attendanceError} <Button variant="secondary" onClick={() => { setAttendanceError(""); setAttendanceLoaded(false); setAttendanceRetry((value) => value + 1); }}>다시 시도</Button></Feedback>}
        {!attendanceError && !attendanceLoaded && <SkeletonRows count={3} label="출석 기록을 불러오는 중입니다." />}
        {!attendanceError && attendanceLoaded && attendance.length === 0 && <p className={styles.empty}>출석 기록이 없습니다.</p>}
        {!attendanceError && attendanceLoaded && attendance.slice(0, 3).map((item) => <Link key={item.eventId} href={`/events/${item.eventId}`} className={styles.attendanceRow}>
          <span><time dateTime={item.startAt} className={styles.eventDate}>{attendanceDate(item.startAt)}</time> {item.eventTitle}</span><StatusBadge tone={item.status === "CHECKED_IN" ? "positive" : item.status === "MISSED" ? "negative" : "neutral"}>{memberAttendanceLabel(item)}</StatusBadge>
        </Link>)}
      </section>
    </div>
  </main>;
}
