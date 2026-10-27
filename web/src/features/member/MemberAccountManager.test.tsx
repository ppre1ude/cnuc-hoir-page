import { afterEach, beforeEach, expect, onTestFinished, test, vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberAccountManager } from "./MemberAccountManager";
import { getSession } from "../auth/session";
import { approveApplication, assignMemberRole, cancelRejection, getAllowlist, getMembers, getOperatorPreapprovals, inviteMember,
  rejectApplication, type MemberItem } from "./adminMembers";
import { renderWithSession, sessionFixture } from "../../test/session";

// 자기 직책 변경 뒤 세션을 다시 받는지 보려고 getSession만 목으로 잡습니다. 처음 세션은 renderWithSession이 넣습니다.
vi.mock("../auth/session", async (importOriginal) => ({ ...await importOriginal<typeof import("../auth/session")>(), getSession: vi.fn() }));
vi.mock("./adminMembers", () => ({ getMembers: vi.fn(), inviteMember: vi.fn(),
  reissueAccountSetup: vi.fn(), revokeMember: vi.fn(), getAllowlist: vi.fn(),
  addAllowlist: vi.fn(), removeAllowlist: vi.fn(), getOperatorPreapprovals: vi.fn(),
  addOperatorPreapproval: vi.fn(), removeOperatorPreapproval: vi.fn(), assignMemberRole: vi.fn(),
  cancelRejection: vi.fn(), approveApplication: vi.fn(), rejectApplication: vi.fn() }));

const operator = sessionFixture({ name: "운영진", admin: true });

function member(id: number, name: string): MemberItem {
  return { id, name, email: `member${id}@example.test`, status: "APPROVED", memberType: "ACTIVE",
    admin: false, googleLinked: true, createdAt: "2026-09-01T00:00:00Z", part: null, cohort: null, roles: [] };
}
function pending(id: number, name: string): MemberItem {
  return { ...member(id, name), status: "APPROVAL_PENDING", memberType: null, part: "ALTO", cohort: 2 };
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
  vi.mocked(getMembers).mockResolvedValue({ items: [member(2, "단원"), pending(5, "신청자")], page: 0, size: 20, total: 2 });
  renderWithSession(<MemberAccountManager />, sessionFixture({ name: "부장", permissions: ["VIEW_MEMBERS"] }));
  await screen.findByRole("heading", { name: "단원" });
  expect(screen.getByText("승인 대기")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /승인/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /접근 해제/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "단원 추가" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /저장/ })).not.toBeInTheDocument();
});

test("자기 행의 직책을 바꾸면 세션을 다시 받습니다", async () => {
  vi.mocked(getMembers).mockResolvedValue({ items: [member(1, "관리자"), member(2, "단원")], page: 0, size: 20, total: 2 });
  renderWithSession(<MemberAccountManager />, operator);
  const own = (await screen.findByRole("heading", { name: "관리자" })).closest("article")!;
  expect(getSession).not.toHaveBeenCalled();
  await userEvent.selectOptions(within(own).getByLabelText("관리자 추가할 직책"), "TREASURER");
  await userEvent.click(within(own).getByRole("button", { name: "관리자 직책 추가" }));
  expect(assignMemberRole).toHaveBeenCalledWith(1, { role: "TREASURER" });
  await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
});

test("다른 단원의 직책을 바꾸면 세션을 다시 받지 않습니다", async () => {
  vi.mocked(getMembers).mockResolvedValue({ items: [member(1, "관리자"), member(2, "단원")], page: 0, size: 20, total: 2 });
  renderWithSession(<MemberAccountManager />, operator);
  const other = (await screen.findByRole("heading", { name: "단원" })).closest("article")!;
  await userEvent.selectOptions(within(other).getByLabelText("단원 추가할 직책"), "TREASURER");
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
  expect(await within(row).findByText("승인 대기")).toBeInTheDocument();
  expect(within(row).queryByRole("button", { name: /반려 취소/ })).not.toBeInTheDocument();
});

test("가입 승인 권한이 없으면 반려 취소를 보여 주지 않습니다", async () => {
  vi.mocked(getMembers).mockResolvedValue({ items: [{ ...member(3, "반려된 단원"), status: "REJECTED" }], page: 0, size: 20, total: 1 });
  renderWithSession(<MemberAccountManager />, sessionFixture({ name: "부장", permissions: ["VIEW_MEMBERS"] }));
  await screen.findByRole("heading", { name: "반려된 단원" });
  expect(screen.queryByRole("button", { name: /반려 취소/ })).not.toBeInTheDocument();
});

test("승인 대기 계정은 행에서 바로 승인하고, 같은 자리에서 직책 추가로 이어집니다", async () => {
  vi.mocked(getMembers).mockResolvedValueOnce({ items: [pending(5, "신청자")], page: 0, size: 20, total: 1 })
    .mockResolvedValueOnce({ items: [{ ...member(5, "신청자"), part: "ALTO", cohort: 2 }], page: 0, size: 20, total: 1 });
  vi.mocked(approveApplication).mockResolvedValue();
  renderWithSession(<MemberAccountManager />, operator);
  const row = (await screen.findByRole("heading", { name: "신청자" })).closest("article")!;
  // 파트·구분은 폼의 선택지에도 같은 글자가 있어, 표의 제목 칸 옆 값 칸만 봅니다.
  const fact = (label: string) => within(row).getByText(label, { selector: "dt" }).nextElementSibling!;
  expect(within(row).getByText("승인 대기")).toBeInTheDocument();
  expect(fact("파트")).toHaveTextContent("알토");
  expect(fact("단원 구분")).toHaveTextContent("미지정");
  expect(within(row).queryByLabelText("신청자 추가할 직책")).not.toBeInTheDocument();
  expect(within(row).getByText("정보 수정").closest("details")).not.toHaveAttribute("open");
  await userEvent.click(within(row).getByRole("button", { name: "신청자 승인" }));
  expect(approveApplication).toHaveBeenCalledWith(5, "ACTIVE");
  expect(await within(row).findByText("사용 중")).toBeInTheDocument();
  expect(fact("단원 구분")).toHaveTextContent("활동 단원");
  expect(within(row).getByRole("status")).toHaveTextContent("승인했습니다");
  expect(within(row).getByText("정보 수정").closest("details")).toHaveAttribute("open");
  expect(within(row).getByLabelText("신청자 추가할 직책")).toBeInTheDocument();
  expect(within(row).queryByRole("button", { name: "신청자 승인" })).not.toBeInTheDocument();
});

test("OB로 승인하면 직책 추가 대신 파트·기수 확인만 안내합니다", async () => {
  vi.mocked(getMembers).mockResolvedValueOnce({ items: [pending(5, "신청자")], page: 0, size: 20, total: 1 })
    .mockResolvedValueOnce({ items: [{ ...member(5, "신청자"), memberType: "OB", part: "ALTO", cohort: 2 }], page: 0, size: 20, total: 1 });
  vi.mocked(approveApplication).mockResolvedValue();
  renderWithSession(<MemberAccountManager />, operator);
  const row = (await screen.findByRole("heading", { name: "신청자" })).closest("article")!;
  await userEvent.selectOptions(within(row).getByLabelText("신청자 단원 구분"), "OB");
  await userEvent.click(within(row).getByRole("button", { name: "신청자 승인" }));
  expect(approveApplication).toHaveBeenCalledWith(5, "OB");
  expect(await within(row).findByText("OB는 직책을 가질 수 없습니다. 활동 단원으로 바꾸면 직책을 줄 수 있습니다.")).toBeInTheDocument();
  expect(within(row).getByRole("status")).toHaveTextContent("승인했습니다. 파트와 기수를 확인해 주세요.");
  expect(within(row).getByRole("status")).not.toHaveTextContent("직책");
});

test("직책 관리 권한이 없는 운영진에게는 승인 사실만 안내합니다", async () => {
  vi.mocked(getMembers).mockResolvedValueOnce({ items: [pending(5, "신청자")], page: 0, size: 20, total: 1 })
    .mockResolvedValueOnce({ items: [{ ...member(5, "신청자"), part: "ALTO", cohort: 2 }], page: 0, size: 20, total: 1 });
  vi.mocked(approveApplication).mockResolvedValue();
  renderWithSession(<MemberAccountManager />, sessionFixture({ name: "부장", permissions: ["VIEW_MEMBERS", "APPROVE_APPLICATIONS"] }));
  const row = (await screen.findByRole("heading", { name: "신청자" })).closest("article")!;
  await userEvent.click(within(row).getByRole("button", { name: "신청자 승인" }));
  expect(await within(row).findByText("사용 중")).toBeInTheDocument();
  expect(within(row).getByRole("status")).toHaveTextContent(/^승인했습니다.$/);
  expect(within(row).queryByText("정보 수정")).not.toBeInTheDocument();
});

test("승인 대기 계정을 이유를 적어 반려하면 행 상태가 가입 반려로 바뀝니다", async () => {
  vi.mocked(getMembers).mockResolvedValueOnce({ items: [pending(5, "신청자")], page: 0, size: 20, total: 1 })
    .mockResolvedValueOnce({ items: [{ ...pending(5, "신청자"), status: "REJECTED" }], page: 0, size: 20, total: 1 });
  vi.mocked(rejectApplication).mockResolvedValue();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  onTestFinished(() => confirm.mockRestore());
  renderWithSession(<MemberAccountManager />, operator);
  const row = (await screen.findByRole("heading", { name: "신청자" })).closest("article")!;
  expect(within(row).getByRole("button", { name: "신청자 반려" })).toBeDisabled();
  await userEvent.type(within(row).getByLabelText("신청자 반려 이유"), "명단에 없음");
  await userEvent.click(within(row).getByRole("button", { name: "신청자 반려" }));
  expect(rejectApplication).toHaveBeenCalledWith(5, "명단에 없음");
  expect(await within(row).findByText("가입 반려")).toBeInTheDocument();
  expect(within(row).getByRole("button", { name: "신청자 반려 취소" })).toBeInTheDocument();
});
