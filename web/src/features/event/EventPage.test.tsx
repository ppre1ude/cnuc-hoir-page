import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { EventPage } from "./EventPage";
import * as auth from "../auth/session";
import * as events from "./events";
import * as attendance from "../attendance/attendance";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "3" }), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("../auth/session", () => ({ getSession: vi.fn() }));
vi.mock("./events", async (importOriginal) => ({ ...await importOriginal<typeof events>(), getEvent: vi.fn() }));
vi.mock("../attendance/attendance", async (importOriginal) => ({
  ...await importOriginal<typeof attendance>(), getEventAttendance: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(auth.getSession).mockResolvedValue({ id: 2, name: "단원", status: "APPROVED", memberType: "ACTIVE", admin: false });
  vi.mocked(events.getEvent).mockResolvedValue({ id: 3, title: "연습", description: "설명", startAt: "2026-09-27T09:00:00Z",
    endAt: "2026-09-27T12:00:00Z", obEligible: false, publicVisible: false,
    createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("행사 상세에서 창이 닫히면 참여 버튼을 보여주지 않습니다", async () => {
  vi.mocked(attendance.getEventAttendance).mockResolvedValue({ eventId: 3, eventTitle: "연습", status: "NOT_OPEN", checkInOpen: false });
  render(<EventPage />);
  await screen.findByText("출석 창 대기");
  expect(screen.queryByRole("link", { name: "현장 출석하기" })).toBeNull();
});

test("행사 상세에서 열린 창의 출석 대상에게 참여 버튼을 보여줍니다", async () => {
  vi.mocked(attendance.getEventAttendance).mockResolvedValue({ eventId: 3, eventTitle: "연습", status: "NOT_OPEN", checkInOpen: true });
  render(<EventPage />);
  expect(await screen.findByRole("link", { name: "현장 출석하기" })).toHaveAttribute("href", "/events/3/check-in");
});
