"use client";

import { useParams } from "next/navigation";
import { AdminAttendancePanel } from "../../../../../../features/attendance/AdminAttendancePanel";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const eventId = Number(id);
  return Number.isSafeInteger(eventId) && eventId > 0
    ? <AdminAttendancePanel eventId={eventId} /> : <main><p>행사 주소를 확인해 주세요.</p></main>;
}
