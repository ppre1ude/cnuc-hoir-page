import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { EventDetail } from "./EventDetail";
import type { ChoirEvent } from "./events";

afterEach(cleanup);

const event: ChoirEvent = {
  id: 3, title: "연습", description: "설명", startAt: "2026-09-27T09:00:00Z",
  endAt: "2026-09-27T12:00:00Z", kind: "EVENT", part: null, obEligible: true, publicVisible: false,
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

test("같은 날 끝나는 일정은 끝 시각에 날짜를 다시 쓰지 않습니다", () => {
  const { container, rerender } = render(<EventDetail event={event} memberType="ACTIVE" checkInOpen={false} />);
  // ICU 버전에 따라 오전·오후 표기가 달라 시각 앞 표기는 고정하지 않습니다.
  expect(container.querySelector("time")!.parentElement).toHaveTextContent(/^2026\. 9\. 27\. \S+ 6:00 ~ \S+ 9:00$/);
  rerender(<EventDetail event={{ ...event, endAt: "2026-09-28T03:00:00Z" }} memberType="ACTIVE" checkInOpen={false} />);
  expect(container.querySelector("time")!.parentElement).toHaveTextContent(/^2026\. 9\. 27\. \S+ 6:00 ~ 2026\. 9\. 28\. \S+ 12:00$/);
});

test("일정 페이지처럼 제목을 이미 보여 주는 곳에서는 제목을 다시 쓰지 않습니다", () => {
  const { rerender } = render(<EventDetail event={event} memberType="ACTIVE" checkInOpen={false} />);
  expect(screen.getByRole("heading", { name: "연습" })).toBeInTheDocument();
  rerender(<EventDetail event={event} memberType="ACTIVE" checkInOpen={false} showTitle={false} />);
  expect(screen.queryByRole("heading")).toBeNull();
});
