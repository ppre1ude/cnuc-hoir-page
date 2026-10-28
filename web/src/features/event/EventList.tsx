"use client";

import { Button, Feedback, PageHeader, SkeletonRows, StatusBadge } from "../../components/ui";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "../auth/SessionProvider";
import { addMonths, type ChoirEvent, type EventRsvpChoice, getEvents, getMyEventRsvps, kindShortLabel, monthBounds, rsvpChip,
  scheduleKinds, type ScheduleKind, seoulDateKey, seoulTime } from "./events";
import calendarStyles from "./EventCalendar.module.css";
import styles from "./EventList.module.css";

// 배지 색은 대시보드 아이콘과 같은 종류 색입니다. 중요 행사는 공연 색을 씁니다.
const kindColor: Record<ScheduleKind, string> = {
  REGULAR_REHEARSAL: "regular", EXTRA_REHEARSAL: "extra", PART_REHEARSAL: "part", EVENT: "concert",
};
const weekday = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" });

// 응답을 못 받으면 choices가 null이고, 그때는 칩 없이 일정만 보여 줍니다.
type Loaded = { events: ChoirEvent[]; choices: Record<number, EventRsvpChoice | null> | null };

function load(from: string, to: string): Promise<Loaded> {
  const choices = getMyEventRsvps(from, to)
    .then((items) => Object.fromEntries(items.map((item) => [item.eventId, item.choice])), () => null);
  return Promise.all([getEvents(from, to), choices]).then(([events, loaded]) => ({ events, choices: loaded }));
}

// 서울 날짜 기준으로 달마다 묶습니다. 넘겨받은 순서를 그대로 지킵니다.
function byMonth(events: ChoirEvent[]): [string, ChoirEvent[]][] {
  const groups = new Map<string, ChoirEvent[]>();
  for (const event of events) {
    const month = seoulDateKey(event.startAt).slice(0, 7);
    groups.set(month, [...groups.get(month) ?? [], event]);
  }
  return [...groups];
}

// 여러 날에 걸친 일정(MT 등)은 끝나는 날짜를 붙입니다. 자정에 끝나는 일정은 하루짜리로 봅니다.
function timeRange(event: ChoirEvent) {
  const start = seoulDateKey(event.startAt);
  const end = seoulDateKey(new Date(new Date(event.endAt).getTime() - 1));
  const endDay = end === start ? "" : `${Number(end.slice(5, 7))}월 ${Number(end.slice(8))}일 `;
  return `${seoulTime(event.startAt)}~${endDay}${seoulTime(event.endAt)}`;
}

export function EventList() {
  const session = useSession();
  // 화면을 연 순간의 오늘을 기준으로 삼습니다. 자정을 넘겨도 다시 열기 전까지는 같은 범위를 보여 줍니다.
  const [today] = useState(() => {
    const key = seoulDateKey(new Date());
    return { key, month: key.slice(0, 7), start: new Date(`${key}T00:00:00+09:00`).toISOString() };
  });
  const [upcoming, setUpcoming] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [past, setPast] = useState<Loaded | null>(null);
  const [pastBusy, setPastBusy] = useState(false);
  const [pastError, setPastError] = useState("");
  const pastHeading = useRef<HTMLHeadingElement>(null);

  // 누른 버튼이 사라지므로 키보드 초점을 새로 붙은 지난 일정의 제목으로 옮깁니다.
  useEffect(() => { if (past) pastHeading.current?.focus(); }, [past]);

  useEffect(() => {
    let alive = true;
    load(today.start, monthBounds(addMonths(today.month, 3)).to)
      .then((value) => { if (alive) setUpcoming(value); })
      .catch(() => { if (alive) setError("일정을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [today, retry]);

  function loadPast() {
    setPastBusy(true); setPastError("");
    load(monthBounds(addMonths(today.month, -3)).from, today.start)
      .then(setPast, () => setPastError("지난 일정을 불러오지 못했습니다."))
      .finally(() => setPastBusy(false));
  }

  function monthLabel(month: string) {
    const [year, number] = month.split("-");
    return year === today.month.slice(0, 4) ? `${Number(number)}월` : `${year}년 ${Number(number)}월`;
  }

  function row(event: ChoirEvent, choices: Loaded["choices"]) {
    const chip = rsvpChip(event, session, choices ? choices[event.id] ?? null : undefined);
    return <li key={event.id} className={styles.row}>
      <span className={styles.date}><strong>{Number(seoulDateKey(event.startAt).slice(8))}</strong>
        <span>{weekday.format(new Date(event.startAt))}</span></span>
      <span className={styles.body}>
        <Link href={`/events/${event.id}`} className={styles.title}>
          <span className={`${calendarStyles.kind} ${styles.kindBadge}`} data-kind={kindColor[event.kind]}>{kindShortLabel[event.kind]}</span>{" "}
          {event.title}
        </Link>
        <span className={styles.meta}>
          <time dateTime={event.startAt}>{timeRange(event)}</time>
          {chip && <StatusBadge tone={chip.tone}>{chip.label}</StatusBadge>}
        </span>
      </span>
    </li>;
  }

  const sortedUpcoming = upcoming ? [...upcoming.events].sort((a, b) => a.startAt.localeCompare(b.startAt)) : [];
  const sortedPast = past ? [...past.events].sort((a, b) => b.startAt.localeCompare(a.startAt)) : [];

  return <main id="member-content" tabIndex={-1} className={styles.page}>
    <PageHeader title="다가오는 일정"
      actions={<Link href="/dashboard" className={styles.calendarLink}>달력<span aria-hidden="true"> →</span></Link>} />
    {error && <Feedback tone="error">{error} <Button variant="secondary" onClick={() => {
      setError(""); setUpcoming(null); setRetry((value) => value + 1);
    }}>다시 시도</Button></Feedback>}
    {!upcoming && !error && <SkeletonRows count={5} label="일정을 불러오는 중입니다." />}
    {upcoming && sortedUpcoming.length === 0 && <p className={styles.empty}>다가오는 일정이 없습니다.</p>}
    {byMonth(sortedUpcoming).map(([month, events]) => {
      // 연습 횟수는 정기, 비정기, 파트연습의 합입니다. 이번 달은 오늘부터 남은 것만 들어옵니다.
      const rehearsals = events.filter((event) => event.kind !== "EVENT").length;
      const counts = scheduleKinds.map((kind) => [kind, events.filter((event) => event.kind === kind).length] as const)
        .filter(([, count]) => count > 0);
      return <section key={month} aria-labelledby={`month-${month}`} className={styles.month}>
        <div className={styles.monthHead}>
          <h2 id={`month-${month}`}>{monthLabel(month)}</h2>
          <span className={styles.count}>{month === today.month ? "남은 연습" : "연습"} <strong>{rehearsals}회</strong></span>
          <ul aria-label="종류별 개수" className={styles.counts}>{counts.map(([kind, count]) =>
            <li key={kind} className={`${calendarStyles.kind} ${styles.kindBadge}`} data-kind={kindColor[kind]}>{kindShortLabel[kind]} {count}</li>)}
          </ul>
        </div>
        <ul className={styles.list}>{events.map((event) => row(event, upcoming!.choices))}</ul>
      </section>;
    })}
    {upcoming && !past && <div className={styles.more}>
      {pastError && <Feedback tone="error">{pastError}</Feedback>}
      <Button variant="secondary" disabled={pastBusy} onClick={loadPast}>지난 일정 보기</Button>
    </div>}
    {past && <section aria-labelledby="past-heading" className={styles.past}>
      <h2 id="past-heading" ref={pastHeading} tabIndex={-1}>지난 일정</h2>
      {sortedPast.length === 0 && <p className={styles.empty}>지난 3달 동안 일정이 없습니다.</p>}
      {byMonth(sortedPast).map(([month, events]) => <div key={month} className={styles.month}>
        <h3 className={styles.monthHead}>{monthLabel(month)}</h3>
        <ul className={styles.list}>{events.map((event) => row(event, past.choices))}</ul>
      </div>)}
    </section>}
  </main>;
}
