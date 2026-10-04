import { PageGate } from "../../../../features/auth/PageGate";
import { EventEditor } from "../../../../features/event/EventEditor";
import { EventEditorSkeleton } from "../../../../features/event/EventEditorSkeleton";

export default function AdminEventsPage() {
  return <main>
    <PageGate skeleton={<EventEditorSkeleton />} permission="MANAGE_EVENTS"><EventEditor /></PageGate>
  </main>;
}
