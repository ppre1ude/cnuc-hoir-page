"use client";

import { ActionLink, Button, Feedback, PageHeader, SkeletonRows, StatusBadge } from "../../components/ui";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "../auth/SessionProvider";
import { getNotices, type Notice } from "../notice/notices";
import { type ChoirEvent, type EventRsvpChoice, getEvents, getMyEventRsvps, monthBounds, rsvpChip, seoulDateKey } from "./events";
import { EventDetail } from "./EventDetail";
import { EventKindIcon, eventKind } from "./EventKind";
import { EventRsvp } from "./EventRsvp";
import { attendanceDate, attendanceTone, getEventAttendance, getMyAttendance, memberAttendanceLabel, type AttendanceState } from "../attendance/attendance";
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
  // 끝 시각을 한 시간 단위로 올려 요청 주소를 고정합니다. 같은 달을 1분 안에 다시 열면 기억한 응답을 쓰고, 내다보는 범위는 줄지 않습니다.
  const hour = 3_600_000;
  const to = new Date(Math.ceil((Date.now() + 14 * 86_400_000) / hour) * hour).toISOString();
  return to > bounds.to ? { from: bounds.from, to } : bounds;
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
  const detailRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

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

  // 폰에서는 상세가 목록 아래에 있어 행을 눌러도 바뀐 게 안 보이므로 상세로 내려갑니다.
  function pickEvent(event: ChoirEvent) {
    setSelectedDate(seoulDateKey(event.startAt));
    setSelectedEventId(event.id);
    if (window.matchMedia?.("(max-width: 850px)").matches) detailRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
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
  // 처음 열면 오늘 일정이 골라지는데 목록 아래쪽이면 넘김 상자 밖에 숨으므로 가운데로 넘깁니다. 폰에서는 목록이 넘기지 않아 그대로 둡니다.
  // scrollIntoView는 화면 전체까지 움직이므로 목록 상자만 직접 넘깁니다.
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>("[aria-pressed='true']");
    if (list && row && list.scrollHeight > list.clientHeight) list.scrollTop = row.offsetTop - (list.clientHeight - row.offsetHeight) / 2;
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
              {count > 0 && <span className={`${styles.kind} ${styles.dayEvent}`} data-kind={eventKind(eventsOnDay[0])}>{eventsOnDay[0].title}</span>}
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
      <section aria-label="이달의 일정" className={`${styles.card} ${styles.list}`}>
        <div className={styles.sectionHeader}><h2>이달의 일정</h2></div>
        {rsvpError && <Feedback tone="error">{rsvpError} <Button variant="secondary" type="button" onClick={() => {
          setRsvpError(""); setRsvpRetry((value) => value + 1);
        }}>다시 시도</Button></Feedback>}
        {!eventsLoaded && !error && <SkeletonRows count={4} label="이달의 일정을 불러오는 중입니다." />}
        {eventsLoaded && sortedEvents.length === 0 && <p className={styles.empty}>등록된 일정이 없습니다.</p>}
        {sortedEvents.length > 0 && <ul className={styles.eventList} ref={listRef}>
          {sortedEvents.map((event) => {
            const chip = rsvpChip(event, session, rsvpLoadedMonth === month ? rsvpByEvent[event.id] ?? null : undefined);
            // 어제까지 끝난 일정만 흐리게 둡니다. 오늘 일정은 가장 먼저 찾아야 하므로 그대로 둡니다.
            const past = seoulDateKey(new Date(new Date(event.endAt).getTime() - 1)) < today;
            return <li key={event.id} className={`${styles.eventRow} ${selected?.id === event.id ? styles.activeEvent : ""} ${past ? styles.pastEvent : ""}`}>
              <Button variant="unstyled" type="button" className={styles.eventSelect} aria-pressed={selected?.id === event.id} onClick={() => pickEvent(event)}>
                <EventKindIcon event={event} />
                {/* 버튼 이름이 "날짜 제목 상태"로 띄어 읽히도록 사이에 공백을 둡니다. 플렉스 안이라 보이지는 않습니다. */}
                <span className={styles.eventText}>
                  <time dateTime={event.startAt} className={styles.eventDate}>{attendanceDate(event.startAt)}</time>{" "}
                  <span className={styles.eventTitle}>{event.title}</span>
                </span>{" "}
                {chip && <StatusBadge tone={chip.tone}>{chip.label}</StatusBadge>}
              </Button>
            </li>;
          })}
        </ul>}
      </section>
      <section aria-label="선택한 일정" className={`${styles.card} ${styles.detail}`} ref={detailRef}>
        {selected ? <>
          <EventDetail event={selected} memberType={session.memberType} part={session.part}
            checkInOpen={selectedAttendance?.eventId === selected.id && selectedAttendance.checkInOpen} link />
          {rsvpLoadedMonth === month && <EventRsvp key={`${selected.id}-${selected.startAt}`} event={selected} memberType={session.memberType}
            part={session.part} choice={rsvpByEvent[selected.id] ?? null}
            onSaved={(choice) => setRsvpByEvent((current) => ({ ...current, [selected.id]: choice }))} />}
        </> : eventsLoaded ? <p className={styles.empty}>일정을 고르면 여기에 자세한 내용이 보입니다.</p>
          : !error && <SkeletonRows count={3} label="선택한 일정을 불러오는 중입니다." />}
      </section>
      <section aria-label="최근 공지" className={`${styles.card} ${styles.notices}`}>
        <div className={styles.sectionHeader}><h2>공지</h2><Link href="/notices">전체 보기 <span aria-hidden="true">→</span></Link></div>
        {noticeError && <Feedback tone="error">{noticeError} <Button variant="secondary" type="button" onClick={() => { setNoticeError(""); setNoticesLoaded(false); setNoticeRetry(noticeRetry + 1); }}>다시 시도</Button></Feedback>}
        {!noticeError && !noticesLoaded && <SkeletonRows count={3} label="공지를 불러오는 중입니다." />}
        {!noticeError && noticesLoaded && notices.length === 0 && <p>게시된 공지가 없습니다.</p>}
        {!noticeError && notices.map((notice) => <Link key={notice.id} href={`/notices?notice=${notice.id}`} className={styles.noticeItem}><span>{notice.title}</span><span aria-hidden="true">→</span></Link>)}
      </section>
      <section aria-label="내 출석 요약" className={`${styles.card} ${styles.attendance}`}>
        <div className={styles.sectionHeader}><h2>내 출석</h2><Link href="/attendance">전체 보기 <span aria-hidden="true">→</span></Link></div>
        {attendanceError && <Feedback tone="error">{attendanceError} <Button variant="secondary" onClick={() => { setAttendanceError(""); setAttendanceLoaded(false); setAttendanceRetry((value) => value + 1); }}>다시 시도</Button></Feedback>}
        {!attendanceError && !attendanceLoaded && <SkeletonRows count={3} label="출석 기록을 불러오는 중입니다." />}
        {!attendanceError && attendanceLoaded && attendance.length === 0 && <p className={styles.empty}>출석 기록이 없습니다.</p>}
        {!attendanceError && attendanceLoaded && attendance.slice(0, 3).map((item) => <Link key={item.eventId} href={`/events/${item.eventId}`} className={styles.attendanceRow}>
          <span><time dateTime={item.startAt} className={styles.eventDate}>{attendanceDate(item.startAt)}</time> {item.eventTitle}</span><StatusBadge tone={attendanceTone(item.status)}>{memberAttendanceLabel(item)}</StatusBadge>
        </Link>)}
      </section>
    </div>
  </main>;
}
