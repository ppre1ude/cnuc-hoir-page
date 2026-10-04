import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Skeleton, SkeletonRows } from ".";

afterEach(cleanup);

test("막대는 화면 읽기 프로그램에서 숨깁니다", () => {
  const { container } = render(<Skeleton width="40%" />);
  expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
});

test("행 스켈레톤은 문구가 있을 때만 상태를 알립니다", () => {
  const { rerender } = render(<SkeletonRows count={3} label="공지를 불러오는 중입니다." />);
  expect(screen.getByRole("status")).toHaveTextContent("공지를 불러오는 중입니다.");
  rerender(<SkeletonRows count={3} />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
