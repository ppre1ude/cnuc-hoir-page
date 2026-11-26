import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Page from "./page";

// next/font/local은 Next 빌드에서만 돌아서 시험에서는 글꼴 변수 이름만 흉내 냅니다.
vi.mock("../fonts/paperlogy", () => ({ paperlogy: { variable: "paperlogy" } }));

afterEach(cleanup);

const page = (event?: string) => Page({ searchParams: Promise.resolve(event === undefined ? {} : { event }) });

it("최근 해부터 연도를 나누고 페이지가 있는 행사만 고를 수 있다", async () => {
  render(await page());
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("무대");
  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["2026", "2025", "2024"]);
  const pick = screen.getByRole("link", { name: /제2회 정기연주회/ });
  expect(pick).toHaveAttribute("href", "/stage?event=concert-2026");
  expect(pick).toHaveAttribute("aria-current", "true");
  expect(screen.getByText("전남대학교 중앙동아리 승격")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /중앙동아리 승격/ })).toBeNull();
});

it.each([undefined, "없는값"])("주소가 %s여도 제2회 정기연주회 본문을 연다", async (event) => {
  render(await page(event));
  const panel = screen.getByRole("complementary");
  expect(within(panel).getByRole("heading", { name: "제2회 정기연주회" })).toBeInTheDocument();
  expect(within(panel).getByRole("link", { name: "공연 사진 보기" })).toHaveAttribute("href", "/gallery");
});

it("머리글의 무대가 지금 페이지임을 알린다", async () => {
  render(await page());
  // 머리글 링크는 jsdom이 닫힌 popover로 숨기므로 숨은 요소까지 찾습니다(PublicNav.test.tsx 참고).
  expect(screen.getByRole("link", { name: "무대", hidden: true })).toHaveAttribute("aria-current", "page");
});
