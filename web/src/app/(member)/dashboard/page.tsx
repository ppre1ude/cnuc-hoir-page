import { PageGate } from "../../../features/auth/PageGate";
import { EventCalendar } from "../../../features/event/EventCalendar";
import { EventCalendarSkeleton } from "../../../features/event/EventCalendarSkeleton";

export default function DashboardPage() {
  return <PageGate skeleton={<EventCalendarSkeleton />}><EventCalendar /></PageGate>;
}
