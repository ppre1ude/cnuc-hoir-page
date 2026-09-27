"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { attendanceLabel, getMyAttendance, type AttendanceState } from "./attendance";

export function MyAttendancePage() {
  const [items, setItems] = useState<AttendanceState[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    getMyAttendance().then((value) => { if (alive) setItems(value); })
      .catch(() => { if (alive) setError("출석 기록을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, []);
  return <main style={{ maxWidth: 900, margin: "auto", padding: 24 }}>
    <p><Link href="/dashboard">← 달력으로 돌아가기</Link></p>
    <h1>내 출석 기록</h1>
    {error && <p role="alert">{error}</p>}
    {items.length === 0 && !error && <p>표시할 행사가 없습니다.</p>}
    <ul>{items.map((item) => <li key={item.eventId}>
      <Link href={`/events/${item.eventId}`}>{item.eventTitle}</Link> — {attendanceLabel[item.status]}
    </li>)}</ul>
  </main>;
}
