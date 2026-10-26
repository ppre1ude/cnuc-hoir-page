import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import RouteError from "./error";

afterEach(cleanup);

it("오류를 알리고 다시 시도 버튼에 초점을 둔다", () => {
  const retry = vi.fn();
  render(<RouteError error={new Error("깨짐")} retry={retry} />);
  expect(screen.getByRole("alert")).toHaveTextContent("잠시 후 다시 시도해 주세요.");
  const button = screen.getByRole("button", { name: "다시 시도" });
  expect(button).toHaveFocus();
  fireEvent.click(button);
  expect(retry).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("link", { name: "홈으로 가기" })).toHaveAttribute("href", "/");
});
