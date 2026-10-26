import { apiRequest } from "../../lib/api";
import { seoulDateKey } from "../event/events";
import type { Part } from "../auth/session";

export type AttendanceStatus = "CHECKED_IN" | "MISSED" | "NOT_OPEN" | "NOT_ELIGIBLE";
export type AttendanceState = { eventId: number; eventTitle: string; startAt: string; status: AttendanceStatus; checkInOpen: boolean };
export type IssuedSession = { sessionId: number; expiresAt: string; qrUrl: string; code: string };
export type SessionStatus = { sessionId: number | null; expiresAt: string | null; open: boolean };
export type AdminAttendance = { memberId: number; name: string; part: Part | null; cohort: number | null; status: AttendanceStatus };

export const attendanceLabel: Record<AttendanceStatus, string> = {
  CHECKED_IN: "출석 완료", MISSED: "미출석", NOT_OPEN: "출석 창 대기", NOT_ELIGIBLE: "출석 대상 아님",
};
// 기록이 없을 때 이미 시작한 행사에 출석 창을 기다린다고 하면 단원이 아직 출석할 수 있다고 오해합니다.
export function memberAttendanceLabel({ status, checkInOpen, startAt }: AttendanceState): string {
  if (status !== "NOT_OPEN") return attendanceLabel[status];
  if (checkInOpen) return "출석 전";
  return new Date(startAt).getTime() <= Date.now() ? "출석 기록 없음" : "출석 창 대기";
}

// 같은 제목의 주간 연습을 구분하도록 목록 행에 MM.DD (요일)로 붙입니다.
export function attendanceDate(startAt: string) {
  const weekday = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" }).format(new Date(startAt));
  return `${seoulDateKey(startAt).slice(5).replace("-", ".")} (${weekday})`;
}

export function getMyAttendance(): Promise<AttendanceState[]> { return apiRequest("/attendance/me"); }
// 출석 창 상태와 명단은 연습 중에 실시간으로 바뀌므로 기억하지 않습니다.
export function getEventAttendance(eventId: number): Promise<AttendanceState> {
  return apiRequest(`/events/${eventId}/attendance/me`, { cache: "no-store" });
}
export function submitCheckIn(eventId: number, credential: string): Promise<void> {
  return apiRequest(`/events/${eventId}/check-ins`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }),
  });
}
export function openCheckIn(eventId: number): Promise<IssuedSession> {
  return apiRequest(`/admin/events/${eventId}/check-in-session`, { method: "POST" });
}
export function rotateCheckIn(eventId: number, sessionId: number): Promise<IssuedSession> {
  return apiRequest(`/admin/events/${eventId}/check-in-session/${sessionId}/rotate`, { method: "POST" });
}
export function closeCheckIn(eventId: number): Promise<void> {
  return apiRequest(`/admin/events/${eventId}/check-in-session/close`, { method: "POST" });
}
export function getCheckInSession(eventId: number): Promise<SessionStatus> {
  return apiRequest(`/admin/events/${eventId}/check-in-session`, { cache: "no-store" });
}
export function getAdminAttendance(eventId: number): Promise<AdminAttendance[]> {
  return apiRequest(`/admin/events/${eventId}/attendance`, { cache: "no-store" });
}
export function correctAttendance(eventId: number, memberId: number, status: "CHECKED_IN" | "MISSED", reason: string): Promise<void> {
  return apiRequest(`/admin/events/${eventId}/attendance/${memberId}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, reason }),
  });
}
