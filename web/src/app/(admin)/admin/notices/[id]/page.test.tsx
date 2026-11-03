import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Page from "./page";

vi.mock("../../../../../features/notice/NoticeEdit", () => ({ NoticeEdit: () => <p>수정 폼</p> }));
afterEach(cleanup);

test("숫자가 아닌 공지 주소는 안내와 공지 관리로 가는 링크를 보입니다", async () => {
  render(await Page({ params: Promise.resolve({ id: "abc" }) }));
  expect(screen.getByText("공지 주소를 확인해 주세요.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "공지 관리로" })).toHaveAttribute("href", "/admin/notices");
  expect(screen.queryByText("수정 폼")).not.toBeInTheDocument();
});
