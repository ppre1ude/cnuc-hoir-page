import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AllowlistManager } from "./AllowlistManager";
import { getAllowlist, removeAllowlist, type AllowlistItem } from "./adminMembers";

vi.mock("./adminMembers", () => ({ getAllowlist: vi.fn(), addAllowlist: vi.fn(), removeAllowlist: vi.fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("마지막 페이지의 유일한 항목을 지우면 이전 페이지로 돌아갑니다", async () => {
  const items: AllowlistItem[] = Array.from({ length: 21 }, (_, index) => ({
    id: index + 1,
    email: `member${index + 1}@gmail.com`,
    memberType: "ACTIVE",
    name: null,
    createdAt: "2026-09-30T00:00:00Z",
  }));
  vi.mocked(getAllowlist).mockImplementation(async (page = 0) => ({
    items: items.slice(page * 20, (page + 1) * 20), page, size: 20, total: items.length,
  }));
  vi.mocked(removeAllowlist).mockImplementation(async (id) => {
    const index = items.findIndex((item) => item.id === id);
    items.splice(index, 1);
  });

  render(<AllowlistManager />);
  await screen.findByRole("heading", { name: "member1@gmail.com" });
  await userEvent.click(screen.getByRole("button", { name: "다음" }));
  await screen.findByRole("heading", { name: "member21@gmail.com" });
  await userEvent.click(screen.getByRole("button", { name: "명단에서 삭제" }));

  expect(await screen.findByRole("heading", { name: "member1@gmail.com" })).toBeInTheDocument();
  expect(screen.queryByText("등록된 이메일이 없습니다.")).not.toBeInTheDocument();
  expect(getAllowlist).toHaveBeenLastCalledWith(0);
});
