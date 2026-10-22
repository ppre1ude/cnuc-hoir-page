import type { Metadata } from "next";
import { PageGate } from "../../../../features/auth/PageGate";
import { EventEditor } from "../../../../features/event/EventEditor";
import { EventEditorSkeleton } from "../../../../features/event/EventEditorSkeleton";

export const metadata: Metadata = { title: "일정 관리" };

export default function AdminEventsPage() {
  return <main>
    <PageGate skeleton={<EventEditorSkeleton />} permission="MANAGE_EVENTS"><EventEditor /></PageGate>
  </main>;
}
