import type { Metadata } from "next";
import { MyAttendancePage } from "../../../features/attendance/MyAttendancePage";
import { MyAttendanceSkeleton } from "../../../features/attendance/MyAttendanceSkeleton";
import { PageGate } from "../../../features/auth/PageGate";

export const metadata: Metadata = { title: "내 출석 기록" };

export default function Page() {
  return <PageGate skeleton={<MyAttendanceSkeleton />}><MyAttendancePage /></PageGate>;
}
