import { expect, test } from "vitest";
import { attendanceLabel, attendanceTone, memberAttendanceLabel } from "./attendance";

test("지각은 중립 배지에 '지각'으로 보입니다", () => {
  expect(attendanceLabel.LATE).toBe("지각");
  expect(attendanceTone("LATE")).toBe("neutral");
  expect(attendanceTone("CHECKED_IN")).toBe("positive");
  expect(attendanceTone("MISSED")).toBe("negative");
  expect(memberAttendanceLabel({ eventId: 1, eventTitle: "연습", startAt: "2026-10-28T10:00:00Z", status: "LATE", checkInOpen: true })).toBe("지각");
});
