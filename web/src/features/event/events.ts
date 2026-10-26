import { apiRequest } from "../../lib/api";
import type { Part } from "../auth/session";

export type ChoirEvent = {
  id: number;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  obEligible: boolean;
  publicVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EventInput = Pick<ChoirEvent, "title" | "description" | "startAt" | "endAt" | "obEligible" | "publicVisible">;
export type EventRsvpChoice = "ATTENDING" | "ABSENT";
export type MyEventRsvp = { eventId: number; choice: EventRsvpChoice | null };
export type AdminEventRsvps = {
  eventId: number;
  attending: number;
  absent: number;
  unanswered: number;
  members: { memberId: number; name: string; part: Part | null; cohort: number | null; choice: EventRsvpChoice | null }[];
};

export function monthBounds(month: string) {
  const [year, number] = month.split("-").map(Number);
  const from = new Date(`${month}-01T00:00:00+09:00`).toISOString();
  const next = new Date(Date.UTC(year, number, 1));
  const nextMonth = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
  const to = new Date(`${nextMonth}-01T00:00:00+09:00`).toISOString();
  return { from, to };
}

export function seoulDateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function seoulDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value));
}

export function getEvents(from: string, to: string): Promise<ChoirEvent[]> {
  return apiRequest<ChoirEvent[]>(`/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
}

export function getEvent(id: number): Promise<ChoirEvent> {
  return apiRequest<ChoirEvent>(`/events/${id}`);
}

export function createEvent(input: EventInput): Promise<ChoirEvent> {
  return apiRequest<ChoirEvent>("/admin/events", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}

export function createEventsBatch(events: EventInput[]): Promise<ChoirEvent[]> {
  return apiRequest<ChoirEvent[]>("/admin/events/batch", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events }),
  });
}

export function getMyEventRsvps(from: string, to: string): Promise<MyEventRsvp[]> {
  return apiRequest<MyEventRsvp[]>(`/events/rsvps/me?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
}

export function getMyEventRsvp(id: number): Promise<MyEventRsvp> {
  return apiRequest<MyEventRsvp>(`/events/${id}/rsvp`);
}

export function setEventRsvp(id: number, choice: EventRsvpChoice): Promise<MyEventRsvp> {
  return apiRequest<MyEventRsvp>(`/events/${id}/rsvp`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ choice }),
  });
}

export function getAdminEventRsvps(id: number, cache?: RequestCache): Promise<AdminEventRsvps> {
  return apiRequest<AdminEventRsvps>(`/admin/events/${id}/rsvps`, { cache });
}

export function updateEvent(id: number, input: EventInput): Promise<ChoirEvent> {
  return apiRequest<ChoirEvent>(`/admin/events/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}
