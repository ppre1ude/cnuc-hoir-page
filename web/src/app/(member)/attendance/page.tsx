import { MyAttendancePage } from "../../../features/attendance/MyAttendancePage";
import { MyAttendanceSkeleton } from "../../../features/attendance/MyAttendanceSkeleton";
import { PageGate } from "../../../features/auth/PageGate";

export default function Page() {
  return <PageGate skeleton={<MyAttendanceSkeleton />}><MyAttendancePage /></PageGate>;
}
