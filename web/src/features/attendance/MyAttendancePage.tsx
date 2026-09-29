"use client";

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
    <h1>내 출석 기록</h1>
    {error && <p role="alert">{error}</p>}
    {items.length === 0 && !error && <p className={styles.empty}>출석 기록이 없습니다.</p>}
    <ul className={styles.list}>{items.map((item) => <li key={item.eventId}>
      <Link href={`/events/${item.eventId}`}>{item.eventTitle}<span>{attendanceLabel[item.status]}</span></Link>
    </li>)}</ul>
  </main>;
}
