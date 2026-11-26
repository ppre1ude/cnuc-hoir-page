import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Page from "./page";

// next/font/local은 Next 빌드에서만 돌아서 시험에서는 글꼴 변수 이름만 흉내 냅니다.
vi.mock("../fonts/paperlogy", () => ({ paperlogy: { variable: "paperlogy" } }));

afterEach(cleanup);

it("최근 해부터 연도를 나누고 세부 내용이 있는 행사만 고를 수 있다", () => {
  render(<Page />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("무대");
  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["2026", "2025", "2024"]);
  expect(screen.getByRole("button", { name: "제2회 정기연주회" })).toHaveAttribute("aria-current", "true");
  expect(screen.getByText("전남대학교 중앙동아리 승격")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /중앙동아리 승격/ })).toBeNull();
});

it("행사를 누르면 주소를 바꾸지 않고 페이지 안에서 본문만 바꾼다", () => {
  const { container } = render(<Page />);
  const panel = screen.getByRole("complementary");
  expect(within(panel).getByRole("heading", { name: "제2회 정기연주회" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "제1회 정기연주회" }));
  expect(within(panel).getByRole("heading", { name: "제1회 정기연주회" })).toBeInTheDocument();
  expect(within(panel).queryAllByRole("link")).toHaveLength(0);
  expect(screen.getByRole("button", { name: "제1회 정기연주회" })).toHaveAttribute("aria-current", "true");
  expect(screen.getByRole("button", { name: "제2회 정기연주회" })).not.toHaveAttribute("aria-current");
  expect(container.querySelector('a[href*="event="]')).toBeNull();
});

it("머리글의 무대가 지금 페이지임을 알린다", () => {
  render(<Page />);
  // 머리글 링크는 jsdom이 닫힌 popover로 숨기므로 숨은 요소까지 찾습니다(PublicNav.test.tsx 참고).
  expect(screen.getByRole("link", { name: "무대", hidden: true })).toHaveAttribute("aria-current", "page");
});
