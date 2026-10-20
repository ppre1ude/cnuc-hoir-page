import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { EventDetail } from "./EventDetail";
import type { ChoirEvent } from "./events";

afterEach(cleanup);

const event: ChoirEvent = {
  id: 3, title: "연습", description: "설명", startAt: "2026-09-27T09:00:00Z",
  endAt: "2026-09-27T12:00:00Z", obEligible: true, publicVisible: false,
  createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z",
};

test("출석 대상이고 창이 열렸을 때만 참여 버튼을 표시합니다", () => {
  const { rerender } = render(<EventDetail event={event} memberType="OB" checkInOpen={false} />);
  expect(screen.queryByRole("link", { name: "현장 출석하기" })).toBeNull();
  rerender(<EventDetail event={event} memberType="OB" checkInOpen />);
  expect(screen.getByRole("link", { name: "현장 출석하기" })).toHaveAttribute("href", "/events/3/check-in");
  rerender(<EventDetail event={{ ...event, obEligible: false }} memberType="OB" checkInOpen={false} />);
  expect(screen.queryByRole("link", { name: "현장 출석하기" })).toBeNull();
});

test("행사 설명의 주소를 누를 수 있는 링크로 보여 줍니다", () => {
  render(<EventDetail event={{ ...event, description: "악보: https://drive.example/score" }} memberType="ACTIVE" checkInOpen={false} />);
  expect(screen.getByRole("link", { name: "https://drive.example/score" })).toHaveAttribute("href", "https://drive.example/score");
});
