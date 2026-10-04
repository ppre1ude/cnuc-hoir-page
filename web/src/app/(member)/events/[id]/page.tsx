import { PageGate } from "../../../../features/auth/PageGate";
import { EventPage } from "../../../../features/event/EventPage";
import { EventPageSkeleton } from "../../../../features/event/EventPageSkeleton";

export default function Page() {
  return <PageGate skeleton={<EventPageSkeleton />}><EventPage /></PageGate>;
}
