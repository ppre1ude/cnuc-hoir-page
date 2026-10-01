import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberRegistration } from "./MemberRegistration";
import { addAllowlist, addOperatorPreapproval, getAllowlist, getOperatorPreapprovals,
  removeAllowlist, type AllowlistItem } from "./adminMembers";

vi.mock("./adminMembers", () => ({ getAllowlist: vi.fn(), addAllowlist: vi.fn(), removeAllowlist: vi.fn(),
  getOperatorPreapprovals: vi.fn(), addOperatorPreapproval: vi.fn(), removeOperatorPreapproval: vi.fn() }));

const empty = { items: [], page: 0, size: 20, total: 0 };
beforeEach(() => {
  vi.mocked(getAllowlist).mockResolvedValue(empty);
  vi.mocked(getOperatorPreapprovals).mockResolvedValue(empty);
});
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

  render(<MemberRegistration />);
  await screen.findByRole("heading", { name: "member1@gmail.com" });
  await userEvent.click(screen.getByRole("button", { name: "다음" }));
  await screen.findByRole("heading", { name: "member21@gmail.com" });
  await userEvent.click(screen.getByRole("button", { name: "member21@gmail.com 등록 삭제" }));

  expect(await screen.findByRole("heading", { name: "member1@gmail.com" })).toBeInTheDocument();
  expect(screen.queryByText("등록된 단원 이메일이 없습니다.")).not.toBeInTheDocument();
  expect(getAllowlist).toHaveBeenLastCalledWith(0);
});

test("운영진 권한을 선택하면 운영진으로, 아니면 일반 단원으로 등록합니다", async () => {
  render(<MemberRegistration />);
  await screen.findByText("등록된 단원 이메일이 없습니다.");

  await userEvent.type(screen.getByLabelText("구글 계정 이메일"), "member@gmail.com");
  await userEvent.type(screen.getByLabelText("이름 (선택)"), "새 단원");
  await userEvent.click(screen.getByRole("button", { name: "등록" }));
  expect(addAllowlist).toHaveBeenCalledWith({ email: "member@gmail.com", memberType: "ACTIVE", name: "새 단원" });

  await waitFor(() => expect(screen.getByLabelText("구글 계정 이메일")).toHaveValue(""));
  await userEvent.clear(screen.getByLabelText("구글 계정 이메일"));
  await userEvent.type(screen.getByLabelText("구글 계정 이메일"), "operator@gmail.com");
  await userEvent.click(screen.getByLabelText("운영진 권한도 부여"));
  await userEvent.click(screen.getByRole("button", { name: "등록" }));
  expect(addOperatorPreapproval).toHaveBeenCalledWith({ email: "operator@gmail.com", memberType: "ACTIVE" });
  expect(addAllowlist).toHaveBeenCalledTimes(1);
});
