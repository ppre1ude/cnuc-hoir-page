import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { AdminAttendancePanel } from "./AdminAttendancePanel";
import * as attendance from "./attendance";
import * as events from "../event/events";
import QRCode from "qrcode";
import { renderWithSession, sessionFixture } from "../../test/session";

vi.mock("./attendance", async (importOriginal) => {
  const original = await importOriginal<typeof attendance>();
  return {
    ...original, getCheckInSession: vi.fn(), getAdminAttendance: vi.fn(), openCheckIn: vi.fn(),
  };
});
vi.mock("../event/events", async (importOriginal) => {
  const original = await importOriginal<typeof events>();
  return { ...original, getEvent: vi.fn() };
});
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,abc") } }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("출석 창 열기 성공 후 목록 갱신 실패는 조회만 재시도합니다", async () => {
  vi.mocked(events.getEvent).mockResolvedValue({ id: 3, title: "연습", description: "설명", startAt: "2026-09-27T09:00:00Z",
    endAt: "2026-09-27T12:00:00Z", obEligible: false, publicVisible: false, createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z" });
  vi.mocked(attendance.getCheckInSession)
    .mockResolvedValueOnce({ sessionId: null, expiresAt: null, open: false })
    .mockRejectedValueOnce(new Error("조회 실패"))
    .mockResolvedValueOnce({ sessionId: 7, expiresAt: "2026-09-27T10:10:00Z", open: true });
  vi.mocked(attendance.getAdminAttendance).mockResolvedValue([]);
  vi.mocked(attendance.openCheckIn).mockResolvedValue({ sessionId: 7, expiresAt: "2026-09-27T10:10:00Z",
    qrUrl: "/events/3/check-in#token=secret", code: "ABCD2345" });

  renderWithSession(<AdminAttendancePanel eventId={3} />, sessionFixture({ admin: true }));
  fireEvent.click(await screen.findByRole("button", { name: "출석 창 열기" }));
  await screen.findByText(/변경은 완료됐지만/);
  expect(attendance.openCheckIn).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "출석 창 열기" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "목록 다시 불러오기" }));
  await waitFor(() => expect(screen.queryByText(/변경은 완료됐지만/)).toBeNull());
  expect(attendance.openCheckIn).toHaveBeenCalledTimes(1);
  expect(QRCode.toDataURL).toHaveBeenCalledWith(expect.stringMatching(/^http:\/\/localhost.*\/events\/3\/check-in#token=secret$/), expect.any(Object));
});
