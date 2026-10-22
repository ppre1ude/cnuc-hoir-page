import type { Metadata } from "next";
import { AdminAttendancePanel } from "../../../../../../features/attendance/AdminAttendancePanel";
import { AdminAttendanceSkeleton } from "../../../../../../features/attendance/AdminAttendanceSkeleton";
import { PageGate } from "../../../../../../features/auth/PageGate";

export const metadata: Metadata = { title: "출석 관리" };

export default async function Page({ params }: PageProps<"/admin/events/[id]/attendance">) {
  const eventId = Number((await params).id);
  return <main>
    {Number.isSafeInteger(eventId) && eventId > 0
      ? <PageGate skeleton={<AdminAttendanceSkeleton />} permission="MANAGE_EVENTS"><AdminAttendancePanel eventId={eventId} /></PageGate>
      : <p>일정 주소를 확인해 주세요.</p>}
  </main>;
}
