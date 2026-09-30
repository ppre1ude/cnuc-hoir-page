"use client";

import { Feedback, PageHeader, StatusBadge } from "../../components/ui";

import { useEffect, useState } from "react";
import Link from "next/link";
import { attendanceLabel, getMyAttendance, type AttendanceState } from "./attendance";
import styles from "./MyAttendancePage.module.css";

export function MyAttendancePage() {
  const [items, setItems] = useState<AttendanceState[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    getMyAttendance().then((value) => { if (alive) setItems(value); })
      .catch(() => { if (alive) setError("출석 기록을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, []);
  return <main className={styles.page}>
    <PageHeader title="내 출석 기록" />
    {error && <Feedback tone="error">{error}</Feedback>}
    {items.length === 0 && !error && <p className={styles.empty}>출석 기록이 없습니다.</p>}
    <ul className={styles.list}>{items.map((item) => <li key={item.eventId}>
      <Link href={`/events/${item.eventId}`}>{item.eventTitle}<StatusBadge tone={item.status === "CHECKED_IN" ? "positive" : item.status === "MISSED" ? "negative" : "neutral"}>{attendanceLabel[item.status]}</StatusBadge></Link>
    </li>)}</ul>
  </main>;
}
