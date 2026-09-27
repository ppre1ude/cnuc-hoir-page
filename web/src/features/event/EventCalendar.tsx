"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "../../lib/api";
import { getSession, type MemberSession } from "../auth/session";
import { getNotices, type Notice } from "../notice/notices";
import { type ChoirEvent, getEvents, monthBounds, seoulDateKey } from "./events";
import { EventDetail } from "./EventDetail";
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

  function changeMonth(offset: number) {
    const next = moveMonth(month, offset);
    setMonth(next);
    setSelectedDate(`${next}-01`);
    setSelectedEventId(null);
    setLoadedMonth("");
    setError("");
  }

  const monthEvents = loadedMonth === month && !error ? events : [];
  const dayEvents = monthEvents.filter((event) => {
    const first = seoulDateKey(event.startAt);
    const last = seoulDateKey(new Date(new Date(event.endAt).getTime() - 1));
    return first <= selectedDate && selectedDate <= last;
  });
  const selected = dayEvents.find((event) => event.id === selectedEventId) ?? dayEvents[0];
  const slots = Array.from({ length: mondayOffset(month) }, (_, index) => `blank-${index}`);
  const days = Array.from({ length: daysInMonth(month) }, (_, index) => index + 1);

  return <div className={styles.dashboard}>
    <header className={styles.hero}>
      <p className={styles.eyebrow}>전남대학교 합창단 · 회원 공간</p>
      <h1>{session ? `${session.name}님, 이번 달 일정을 확인하세요` : "이번 달 일정"}</h1>
      <p>날짜를 선택하면 행사와 참여 대상을 확인할 수 있습니다.</p>
      <nav aria-label="회원 메뉴" className={styles.links}>
        <Link href="/notices">공지 전체 보기</Link>
        {session?.admin && <Link href="/admin/events">행사 관리</Link>}
      </nav>
    </header>
    {error && <div role="alert" className={styles.error}>{error} <button type="button" onClick={() => setRetry(retry + 1)}>다시 시도</button></div>}
    <div className={styles.grid}>
      <section aria-label="행사 달력" className={`${styles.card} ${styles.calendar}`}>
        <div className={styles.calendarHeader}>
          <div><p className={styles.eyebrow}>행사 달력</p><h2>{month.replace("-", "년 ")}월</h2></div>
          <div className={styles.monthControls}>
            <button type="button" onClick={() => changeMonth(-1)} aria-label="이전 달">‹</button>
            <button type="button" onClick={() => changeMonth(1)} aria-label="다음 달">›</button>
          </div>
        </div>
        <div className={styles.weekdays}>{["월", "화", "수", "목", "금", "토", "일"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className={styles.days}>
          {slots.map((slot) => <span key={slot} aria-hidden="true" />)}
          {days.map((day) => {
            const key = `${month}-${String(day).padStart(2, "0")}`;
            const count = monthEvents.filter((event) => {
              const first = seoulDateKey(event.startAt);
              const last = seoulDateKey(new Date(new Date(event.endAt).getTime() - 1));
              return first <= key && key <= last;
            }).length;
            return <button type="button" key={key} className={`${styles.day} ${key === selectedDate ? styles.selectedDay : ""}`}
              onClick={() => { setSelectedDate(key); setSelectedEventId(null); }} aria-pressed={key === selectedDate}
              aria-label={`${day}일${count ? `, 행사 ${count}개` : ""}`}>
              <span>{day}</span>{count > 0 && <i aria-hidden="true" />}
            </button>;
          })}
        </div>
        <div className={styles.dayList}>
          <h3>{Number(selectedDate.slice(-2))}일 행사</h3>
          {dayEvents.length === 0 && <p>선택한 날짜에 행사가 없습니다.</p>}
          {dayEvents.map((event) => <button key={event.id} type="button" className={styles.eventButton}
            aria-pressed={selected?.id === event.id} onClick={() => setSelectedEventId(event.id)}>{event.title}</button>)}
        </div>
      </section>
      <section aria-label="선택한 행사" className={`${styles.card} ${styles.detail}`}>
        {selected ? <EventDetail event={selected} memberType={session?.memberType ?? null} link />
          : <><p className={styles.eyebrow}>선택한 행사</p><h2>날짜를 선택해 주세요</h2><p>선택한 날짜의 행사가 이곳에 표시됩니다.</p></>}
      </section>
      <section aria-label="최근 공지" className={`${styles.card} ${styles.notices}`}>
        <div className={styles.sectionHeader}><div><p className={styles.eyebrow}>최근 공지</p><h2>알려드립니다</h2></div><Link href="/notices">전체 보기</Link></div>
        {noticeError && <p role="alert">{noticeError} <button type="button" onClick={() => { setNoticeError(""); setNoticesLoaded(false); setNoticeRetry(noticeRetry + 1); }}>다시 시도</button></p>}
        {!noticeError && !noticesLoaded && <p role="status">공지를 불러오는 중입니다.</p>}
        {!noticeError && noticesLoaded && notices.length === 0 && <p>게시된 공지가 없습니다.</p>}
        {!noticeError && notices.map((notice) => <p key={notice.id} className={styles.noticeItem}>{notice.title}</p>)}
      </section>
      <section aria-label="내 출석 요약" className={`${styles.card} ${styles.attendance}`}>
        <p className={styles.eyebrow}>내 출석 요약</p><h2>출석 기록</h2>
        <p>출석 상태는 행사별 출석 기능이 연결되면 이곳에 표시됩니다.</p>
      </section>
    </div>
  </div>;
}
