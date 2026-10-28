"use client";

import { ActionLink, Button, Feedback, PageHeader, SkeletonRows, StatusBadge } from "../../components/ui";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "../auth/SessionProvider";
import { getNotices, type Notice } from "../notice/notices";
import { type ChoirEvent, type EventRsvpChoice, getEvents, getMyEventRsvps, isEventTarget, kindShortLabel, monthBounds,
  type MyEventRsvp, rsvpChip, type ScheduleKind, seoulDateKey, seoulTime } from "./events";
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

// 목록 보기의 종류 배지 색입니다. 중요 행사는 공연 색을 씁니다.
const kindColor: Record<ScheduleKind, string> = {
  REGULAR_REHEARSAL: "regular", EXTRA_REHEARSAL: "extra", PART_REHEARSAL: "part", EVENT: "concert",
};
const weekdayName = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" });

// 여러 날에 걸친 일정(MT 등)은 끝나는 날짜를 붙입니다. 자정에 끝나는 일정은 하루짜리로 봅니다.
function timeRange(event: ChoirEvent) {
  const start = seoulDateKey(event.startAt);
  const end = seoulDateKey(new Date(new Date(event.endAt).getTime() - 1));
  const endDay = end === start ? "" : `${Number(end.slice(5, 7))}월 ${Number(end.slice(8))}일 `;
  return `${seoulTime(event.startAt)}~${endDay}${seoulTime(event.endAt)}`;
}

const byStart = (first: ChoirEvent, second: ChoirEvent) => first.startAt.localeCompare(second.startAt);

// 그달 응답과 다가오는 일정 응답을 한 장부에 모읍니다. 아직 응답하지 않은 일정은 넣지 않습니다.
function choicesOf(items: MyEventRsvp[]): Record<number, EventRsvpChoice> {
  return Object.fromEntries(items.filter((item) => item.choice !== null).map((item) => [item.eventId, item.choice as EventRsvpChoice]));
}

// 보기 전환 아이콘은 lucide의 calendar-days와 list 모양을 그대로 옮겼습니다.
const views = [
  { value: "calendar", label: "달력 보기", icon: <><path d="M8 2v4M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" /></> },
  { value: "list", label: "목록 보기", icon: <path d="M3 6h.01M3 12h.01M3 18h.01M8 6h13M8 12h13M8 18h13" /> },
] as const;

// 다가오는 내 일정은 달력과 따로 오늘 0시부터 14일 뒤까지 받습니다. 월말에도 다음 주 연습에 바로 응답할 수 있습니다.
function upcomingRange() {
  // 끝 시각을 한 시간 단위로 올려 요청 주소를 고정합니다. 1분 안에 다시 열면 기억한 응답을 쓰고, 내다보는 범위는 줄지 않습니다.
  const hour = 3_600_000;
  return {
    from: new Date(`${seoulDateKey(new Date())}T00:00:00+09:00`).toISOString(),
    to: new Date(Math.ceil((Date.now() + 14 * 86_400_000) / hour) * hour).toISOString(),
  };
}

export function EventCalendar() {
  const session = useSession();
  const [month, setMonth] = useState(() => seoulDateKey(new Date()).slice(0, 7));
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [selectedDate, setSelectedDate] = useState(() => seoulDateKey(new Date()));
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [events, setEvents] = useState<ChoirEvent[]>([]);
  const [upcoming, setUpcoming] = useState<ChoirEvent[] | null>(null);
  const [upcomingError, setUpcomingError] = useState("");
  const [upcomingRetry, setUpcomingRetry] = useState(0);
  const [upcomingRsvpLoaded, setUpcomingRsvpLoaded] = useState(false);
  // 그달 응답과 따로 둡니다. 한 상태를 같이 쓰면 그달 응답이 늦게 성공할 때 이쪽 실패 안내가 지워집니다.
  const [upcomingRsvpError, setUpcomingRsvpError] = useState("");
  // 사람이 날짜나 일정을 한 번이라도 고르면, 늦게 도착한 다가오는 내 일정이 고른 것을 덮지 않게 합니다.
  const picked = useRef(false);
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
    const { from, to } = monthBounds(month);
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
    const { from, to } = monthBounds(month);
    getMyEventRsvps(from, to).then((items) => {
      if (!alive) return;
      setRsvpByEvent((current) => ({ ...current, ...choicesOf(items) }));
      setRsvpLoadedMonth(month); setRsvpError("");
    }).catch(() => { if (alive) { setRsvpLoadedMonth(""); setRsvpError("참석 응답을 불러오지 못했습니다."); } });
    return () => { alive = false; };
  }, [month, rsvpRetry]);

  useEffect(() => {
    let alive = true;
    const { from, to } = upcomingRange();
    getEvents(from, to).then((items) => {
      if (!alive) return;
      setUpcoming(items); setUpcomingError("");
      // 처음 열면 다가오는 첫 일정을 고르고 달력도 그날로 옮깁니다. 오늘 일정이 있으면 오늘이 첫 일정입니다.
      const first = items.filter((event) => isEventTarget(event, session)).sort(byStart)[0];
      if (picked.current || !first) return;
      picked.current = true;
      const date = seoulDateKey(first.startAt);
      setMonth(date.slice(0, 7)); setSelectedDate(date); setSelectedEventId(first.id);
    }).catch(() => { if (alive) setUpcomingError("다가오는 일정을 불러오지 못했습니다."); });
    getMyEventRsvps(from, to).then((items) => {
      if (!alive) return;
      setRsvpByEvent((current) => ({ ...current, ...choicesOf(items) }));
      setUpcomingRsvpLoaded(true); setUpcomingRsvpError("");
    }).catch(() => { if (alive) setUpcomingRsvpError("참석 응답을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [session, upcomingRetry]);

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

  // 달력에서 고른 날과 오른쪽 상세는 늘 같은 날을 가리킵니다. 다른 달 날짜면 달력도 그달로 넘깁니다.
  function showDay(date: string, eventId: number | null) {
    picked.current = true;
    const next = date.slice(0, 7);
    if (next !== month) {
      setMonth(next);
      setLoadedMonth("");
      setRsvpLoadedMonth("");
      setError("");
    }
    setSelectedDate(date);
    setSelectedEventId(eventId);
  }

  // 폰에서는 상세가 목록 아래에 있어 행을 눌러도 바뀐 게 안 보이므로 상세로 내려갑니다.
  function pickEvent(event: ChoirEvent) {
    showDay(seoulDateKey(event.startAt), event.id);
    if (window.matchMedia?.("(max-width: 850px)").matches) detailRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  const monthEvents = loadedMonth === month && !error ? events : [];
  const dayEvents = monthEvents.filter((event) => {
    const first = seoulDateKey(event.startAt);
    const last = seoulDateKey(new Date(new Date(event.endAt).getTime() - 1));
    return first <= selectedDate && selectedDate <= last;
  });
  // 다가오는 내 일정에는 내가 대상인 일정만 둡니다. 운영진이 받아 보는 다른 파트의 파트연습은 달력에만 남습니다.
  const myUpcoming = (upcoming ?? []).filter((event) => isEventTarget(event, session)).sort(byStart);
  // 고른 날에 일정이 없으면 아무것도 고르지 않습니다. 다른 날 일정으로 넘어가지 않습니다.
  const selected = dayEvents.find((event) => event.id === selectedEventId)
    ?? dayEvents.find((event) => isEventTarget(event, session)) ?? dayEvents[0];
  // 빈 날에는 고른 날 뒤의 내 첫 일정을 바로가기로 내밉니다. 저절로 고르지는 않습니다.
  // ponytail: 받아 둔 그달과 다가오는 2주 안에서만 찾습니다. 그 밖의 먼 날짜를 고르면 바로가기가 없습니다.
  const nextEvent = selected ? undefined : [...monthEvents, ...myUpcoming]
    .filter((event) => isEventTarget(event, session) && seoulDateKey(event.startAt) > selectedDate).sort(byStart)[0];
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
    <PageHeader title="홈" className={styles.hero} actions={memberLinks.map((link) => <ActionLink key={link.href} variant="secondary"
      href={link.href} target="_blank" rel="noopener noreferrer">{link.label} <span aria-hidden="true">↗</span></ActionLink>)} />
    {error && <div role="alert" className={styles.error}>{error} <Button variant="secondary" type="button" onClick={() => setRetry(retry + 1)}>다시 시도</Button></div>}
    <div className={styles.grid}>
      <section aria-label="일정 달력"className={`${styles.card} ${styles.calendar}`}>
        <div role="group" aria-label="보기 방식" className={styles.viewToggle}>
          {views.map((option) => <Button key={option.value} variant="unstyled" type="button"
            aria-pressed={view === option.value} onClick={() => setView(option.value)}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true">{option.icon}</svg>
            {option.label}
          </Button>)}
        </div>
        <div className={styles.calendarHeader}>
          <h2 id="calendar-month" aria-live="polite" aria-atomic="true">{month.replace("-", "년 ")}월</h2>
          <div className={styles.monthControls}>
            <Button variant="secondary" type="button" onClick={() => showDay(`${moveMonth(month, -1)}-01`, null)} aria-label="이전 달">←</Button>
            <Button variant="secondary" type="button" onClick={() => showDay(`${moveMonth(month, 1)}-01`, null)} aria-label="다음 달">→</Button>
          </div>
        </div>
        {view === "list" ? <>
          {!eventsLoaded && !error && <SkeletonRows count={4} label="일정을 불러오는 중입니다." />}
          {eventsLoaded && monthEvents.length === 0 && <p className={styles.empty}>등록된 일정이 없습니다.</p>}
          {/* 다가오는 내 일정과 달리 대상이 아닌 일정과 지난 일정까지 그달 일정을 모두 늘어놓습니다.
              날짜 칸이 일만 적으므로 앞 달에서 이어지는 일정은 앞 달 목록에 둡니다. */}
          {monthEvents.length > 0 && <ul className={styles.monthList} aria-labelledby="calendar-month">
            {monthEvents.filter((event) => seoulDateKey(event.startAt).startsWith(month))
              .sort(byStart).map((event) => {
              const chip = rsvpChip(event, session, rsvpLoadedMonth === month ? rsvpByEvent[event.id] ?? null : undefined);
              const past = seoulDateKey(new Date(new Date(event.endAt).getTime() - 1)) < today;
              return <li key={event.id} className={`${selected?.id === event.id ? styles.activeEvent : ""} ${past ? styles.pastEvent : ""}`}>
                <Button variant="unstyled" type="button" className={styles.monthRow} aria-pressed={selected?.id === event.id} onClick={() => pickEvent(event)}>
                  <span className={styles.rowDate}><strong>{Number(seoulDateKey(event.startAt).slice(8))}</strong>{" "}
                    <span>{weekdayName.format(new Date(event.startAt))}</span></span>{" "}
                  <span className={styles.rowBody}>
                    <span className={styles.rowTitle}>
                      <span className={`${styles.kind} ${styles.kindBadge}`} data-kind={kindColor[event.kind]}>{kindShortLabel[event.kind]}</span>{" "}
                      {event.title}
                    </span>{" "}
                    <span className={styles.rowMeta}>
                      <time dateTime={event.startAt}>{timeRange(event)}</time>{" "}
                      {chip && <StatusBadge tone={chip.tone}>{chip.label}</StatusBadge>}
                    </span>
                  </span>
                </Button>
              </li>;
            })}
          </ul>}
        </> : <>
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
              onClick={() => showDay(key, null)} aria-pressed={key === selectedDate}
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
            aria-pressed={selected?.id === event.id} onClick={() => showDay(selectedDate, event.id)}>{event.title}</Button>)}
        </div>
        </>}
      </section>
      {/* 달력이 어느 달을 보든, 오늘부터 2주 안에 내가 가야 하고 응답할 일정을 모아 둡니다. */}
      <section aria-label="다가오는 내 일정" className={`${styles.card} ${styles.list}`}>
        <div className={styles.sectionHeader}><h2>다가오는 내 일정</h2></div>
        {(rsvpError || upcomingRsvpError) && <Feedback tone="error">{rsvpError || upcomingRsvpError} <Button variant="secondary" type="button" onClick={() => {
          if (rsvpError) { setRsvpError(""); setRsvpRetry((value) => value + 1); }
          if (upcomingRsvpError) { setUpcomingRsvpError(""); setUpcomingRetry((value) => value + 1); }
        }}>다시 시도</Button></Feedback>}
        {upcomingError && <Feedback tone="error">{upcomingError} <Button variant="secondary" type="button" onClick={() => {
          setUpcomingError(""); setUpcomingRetry((value) => value + 1);
        }}>다시 시도</Button></Feedback>}
        {!upcoming && !upcomingError && <SkeletonRows count={4} label="다가오는 일정을 불러오는 중입니다." />}
        {upcoming && myUpcoming.length === 0 && <p className={styles.empty}>앞으로 2주 동안 내 일정이 없습니다.</p>}
        {myUpcoming.length > 0 && <ul className={styles.eventList} ref={listRef}>
          {myUpcoming.map((event) => {
            const chip = rsvpChip(event, session, upcomingRsvpLoaded ? rsvpByEvent[event.id] ?? null : undefined);
            return <li key={event.id} className={`${styles.eventRow} ${selected?.id === event.id ? styles.activeEvent : ""}`}>
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
        </> : eventsLoaded ? <div className={styles.emptyDay}>
          {/* 쉬는 용입니다. 뜻은 문장이 전하므로 보조 기술에는 숨깁니다. */}
          <Image src="/images/dragon-rest.png" width={112} height={112} alt="" />
          <p>{Number(selectedDate.slice(5, 7))}월 {Number(selectedDate.slice(8))}일에는 일정이 없습니다.</p>
          {nextEvent && <Button variant="secondary" type="button" onClick={() => pickEvent(nextEvent)}>
            다음 일정: {Number(seoulDateKey(nextEvent.startAt).slice(5, 7))}월 {Number(seoulDateKey(nextEvent.startAt).slice(8))}일
            ({weekdayName.format(new Date(nextEvent.startAt))}) {nextEvent.title}<span aria-hidden="true"> →</span>
          </Button>}
        </div>
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
