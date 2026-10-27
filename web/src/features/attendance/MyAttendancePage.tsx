"use client";

import { Button, Feedback, PageHeader, SkeletonRows, StatusBadge } from "../../components/ui";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  return <main id="member-content" tabIndex={-1} className={styles.page}>
    <PageHeader title="내 출석 기록" />
    {error && <Feedback tone="error">{error} <Button variant="secondary" onClick={() => { setError(""); setLoaded(false); setRetry((value) => value + 1); }}>다시 시도</Button></Feedback>}
    {!loaded && !error && <SkeletonRows count={4} label="출석 기록을 불러오는 중입니다." className={styles.list} />}
    {loaded && items.length === 0 && !error && <p className={styles.empty}>출석 기록이 없습니다.</p>}
    {!error && loaded && items.length > 0 && <ul className={styles.list} aria-label="일정별 출석 기록">{items.map((item) => <li key={item.eventId}>
      <Link href={`/events/${item.eventId}`}><time dateTime={item.startAt} className={styles.date}>{attendanceDate(item.startAt)}</time><span className={styles.eventTitle}>{item.eventTitle}</span><StatusBadge tone={attendanceTone(item.status)}>{memberAttendanceLabel(item)}</StatusBadge><span aria-hidden="true" className={styles.arrow}>→</span></Link>
    </li>)}</ul>}
  </main>;
}
