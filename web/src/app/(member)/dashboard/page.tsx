import type { Metadata } from "next";
import { PageGate } from "../../../features/auth/PageGate";
import { EventCalendar } from "../../../features/event/EventCalendar";
import { EventCalendarSkeleton } from "../../../features/event/EventCalendarSkeleton";

export const metadata: Metadata = { title: "일정" };

export default function DashboardPage() {
  return <PageGate skeleton={<EventCalendarSkeleton />}><EventCalendar /></PageGate>;
}
