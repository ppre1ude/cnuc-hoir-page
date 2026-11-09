import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AdminAttendanceSkeleton } from "./AdminAttendanceSkeleton";

afterEach(cleanup);

// 기다리는 화면은 자리만 잡고, 보조 낭독에 빈 제목을 내지 않습니다.
test("출석 관리 스켈레톤은 제목 자리를 잡되 제목으로 읽히지 않습니다", () => {
  render(<AdminAttendanceSkeleton />);
  expect(screen.queryByRole("heading")).toBeNull();
});
