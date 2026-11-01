import type { Metadata } from "next";
import { MyAttendanceSkeleton } from "../../../features/attendance/MyAttendanceSkeleton";
import { PageGate } from "../../../features/auth/PageGate";
import { MemberLinksPage } from "../../../features/member/MemberLinksPage";

export const metadata: Metadata = { title: "자료실" };

export default function Page() {
  return <PageGate skeleton={<MyAttendanceSkeleton />}><MemberLinksPage /></PageGate>;
}
