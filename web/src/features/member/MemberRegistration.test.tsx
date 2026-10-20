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

  render(<MemberRegistration session={{ id: 1, name: "관리자", status: "APPROVED", memberType: "ACTIVE", admin: true }} />);
  await screen.findByRole("heading", { name: "member1@gmail.com" });
  await userEvent.click(screen.getByRole("button", { name: "다음" }));
  await screen.findByRole("heading", { name: "member21@gmail.com" });
  await userEvent.click(screen.getByRole("button", { name: "member21@gmail.com 등록 삭제" }));

  expect(await screen.findByRole("heading", { name: "member1@gmail.com" })).toBeInTheDocument();
  expect(screen.queryByText("등록된 단원 이메일이 없습니다.")).not.toBeInTheDocument();
  expect(getAllowlist).toHaveBeenLastCalledWith(0);
});

test("운영진 권한을 선택하면 운영진으로, 아니면 일반 단원으로 등록합니다", async () => {
  render(<MemberRegistration session={{ id: 1, name: "관리자", status: "APPROVED", memberType: "ACTIVE", admin: true }} />);
  await screen.findByText("등록된 단원 이메일이 없습니다.");

  await userEvent.type(screen.getByLabelText("구글 계정 이메일"), "member@gmail.com");
  await userEvent.type(screen.getByLabelText("이름 (선택)"), "새 단원");
  await userEvent.click(screen.getByRole("button", { name: "등록" }));
  expect(addAllowlist).toHaveBeenCalledWith({ email: "member@gmail.com", memberType: "ACTIVE", name: "새 단원" });

  await waitFor(() => expect(screen.getByLabelText("구글 계정 이메일")).toHaveValue(""));
  await userEvent.clear(screen.getByLabelText("구글 계정 이메일"));
  await userEvent.type(screen.getByLabelText("구글 계정 이메일"), "operator@gmail.com");
  await userEvent.click(screen.getByLabelText("사이트 관리자 권한도 부여"));
  await userEvent.click(screen.getByRole("button", { name: "등록" }));
  expect(addOperatorPreapproval).toHaveBeenCalledWith({ email: "operator@gmail.com", memberType: "ACTIVE" });
  expect(addAllowlist).toHaveBeenCalledTimes(1);
});

test("Gmail이 아닌 주소를 입력하면 바로 승인되지 않는다고 경고합니다", async () => {
  render(<MemberRegistration session={{ id: 1, name: "관리자", status: "APPROVED", memberType: "ACTIVE", admin: true }} />);
  await screen.findByText("등록된 단원 이메일이 없습니다.");
  expect(screen.getByText(/@gmail\.com 주소는 그 구글 계정으로 로그인하면 바로 승인됩니다\. 다른 주소로 만든 구글 계정은/)).toBeInTheDocument();

  const input = screen.getByLabelText("구글 계정 이메일");
  await userEvent.type(input, "hong@gmial.com");
  expect(input).toHaveAccessibleDescription(/@gmail\.com 주소가 아니면 로그인해도 바로 승인되지 않습니다/);

  await userEvent.clear(input);
  await userEvent.type(input, "Hong@Gmail.com");
  expect(screen.queryByText(/@gmail\.com 주소가 아니면/)).not.toBeInTheDocument();
});

test("등록한 뒤에도 고른 단원 구분을 유지하고 이메일 칸으로 돌아갑니다", async () => {
  render(<MemberRegistration session={{ id: 1, name: "관리자", status: "APPROVED", memberType: "ACTIVE", admin: true }} />);
  await screen.findByText("등록된 단원 이메일이 없습니다.");
  await userEvent.type(screen.getByLabelText("구글 계정 이메일"), "ob1@gmail.com");
  await userEvent.type(screen.getByLabelText("이름 (선택)"), "첫 OB");
  await userEvent.selectOptions(screen.getByLabelText("단원 구분"), "OB");
  await userEvent.click(screen.getByRole("button", { name: "등록" }));

  await waitFor(() => expect(screen.getByLabelText("구글 계정 이메일")).toHaveFocus());
  expect(screen.getByLabelText("구글 계정 이메일")).toHaveValue("");
  expect(screen.getByLabelText("이름 (선택)")).toHaveValue("");
  await userEvent.type(screen.getByLabelText("구글 계정 이메일"), "ob2@gmail.com");
  await userEvent.click(screen.getByRole("button", { name: "등록" }));
  expect(addAllowlist).toHaveBeenLastCalledWith({ email: "ob2@gmail.com", memberType: "OB", name: "" });
});
