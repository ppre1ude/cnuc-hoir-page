import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { choirChannels } from "./choirProfile";
import { PublicNav } from "./PublicNav";

// jsdom은 닫힌 popover를 숨기기만 하고 열지도, 데스크톱 CSS로 펼치지도 못해 숨은 요소까지 찾습니다. 보이는지는 브라우저에서 확인합니다.
const hidden = true;

afterEach(cleanup);

it("무대, 지원하기, 단원 로그인 순서로 링크를 둔다", () => {
  render(<PublicNav />);
  const nav = screen.getByRole("navigation", { hidden });
  expect(within(nav).getAllByRole("link", { hidden }).map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
    ["무대", "/stage"], ["지원하기", choirChannels.application], ["단원 로그인", "/login"],
  ]);
  expect(within(nav).getByRole("link", { name: "지원하기", hidden })).toHaveAttribute("data-public-nav", "apply");
});

it("휴대폰 메뉴 버튼이 링크 묶음을 연다", () => {
  render(<PublicNav />);
  const nav = screen.getByRole("navigation", { hidden });
  expect(nav).toHaveAttribute("aria-label", "메뉴");
  expect(nav).toHaveAttribute("popover", "auto");
  expect(screen.getByRole("button", { name: "메뉴" })).toHaveAttribute("popovertarget", nav.id);
});

it("무대 페이지에서는 무대 링크가 지금 페이지임을 알린다", () => {
  render(<PublicNav current="stage" />);
  expect(screen.getByRole("link", { name: "무대", hidden })).toHaveAttribute("aria-current", "page");
});
