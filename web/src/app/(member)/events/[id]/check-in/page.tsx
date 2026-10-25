import type { Metadata } from "next";
import { CheckInPanel } from "../../../../../features/attendance/CheckInPanel";
import { CheckInSkeleton } from "../../../../../features/attendance/CheckInSkeleton";
import { PageGate } from "../../../../../features/auth/PageGate";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "현장 출석" };

export default async function Page({ params }: PageProps<"/events/[id]/check-in">) {
  const eventId = Number((await params).id);
  return <main id="member-content" tabIndex={-1} className={styles.page}>
    {Number.isSafeInteger(eventId) && eventId > 0
      ? <PageGate skeleton={<CheckInSkeleton />}><CheckInPanel eventId={eventId} /></PageGate>
      : <p>일정 주소를 확인해 주세요.</p>}
  </main>;
}
