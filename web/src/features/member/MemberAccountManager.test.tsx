import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberAccountManager } from "./MemberAccountManager";
import { getSession } from "../auth/session";
import { assignMemberRole, cancelRejection, getAllowlist, getMembers, getOperatorPreapprovals, inviteMember, type MemberItem } from "./adminMembers";
import { renderWithSession, sessionFixture } from "../../test/session";

// 자기 직책 변경 뒤 세션을 다시 받는지 보려고 getSession만 목으로 잡습니다. 처음 세션은 renderWithSession이 넣습니다.
vi.mock("../auth/session", async (importOriginal) => ({ ...await importOriginal<typeof import("../auth/session")>(), getSession: vi.fn() }));
vi.mock("./adminMembers", () => ({ getMembers: vi.fn(), inviteMember: vi.fn(),
  reissueAccountSetup: vi.fn(), revokeMember: vi.fn(), getAllowlist: vi.fn(),
  addAllowlist: vi.fn(), removeAllowlist: vi.fn(), getOperatorPreapprovals: vi.fn(),
  addOperatorPreapproval: vi.fn(), removeOperatorPreapproval: vi.fn(), assignMemberRole: vi.fn(),
  cancelRejection: vi.fn() }));

const operator = sessionFixture({ name: "운영진", admin: true });

function member(id: number, name: string): MemberItem {
  return { id, name, email: `member${id}@example.test`, status: "APPROVED", memberType: "ACTIVE",
    admin: false, googleLinked: true, createdAt: "2026-09-01T00:00:00Z", part: null, cohort: null, roles: [] };
}

beforeEach(() => {
  // jsdom에는 scrollIntoView가 없어 결과로 화면을 옮기는 호출만 확인합니다.
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(getSession).mockResolvedValue(operator);
  vi.mocked(getMembers).mockResolvedValue({ items: [], page: 0, size: 20, total: 0 });
  vi.mocked(getAllowlist).mockResolvedValue({ items: [], page: 0, size: 20, total: 0 });
  vi.mocked(getOperatorPreapprovals).mockResolvedValue({ items: [], page: 0, size: 20, total: 0 });
  vi.mocked(inviteMember).mockResolvedValue({ memberId: 2, token: "temporary-private-token" });
  vi.mocked(assignMemberRole).mockResolvedValue({ id: 10, role: "TREASURER", department: null, unit: null, part: null });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("운영진이 단원 계정을 만들면 1회용 링크를 표시합니다", async () => {
  renderWithSession(<MemberAccountManager />, operator);
  await screen.findByText("등록된 계정이 없습니다.");
  await userEvent.type(screen.getByLabelText("이름"), "새 단원");
  await userEvent.type(within(screen.getByRole("form", { name: "1회용 링크로 초대" })).getByLabelText("구글 계정 이메일"), "member@example.org");
  await userEvent.click(screen.getByRole("button", { name: "1회용 링크 발급" }));
  expect(inviteMember).toHaveBeenCalledWith({ name: "새 단원", email: "member@example.org", memberType: "ACTIVE" });
  expect(await screen.findByLabelText("구글 계정 연결 링크")).toHaveValue(
    `${window.location.origin}/activate#token=temporary-private-token`);
  expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  expect(screen.getByRole("heading", { name: "발급된 링크" })).toHaveFocus();
});

test("행마다 접힌 접근 해제에 단원 이름을 붙입니다", async () => {
  vi.mocked(getMembers).mockResolvedValue({ items: [member(3, "이서연"), member(4, "박민준")], page: 0, size: 20, total: 2 });
  renderWithSession(<MemberAccountManager />, operator);
  expect(await screen.findByLabelText("이서연 접근 해제")).toHaveTextContent("접근 해제");
  expect(screen.getByLabelText("박민준 접근 해제")).toHaveTextContent("접근 해제");
});

test("권한이 없는 기능은 가리고 조회 권한만 있으면 목록만 보여 줍니다", async () => {
  vi.mocked(getMembers).mockResolvedValue({ items: [member(2, "단원")], page: 0, size: 20, total: 1 });
  renderWithSession(<MemberAccountManager />, sessionFixture({ name: "부장", permissions: ["VIEW_MEMBERS"] }));
  await screen.findByRole("heading", { name: "단원" });
  expect(screen.queryByRole("button", { name: /접근 해제/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "단원 추가" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /저장/ })).not.toBeInTheDocument();
});

test("자기 행의 직책을 바꾸면 세션을 다시 받습니다", async () => {
  vi.mocked(getMembers).mockResolvedValue({ items: [member(1, "관리자"), member(2, "단원")], page: 0, size: 20, total: 2 });
  renderWithSession(<MemberAccountManager />, operator);
  const own = (await screen.findByRole("heading", { name: "관리자" })).closest("article")!;
  expect(getSession).not.toHaveBeenCalled();
  await userEvent.click(within(own).getByRole("button", { name: "관리자 직책 추가" }));
  expect(assignMemberRole).toHaveBeenCalledWith(1, { role: "TREASURER" });
  await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
});

test("다른 단원의 직책을 바꾸면 세션을 다시 받지 않습니다", async () => {
  vi.mocked(getMembers).mockResolvedValue({ items: [member(1, "관리자"), member(2, "단원")], page: 0, size: 20, total: 2 });
  renderWithSession(<MemberAccountManager />, operator);
  const other = (await screen.findByRole("heading", { name: "단원" })).closest("article")!;
  await userEvent.click(within(other).getByRole("button", { name: "단원 직책 추가" }));
  expect(assignMemberRole).toHaveBeenCalledWith(2, { role: "TREASURER" });
  await waitFor(() => expect(getMembers).toHaveBeenCalledTimes(2));
  expect(getSession).not.toHaveBeenCalled();
});

test("반려된 계정은 반려를 취소해 가입 신청으로 되돌립니다", async () => {
  const rejected = { ...member(3, "반려된 단원"), status: "REJECTED" as const, memberType: null };
  vi.mocked(getMembers).mockResolvedValueOnce({ items: [member(2, "단원"), rejected], page: 0, size: 20, total: 2 })
    .mockResolvedValueOnce({ items: [member(2, "단원"), { ...rejected, status: "APPROVAL_PENDING" }], page: 0, size: 20, total: 2 });
  vi.mocked(cancelRejection).mockResolvedValue();
  renderWithSession(<MemberAccountManager />, operator);
  const row = (await screen.findByRole("heading", { name: "반려된 단원" })).closest("article")!;
  const approved = screen.getByRole("heading", { name: "단원" }).closest("article")!;
  expect(within(approved).queryByRole("button", { name: /반려 취소/ })).not.toBeInTheDocument();
  await userEvent.click(within(row).getByRole("button", { name: "반려된 단원 반려 취소" }));
  expect(cancelRejection).toHaveBeenCalledWith(3);
  expect(await within(row).findByText(/이전 가입 승인 대기/)).toBeInTheDocument();
  expect(within(row).queryByRole("button", { name: /반려 취소/ })).not.toBeInTheDocument();
});

test("가입 승인 권한이 없으면 반려 취소를 보여 주지 않습니다", async () => {
  vi.mocked(getMembers).mockResolvedValue({ items: [{ ...member(3, "반려된 단원"), status: "REJECTED" }], page: 0, size: 20, total: 1 });
  renderWithSession(<MemberAccountManager />, sessionFixture({ name: "부장", permissions: ["VIEW_MEMBERS"] }));
  await screen.findByRole("heading", { name: "반려된 단원" });
  expect(screen.queryByRole("button", { name: /반려 취소/ })).not.toBeInTheDocument();
});
