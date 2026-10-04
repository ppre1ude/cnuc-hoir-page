import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { EventPage } from "./EventPage";
import * as events from "./events";
import * as attendance from "../attendance/attendance";
import { renderWithSession, sessionFixture } from "../../test/session";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "3" }) }));
vi.mock("./events", async (importOriginal) => ({ ...await importOriginal<typeof events>(), getEvent: vi.fn() }));
vi.mock("../attendance/attendance", async (importOriginal) => ({
  ...await importOriginal<typeof attendance>(), getEventAttendance: vi.fn(),
}));

const member = sessionFixture({ id: 2 });

beforeEach(() => {
  vi.mocked(events.getEvent).mockResolvedValue({ id: 3, title: "연습", description: "설명", startAt: "2026-09-27T09:00:00Z",
    endAt: "2026-09-27T12:00:00Z", obEligible: false, publicVisible: false,
    createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("행사 상세에서 창이 닫히면 참여 버튼을 보여주지 않습니다", async () => {
  vi.mocked(attendance.getEventAttendance).mockResolvedValue({ eventId: 3, eventTitle: "연습", status: "NOT_OPEN", checkInOpen: false });
  renderWithSession(<EventPage />, member);
  await screen.findByText("출석 창 대기");
  expect(screen.queryByRole("link", { name: "현장 출석하기" })).toBeNull();
  expect(screen.queryByRole("link", { name: "운영진 출석 관리" })).toBeNull();
});

test("행사 상세에서 열린 창의 출석 대상에게 참여 버튼을 보여줍니다", async () => {
  vi.mocked(attendance.getEventAttendance).mockResolvedValue({ eventId: 3, eventTitle: "연습", status: "NOT_OPEN", checkInOpen: true });
  renderWithSession(<EventPage />, member);
  expect(await screen.findByRole("link", { name: "현장 출석하기" })).toHaveAttribute("href", "/events/3/check-in");
});

test("행사 관리 권한이 있으면 운영진 출석 관리 링크를 보여줍니다", async () => {
  vi.mocked(attendance.getEventAttendance).mockResolvedValue({ eventId: 3, eventTitle: "연습", status: "NOT_OPEN", checkInOpen: false });
  renderWithSession(<EventPage />, sessionFixture({ permissions: ["MANAGE_EVENTS", "VIEW_MINUTES"] }));
  expect(await screen.findByRole("link", { name: "운영진 출석 관리" })).toHaveAttribute("href", "/admin/events/3/attendance");
});
