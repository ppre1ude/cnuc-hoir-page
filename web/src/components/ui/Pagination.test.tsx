import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "./index";

afterEach(cleanup);

const numbers = () => within(screen.getByRole("navigation", { name: "목록 페이지" }))
  .getAllByRole("button", { name: /쪽$/ }).map((button) => button.textContent);
const paging = (page: number, total = 240, onChange = () => undefined) =>
  <Pagination page={page} size={20} total={total} onChange={onChange} label="목록 페이지" />;

test("한 쪽뿐이면 그리지 않습니다", () => {
  const { container } = render(paging(0, 20));
  expect(container).toBeEmptyDOMElement();
});

test("현재 쪽을 가운데 둔 번호 7개와 이전, 다음을 보입니다", () => {
  render(paging(5));
  expect(numbers()).toEqual(["3", "4", "5", "6", "7", "8", "9"]);
  expect(screen.getByRole("button", { name: "6쪽" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: "이전" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "다음" })).toBeEnabled();
});

test("첫 쪽에서 이전이, 끝 쪽에서 다음이 꺼집니다", () => {
  const { rerender } = render(paging(0));
  expect(screen.getByRole("button", { name: "이전" })).toBeDisabled();
  expect(numbers()).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
  rerender(paging(11));
  expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
  expect(numbers()).toEqual(["6", "7", "8", "9", "10", "11", "12"]);
});

test("번호와 이전, 다음을 누르면 0부터 세는 쪽을 알립니다", async () => {
  const onChange = vi.fn();
  render(paging(0, 100, onChange));
  await userEvent.click(screen.getByRole("button", { name: "4쪽" }));
  expect(onChange).toHaveBeenLastCalledWith(3);
  await userEvent.click(screen.getByRole("button", { name: "다음" }));
  expect(onChange).toHaveBeenLastCalledWith(1);
  await userEvent.click(screen.getByRole("button", { name: "1쪽" }));
  expect(onChange).toHaveBeenCalledTimes(2);
});

test("화면 읽기에는 전체 중 현재 쪽을 읽어 줍니다", () => {
  render(paging(5));
  expect(screen.getByText("12쪽 중 6쪽")).toBeInTheDocument();
  expect(screen.getByText("6 / 12")).toBeInTheDocument();
});
