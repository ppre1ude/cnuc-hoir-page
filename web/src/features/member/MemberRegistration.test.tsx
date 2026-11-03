import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
  await screen.findByText("member1@gmail.com");
  await userEvent.click(screen.getByRole("button", { name: "다음" }));
  await screen.findByText("member21@gmail.com");
  await userEvent.click(screen.getByRole("button", { name: "member21@gmail.com 삭제" }));

  expect(await screen.findByText("member1@gmail.com")).toBeInTheDocument();
  expect(screen.queryByText("사전 등록된 단원이 없습니다.")).not.toBeInTheDocument();
  expect(getAllowlist).toHaveBeenLastCalledWith(0);
});

test("운영진 권한을 선택하면 운영진으로, 아니면 일반 단원으로 등록합니다", async () => {
  render(<MemberRegistration session={{ id: 1, name: "관리자", status: "APPROVED", memberType: "ACTIVE", admin: true }} />);
  await screen.findByText("사전 등록된 단원이 없습니다.");

  await userEvent.type(screen.getByLabelText("구글 계정 이메일"), "member@gmail.com");
  await userEvent.type(screen.getByLabelText("이름 (선택)"), "새 단원");
  await userEvent.click(screen.getByRole("button", { name: "사전 등록" }));
  expect(addAllowlist).toHaveBeenCalledWith({ email: "member@gmail.com", memberType: "ACTIVE", name: "새 단원" });

  await waitFor(() => expect(screen.getByLabelText("구글 계정 이메일")).toHaveValue(""));
  await userEvent.clear(screen.getByLabelText("구글 계정 이메일"));
  await userEvent.type(screen.getByLabelText("구글 계정 이메일"), "operator@gmail.com");
  await userEvent.click(screen.getByLabelText("사이트 관리자 권한도 부여"));
  await userEvent.click(screen.getByRole("button", { name: "사전 등록" }));
  expect(addOperatorPreapproval).toHaveBeenCalledWith({ email: "operator@gmail.com", memberType: "ACTIVE" });
  expect(addAllowlist).toHaveBeenCalledTimes(1);
});

test("Gmail이 아닌 주소를 입력하면 바로 승인되지 않는다고 경고합니다", async () => {
  render(<MemberRegistration session={{ id: 1, name: "관리자", status: "APPROVED", memberType: "ACTIVE", admin: true }} />);
  await screen.findByText("사전 등록된 단원이 없습니다.");
  // 이 칸이 무엇을 하는지는 제목 아래 설명 칸이 늘 보이게 말합니다.
  expect(screen.getByText(/Gmail을 미리 등록해 두는 일입니다. 등록된 사람은 구글 계정으로 처음 로그인할 때 승인 없이 바로 단원이 됩니다/)).toBeInTheDocument();

  const input = screen.getByLabelText("구글 계정 이메일");
  await userEvent.type(input, "hong@gmial.com");
  expect(input).toHaveAccessibleDescription(/@gmail\.com 주소가 아니면 로그인해도 바로 승인되지 않습니다/);

  await userEvent.clear(input);
  await userEvent.type(input, "Hong@Gmail.com");
  expect(screen.queryByText(/@gmail\.com 주소가 아니면/)).not.toBeInTheDocument();
});

test("등록한 뒤에도 고른 단원 구분을 유지하고 이메일 칸으로 돌아갑니다", async () => {
  render(<MemberRegistration session={{ id: 1, name: "관리자", status: "APPROVED", memberType: "ACTIVE", admin: true }} />);
  await screen.findByText("사전 등록된 단원이 없습니다.");
  await userEvent.type(screen.getByLabelText("구글 계정 이메일"), "ob1@gmail.com");
  await userEvent.type(screen.getByLabelText("이름 (선택)"), "첫 OB");
  await userEvent.selectOptions(screen.getByLabelText("단원 구분"), "OB");
  await userEvent.click(screen.getByRole("button", { name: "사전 등록" }));

  await waitFor(() => expect(screen.getByLabelText("구글 계정 이메일")).toHaveFocus());
  expect(screen.getByLabelText("구글 계정 이메일")).toHaveValue("");
  expect(screen.getByLabelText("이름 (선택)")).toHaveValue("");
  await userEvent.type(screen.getByLabelText("구글 계정 이메일"), "ob2@gmail.com");
  await userEvent.click(screen.getByRole("button", { name: "사전 등록" }));
  expect(addAllowlist).toHaveBeenLastCalledWith({ email: "ob2@gmail.com", memberType: "OB", name: "" });
});

test("사이트 관리자로 사전 등록한 이메일은 같은 목록에서 배지로 구분합니다", async () => {
  vi.mocked(getOperatorPreapprovals).mockResolvedValue({ items: [{ id: 7, email: "lead@gmail.com", memberType: "ACTIVE", createdAt: "2026-09-30T00:00:00Z" }], page: 0, size: 20, total: 1 });
  vi.mocked(getAllowlist).mockResolvedValue({ items: [{ id: 8, email: "new@gmail.com", memberType: "OB", name: "새 단원", createdAt: "2026-09-30T00:00:00Z" }], page: 0, size: 20, total: 1 });
  render(<MemberRegistration session={{ id: 1, name: "관리자", status: "APPROVED", memberType: "ACTIVE", admin: true }} />);
  const list = await screen.findByRole("list", { name: "사전 등록된 단원" });
  const rows = within(list).getAllByRole("listitem");
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent("lead@gmail.com");
  expect(rows[0]).toHaveTextContent("사이트 관리자");
  expect(rows[1]).toHaveTextContent("새 단원");
  expect(rows[1]).toHaveTextContent("new@gmail.com");
  expect(rows[1]).toHaveTextContent("OB");
  expect(rows[1]).not.toHaveTextContent("사이트 관리자");
  expect(screen.getByRole("heading", { name: "사전 등록" })).toBeInTheDocument();
  expect(screen.getByText(/아직 로그인하지 않은 사람입니다/)).toBeInTheDocument();
});

test("사전 등록이 무엇인지 설명하는 안내 상자가 있습니다", () => {
  render(<MemberRegistration session={{ id: 1, name: "관리자", status: "APPROVED", memberType: "ACTIVE", admin: true }} />);
  expect(screen.getByText("사전 등록이 뭔가요?").closest("aside")).toHaveTextContent("승인 없이 바로 단원이 됩니다");
});
