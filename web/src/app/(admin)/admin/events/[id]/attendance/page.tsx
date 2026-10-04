"use client";

import { useParams } from "next/navigation";
import { AdminAttendancePanel } from "../../../../../../features/attendance/AdminAttendancePanel";
import { AdminAttendanceSkeleton } from "../../../../../../features/attendance/AdminAttendanceSkeleton";
import { PageGate } from "../../../../../../features/auth/PageGate";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const eventId = Number(id);
  return <main>
    {Number.isSafeInteger(eventId) && eventId > 0
      ? <PageGate skeleton={<AdminAttendanceSkeleton />} permission="MANAGE_EVENTS"><AdminAttendancePanel eventId={eventId} /></PageGate>
      : <p>행사 주소를 확인해 주세요.</p>}
  </main>;
}
