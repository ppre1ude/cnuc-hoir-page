"use client";

import { Button, Feedback, List, PageHeader, Row, RowLink, SkeletonRows, StatusBadge } from "../../components/ui";
import ui from "../../components/ui/ui.module.css";

import { useEffect, useState } from "react";
import { attendanceDate, attendanceTone, getMyAttendance, memberAttendanceLabel, type AttendanceState } from "./attendance";
import styles from "./MyAttendancePage.module.css";

export function MyAttendancePage() {
  const [items, setItems] = useState<AttendanceState[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    getMyAttendance().then((value) => { if (alive) { setItems(value); setLoaded(true); } })
      .catch(() => { if (alive) setError("출석 기록을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [retry]);
  return <main id="member-content" tabIndex={-1} className={ui.readingPage}>
    <PageHeader title="내 출석 기록" />
    {error && <Feedback tone="error">{error} <Button variant="secondary" onClick={() => { setError(""); setLoaded(false); setRetry((value) => value + 1); }}>다시 시도</Button></Feedback>}
    {!loaded && !error && <List><SkeletonRows count={4} label="출석 기록을 불러오는 중입니다." /></List>}
    {loaded && items.length === 0 && !error && <List><Row><p className={ui.muted}>출석 기록이 없습니다.</p></Row></List>}
    {!error && loaded && items.length > 0 && <List as="ul" aria-label="일정별 출석 기록">{items.map((item) => <li key={item.eventId}>
      <RowLink href={`/events/${item.eventId}`}>
        <span className={styles.main}><time dateTime={item.startAt} className={styles.date}>{attendanceDate(item.startAt)}</time><span className={styles.eventTitle}>{item.eventTitle}</span></span>
        <span className={styles.meta}><StatusBadge tone={attendanceTone(item.status)}>{memberAttendanceLabel(item)}</StatusBadge><span aria-hidden="true" className={styles.arrow}>→</span></span>
      </RowLink>
    </li>)}</List>}
  </main>;
}
