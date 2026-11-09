import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { EventPage } from "./EventPage";
import * as events from "./events";
import * as attendance from "../attendance/attendance";
import { renderWithSession, sessionFixture } from "../../test/session";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "3" }) }));
vi.mock("./events", async (importOriginal) => ({ ...await importOriginal<typeof events>(), getEvent: vi.fn(), getMyEventRsvp: vi.fn() }));
vi.mock("../attendance/attendance", async (importOriginal) => ({
  ...await importOriginal<typeof attendance>(), getEventAttendance: vi.fn(),
}));

const member = sessionFixture({ id: 2 });
const fixture: events.ChoirEvent = { id: 3, title: "연습", description: "설명", cancelledAt: null, startAt: "2026-09-27T09:00:00Z",
  endAt: "2026-09-27T12:00:00Z", kind: "EVENT", part: null, obEligible: false, publicVisible: false,
  createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" };

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-09-27T08:00:00Z"));
  vi.mocked(events.getEvent).mockResolvedValue(fixture);
  vi.mocked(events.getMyEventRsvp).mockResolvedValue({ eventId: 3, choice: null });
});

test("일정 상세는 일시와 대상을 사실 표로, 참석 응답과 내 출석을 섹션으로 보여 줍니다", async () => {
  vi.mocked(attendance.getEventAttendance).mockResolvedValue({ eventId: 3, eventTitle: "연습", startAt: fixture.startAt, status: "NOT_OPEN", checkInOpen: false });
  renderWithSession(<EventPage />, member);
  expect(await screen.findByText("일시", { selector: "dt" })).toBeInTheDocument();
  expect(screen.getByText("대상", { selector: "dt" })).toBeInTheDocument();
  expect(await screen.findByRole("heading", { level: 2, name: "참석 응답" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: "내 출석" })).toBeInTheDocument();
});

test("취소된 일정은 사실 표에 상태를 적고 참석 응답을 두지 않습니다", async () => {
  vi.mocked(events.getEvent).mockResolvedValue({ ...fixture, cancelledAt: "2026-09-20T00:00:00Z" });
  vi.mocked(attendance.getEventAttendance).mockResolvedValue({ eventId: 3, eventTitle: "연습", startAt: fixture.startAt, status: "NOT_OPEN", checkInOpen: false });
  renderWithSession(<EventPage />, member);
  const term = await screen.findByText("상태", { selector: "dt" });
  expect(term.nextElementSibling).toHaveTextContent("취소된 일정입니다");
  expect(screen.queryByRole("heading", { name: "참석 응답" })).toBeNull();
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); });

test.each([
  { startAt: "2026-09-27T09:00:00Z", checkInOpen: false, label: "출석 창 대기" },
  { startAt: "2026-09-27T07:00:00Z", checkInOpen: false, label: "출석 기록 없음" },
  { startAt: "2026-09-27T07:00:00Z", checkInOpen: true, label: "출석 전" },
])("출석 기록이 없으면 행사 시작과 출석 창에 따라 $label 상태를 보입니다", async ({ startAt, checkInOpen, label }) => {
  vi.mocked(attendance.getEventAttendance).mockResolvedValue({ eventId: 3, eventTitle: "연습", startAt, status: "NOT_OPEN", checkInOpen });
  renderWithSession(<EventPage />, member);
  expect(await screen.findByText(label)).toBeInTheDocument();
  // 메뉴의 '일정'과 같은 곳으로 돌아갑니다.
  expect(screen.getByRole("link", { name: "← 홈" })).toHaveAttribute("href", "/dashboard");
});

test("일정을 받는 동안 없어진 일정 페이지처럼 보이는 제목을 띄우지 않습니다", () => {
  vi.mocked(events.getEvent).mockReturnValue(new Promise(() => {}));
  renderWithSession(<EventPage />, member);
  expect(screen.getByRole("status")).toHaveTextContent("일정을 불러오는 중입니다.");
  expect(screen.queryByRole("heading")).toBeNull();
});

test("행사 상세에서 창이 닫히면 참여 버튼을 보여주지 않습니다", async () => {
  vi.mocked(attendance.getEventAttendance).mockResolvedValue({ eventId: 3, eventTitle: "연습", startAt: "2026-09-27T09:00:00Z", status: "NOT_OPEN", checkInOpen: false });
  renderWithSession(<EventPage />, member);
  await screen.findByText("출석 창 대기");
  expect(screen.queryByRole("link", { name: "현장 출석하기" })).toBeNull();
  expect(screen.queryByRole("link", { name: "운영진 출석 관리" })).toBeNull();
});

test("행사 상세에서 열린 창의 출석 대상에게 참여 버튼을 보여줍니다", async () => {
  vi.mocked(attendance.getEventAttendance).mockResolvedValue({ eventId: 3, eventTitle: "연습", startAt: "2026-09-27T09:00:00Z", status: "NOT_OPEN", checkInOpen: true });
  renderWithSession(<EventPage />, member);
  expect(await screen.findByRole("link", { name: "현장 출석하기" })).toHaveAttribute("href", "/events/3/check-in");
});

test("내 출석이 빠지는 취소 일정에서도 운영진 출석 관리 링크를 보여줍니다", async () => {
  vi.mocked(events.getEvent).mockResolvedValue({ ...fixture, cancelledAt: "2026-09-20T00:00:00Z" });
  vi.mocked(attendance.getEventAttendance).mockResolvedValue({ eventId: 3, eventTitle: "연습", startAt: fixture.startAt, status: "NOT_ELIGIBLE", checkInOpen: false });
  renderWithSession(<EventPage />, sessionFixture({ permissions: ["MANAGE_EVENTS", "VIEW_MINUTES"] }));
  expect(await screen.findByRole("link", { name: "운영진 출석 관리" })).toHaveAttribute("href", "/admin/events/3/attendance");
  expect(screen.queryByRole("heading", { name: "내 출석" })).toBeNull();
});

test("일정 관리 권한이 있으면 운영진 출석 관리 링크를 보여줍니다", async () => {
  vi.mocked(attendance.getEventAttendance).mockResolvedValue({ eventId: 3, eventTitle: "연습", startAt: "2026-09-27T09:00:00Z", status: "NOT_OPEN", checkInOpen: false });
  renderWithSession(<EventPage />, sessionFixture({ permissions: ["MANAGE_EVENTS", "VIEW_MINUTES"] }));
  expect(await screen.findByRole("link", { name: "운영진 출석 관리" })).toHaveAttribute("href", "/admin/events/3/attendance");
});

test("페이지 제목에 일정 이름을 쓰고 상세에서 같은 제목을 반복하지 않습니다", async () => {
  vi.mocked(attendance.getEventAttendance).mockResolvedValue({ eventId: 3, eventTitle: "연습", startAt: "2026-09-27T09:00:00Z", status: "NOT_OPEN", checkInOpen: false });
  renderWithSession(<EventPage />, member);
  expect(await screen.findByRole("heading", { level: 1, name: "연습" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { name: "연습" })).toHaveLength(1);
});
