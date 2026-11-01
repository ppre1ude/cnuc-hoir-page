import { apiRequest } from "../../lib/api";
import type { MemberSession, Part } from "../auth/session";
import { partLabel } from "../member/roles";

export type ScheduleKind = "REGULAR_REHEARSAL" | "EXTRA_REHEARSAL" | "PART_REHEARSAL" | "EVENT";
// 등록 화면의 선택지 순서입니다. EVENT는 연주회, 발표회, MT 같은 일정이라 "중요 행사"라고 부릅니다.
export const scheduleKinds: ScheduleKind[] = ["REGULAR_REHEARSAL", "EXTRA_REHEARSAL", "PART_REHEARSAL", "EVENT"];
export const scheduleKindLabel: Record<ScheduleKind, string> = {
  REGULAR_REHEARSAL: "정기연습", EXTRA_REHEARSAL: "비정기연습", PART_REHEARSAL: "파트연습", EVENT: "중요 행사",
};
// 목록의 종류 배지와 개수 배지에 쓰는 짧은 이름입니다.
export const kindShortLabel: Record<ScheduleKind, string> = {
  REGULAR_REHEARSAL: "정기", EXTRA_REHEARSAL: "비정기", PART_REHEARSAL: "파트", EVENT: "중요 행사",
};

export type ChoirEvent = {
  id: number;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  kind: ScheduleKind;
  part: Part | null;
  obEligible: boolean;
  publicVisible: boolean;
  createdAt: string;
  updatedAt: string;
  // 값이 있으면 취소된 일정입니다. 지우지 않고 달력에 취소됨으로 남깁니다.
  cancelledAt: string | null;
};

export type EventInput = Pick<ChoirEvent, "title" | "description" | "startAt" | "endAt" | "kind" | "part" | "obEligible" | "publicVisible">;
export type EventRsvpChoice = "ATTENDING" | "ABSENT";
export type MyEventRsvp = { eventId: number; choice: EventRsvpChoice | null };
export type AdminEventRsvps = {
  eventId: number;
  attending: number;
  absent: number;
  unanswered: number;
  members: { memberId: number; name: string; part: Part | null; cohort: number | null; choice: EventRsvpChoice | null }[];
};

// 참석 응답과 출석의 대상인지 봅니다. 활동 단원(OB 참여 대상이면 OB도)이고, 파트연습이면 그 파트 단원이어야 합니다.
// 서버의 EventAccess.target과 같은 규칙입니다. 다른 파트의 운영진은 파트연습을 보기만 합니다.
export function isEventTarget(event: Pick<ChoirEvent, "kind" | "part" | "obEligible">,
  member: { memberType: MemberSession["memberType"]; part?: Part | null }): boolean {
  const type = member.memberType === "ACTIVE" || (member.memberType === "OB" && event.obEligible);
  return type && (event.kind !== "PART_REHEARSAL" || (member.part != null && member.part === event.part));
}

// "테너 단원 · OB", "활동 단원"처럼 참석 대상을 적습니다.
export function eventAudience(event: Pick<ChoirEvent, "kind" | "part" | "obEligible">): string {
  const members = event.kind === "PART_REHEARSAL" && event.part ? `${partLabel[event.part]} 단원` : "활동 단원";
  return event.obEligible ? `${members} · OB` : members;
}

// 일정 관리 목록에 쓰는 종류 이름입니다. 파트연습은 "테너 파트연습"처럼 파트를 붙입니다.
export function eventKindText(event: Pick<ChoirEvent, "kind" | "part">): string {
  return event.kind === "PART_REHEARSAL" && event.part ? `${partLabel[event.part]} 파트연습` : scheduleKindLabel[event.kind];
}

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

export function cancelEvent(id: number): Promise<ChoirEvent> {
  return apiRequest<ChoirEvent>(`/admin/events/${id}/cancel`, { method: "POST" });
}

export function restoreEvent(id: number): Promise<ChoirEvent> {
  return apiRequest<ChoirEvent>(`/admin/events/${id}/restore`, { method: "POST" });
}

export function deleteEvent(id: number): Promise<void> {
  return apiRequest<void>(`/admin/events/${id}`, { method: "DELETE" });
}

// 운영진 명단에서 출석 시각만 "오후 6:03"처럼 보입니다.
export function seoulTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", timeStyle: "short" }).format(new Date(value));
}

// "2026-11"에서 count달 뒤의 달입니다. 음수면 앞의 달입니다.
export function addMonths(month: string, count: number): string {
  const [year, number] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, number - 1 + count, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type Chip = { tone: "positive" | "neutral" | "negative" | "attention"; label: string };

// 목록 행은 응답을 받지 않고 상태만 보여 줍니다. 지난 일정의 "참석"이 출석으로 읽히지 않게 응답임을 밝힙니다.
// choice가 undefined면 응답을 아직 못 받은 것이라 칩을 그리지 않습니다.
export function rsvpChip(event: ChoirEvent, member: { memberType: "ACTIVE" | "OB" | null; part?: Part | null },
  choice: EventRsvpChoice | null | undefined): Chip | null {
  // 불참의 빨간색과 헷갈리지 않게 회색으로 둡니다.
  if (event.cancelledAt) return { tone: "neutral", label: "취소됨" };
  if (!isEventTarget(event, member)) return { tone: "neutral", label: "대상 아님" };
  if (choice === undefined) return null;
  const closed = new Date(event.startAt).getTime() <= Date.now();
  if (choice === "ATTENDING") return closed ? { tone: "neutral", label: "참석 응답" } : { tone: "positive", label: "참석" };
  if (choice === "ABSENT") return closed ? { tone: "neutral", label: "불참 응답" } : { tone: "negative", label: "불참" };
  return { tone: closed ? "neutral" : "attention", label: "미응답" };
}
