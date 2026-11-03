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
// 목록은 이름과 파트만 보이고, 누른 사람의 정보가 옆 칸에 나옵니다. 상세 칸의 article을 돌려줍니다.
const roster = () => within(screen.getByRole("list", { name: "단원 명단" }));
async function open(name: string) {
  await userEvent.click(await roster().findByRole("button", { name: new RegExp(`^${name}`) }));
  return (await screen.findByRole("heading", { name })).closest("article")!;
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

test("운영진이 단원을 1회용 링크로 초대하면 링크를 표시합니다", async () => {
  renderWithSession(<MemberAccountManager />, operator);
  await screen.findByText("등록된 단원이 없습니다.");
  await userEvent.type(screen.getByLabelText("이름"), "새 단원");
  await userEvent.type(within(screen.getByRole("form", { name: "1회용 링크로 초대" })).getByLabelText("구글 계정 이메일"), "member@example.org");
  await userEvent.click(screen.getByRole("button", { name: "1회용 링크 발급" }));
  expect(inviteMember).toHaveBeenCalledWith({ name: "새 단원", email: "member@example.org", memberType: "ACTIVE" });
  expect(await screen.findByLabelText("구글 계정 연결 링크")).toHaveValue(
    `${window.location.origin}/activate#token=temporary-private-token`);
  expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  expect(screen.getByRole("heading", { name: "발급된 링크" })).toHaveFocus();
});

test("상세 칸의 포털 이용 중단에 그 단원 이름을 붙입니다", async () => {
  vi.mocked(getMembers).mockResolvedValue({ items: [member(3, "이서연"), member(4, "박민준")], page: 0, size: 20, total: 2 });
  renderWithSession(<MemberAccountManager />, operator);
  await open("이서연");
  expect(screen.getByLabelText("이서연 포털 이용 중단")).toHaveTextContent("포털 이용 중단");
  await open("박민준");
  expect(screen.getByLabelText("박민준 포털 이용 중단")).toHaveTextContent("포털 이용 중단");
  expect(screen.queryByLabelText("이서연 포털 이용 중단")).not.toBeInTheDocument();
});

test("권한이 없는 기능은 가리고 조회 권한만 있으면 목록만 보여 줍니다", async () => {
  vi.mocked(getMembers).mockResolvedValue({ items: [member(2, "단원"), pending(5, "신청자")], page: 0, size: 20, total: 2 });
  renderWithSession(<MemberAccountManager />, sessionFixture({ name: "부장", permissions: ["VIEW_MEMBERS"] }));
  await open("단원");
  expect(roster().getByText("승인 대기")).toBeInTheDocument();
  await open("신청자");
  expect(screen.queryByRole("button", { name: /승인$/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /포털 이용 중단/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "사전 등록" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /저장/ })).not.toBeInTheDocument();
});

test("자기 행의 직책을 바꾸면 세션을 다시 받습니다", async () => {
  vi.mocked(getMembers).mockResolvedValue({ items: [member(1, "관리자"), member(2, "단원")], page: 0, size: 20, total: 2 });
  renderWithSession(<MemberAccountManager />, operator);
  const own = await open("관리자");
  expect(getSession).not.toHaveBeenCalled();
  await userEvent.selectOptions(within(own).getByLabelText("관리자 추가할 직책"), "TREASURER");
  await userEvent.click(within(own).getByRole("button", { name: "관리자 직책 추가" }));
  expect(assignMemberRole).toHaveBeenCalledWith(1, { role: "TREASURER" });
  await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
});

test("다른 단원의 직책을 바꾸면 세션을 다시 받지 않습니다", async () => {
  vi.mocked(getMembers).mockResolvedValue({ items: [member(1, "관리자"), member(2, "단원")], page: 0, size: 20, total: 2 });
  renderWithSession(<MemberAccountManager />, operator);
  const other = await open("단원");
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
  const approved = await open("단원");
  expect(within(approved).queryByRole("button", { name: /반려 취소/ })).not.toBeInTheDocument();
  const row = await open("반려된 단원");
  await userEvent.click(within(row).getByRole("button", { name: "반려된 단원 반려 취소" }));
  expect(cancelRejection).toHaveBeenCalledWith(3);
  expect(await within(row).findByText("승인 대기")).toBeInTheDocument();
  expect(within(row).queryByRole("button", { name: /반려 취소/ })).not.toBeInTheDocument();
});

test("가입 승인 권한이 없으면 반려 취소를 보여 주지 않습니다", async () => {
  vi.mocked(getMembers).mockResolvedValue({ items: [{ ...member(3, "반려된 단원"), status: "REJECTED" }], page: 0, size: 20, total: 1 });
  renderWithSession(<MemberAccountManager />, sessionFixture({ name: "부장", permissions: ["VIEW_MEMBERS"] }));
  await open("반려된 단원");
  expect(screen.queryByRole("button", { name: /반려 취소/ })).not.toBeInTheDocument();
});

test("승인 대기 계정은 행에서 바로 승인하고, 같은 자리에서 직책 추가로 이어집니다", async () => {
  vi.mocked(getMembers).mockResolvedValueOnce({ items: [pending(5, "신청자")], page: 0, size: 20, total: 1 })
    .mockResolvedValueOnce({ items: [{ ...member(5, "신청자"), part: "ALTO", cohort: 2 }], page: 0, size: 20, total: 1 });
  vi.mocked(approveApplication).mockResolvedValue();
  renderWithSession(<MemberAccountManager />, operator);
  const row = await open("신청자");
  // 파트·구분은 폼의 선택지에도 같은 글자가 있어, 표의 제목 칸 옆 값 칸만 봅니다.
  const fact = (label: string) => within(row).getByText(label, { selector: "dt" }).nextElementSibling!;
  expect(within(row).getByText("승인 대기")).toBeInTheDocument();
  expect(fact("파트")).toHaveTextContent("알토");
  expect(fact("단원 구분")).toHaveTextContent("미지정");
  expect(within(row).queryByLabelText("신청자 추가할 직책")).not.toBeInTheDocument();
  expect(within(row).getByText("단원 정보 수정").closest("details")).not.toHaveAttribute("open");
  await userEvent.click(within(row).getByRole("button", { name: "신청자 승인" }));
  expect(approveApplication).toHaveBeenCalledWith(5, "ACTIVE");
  expect(await within(row).findByText("사용 중")).toBeInTheDocument();
  expect(fact("단원 구분")).toHaveTextContent("활동 단원");
  expect(within(row).getByRole("status")).toHaveTextContent("승인했습니다");
  expect(within(row).getByText("단원 정보 수정").closest("details")).toHaveAttribute("open");
  expect(within(row).getByLabelText("신청자 추가할 직책")).toBeInTheDocument();
  expect(within(row).queryByRole("button", { name: "신청자 승인" })).not.toBeInTheDocument();
});

test("OB로 승인하면 직책 추가 대신 파트·기수 확인만 안내합니다", async () => {
  vi.mocked(getMembers).mockResolvedValueOnce({ items: [pending(5, "신청자")], page: 0, size: 20, total: 1 })
    .mockResolvedValueOnce({ items: [{ ...member(5, "신청자"), memberType: "OB", part: "ALTO", cohort: 2 }], page: 0, size: 20, total: 1 });
  vi.mocked(approveApplication).mockResolvedValue();
  renderWithSession(<MemberAccountManager />, operator);
  const row = await open("신청자");
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
  const row = await open("신청자");
  await userEvent.click(within(row).getByRole("button", { name: "신청자 승인" }));
  expect(await within(row).findByText("사용 중")).toBeInTheDocument();
  expect(within(row).getByRole("status")).toHaveTextContent(/^승인했습니다.$/);
  expect(within(row).queryByText("단원 정보 수정")).not.toBeInTheDocument();
});

test("승인 대기 계정을 이유를 적어 반려하면 행 상태가 가입 반려로 바뀝니다", async () => {
  vi.mocked(getMembers).mockResolvedValueOnce({ items: [pending(5, "신청자")], page: 0, size: 20, total: 1 })
    .mockResolvedValueOnce({ items: [{ ...pending(5, "신청자"), status: "REJECTED" }], page: 0, size: 20, total: 1 });
  vi.mocked(rejectApplication).mockResolvedValue();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  onTestFinished(() => confirm.mockRestore());
  renderWithSession(<MemberAccountManager />, operator);
  const row = await open("신청자");
  expect(within(row).getByRole("button", { name: "신청자 반려" })).toBeDisabled();
  await userEvent.type(within(row).getByLabelText("신청자 반려 이유"), "명단에 없음");
  await userEvent.click(within(row).getByRole("button", { name: "신청자 반려" }));
  expect(rejectApplication).toHaveBeenCalledWith(5, "명단에 없음");
  expect(await within(row).findByText("가입 반려")).toBeInTheDocument();
  expect(within(row).getByRole("button", { name: "신청자 반려 취소" })).toBeInTheDocument();
});

test("목록에는 이름과 파트만 보이고, 누르면 그 사람의 정보가 상세 칸에 나옵니다", async () => {
  vi.mocked(getMembers).mockResolvedValue({ items: [{ ...member(3, "이서연"), part: "SOPRANO", cohort: 2 }, { ...member(4, "박민준"), part: "TENOR" }], page: 0, size: 1000, total: 2 });
  renderWithSession(<MemberAccountManager />, operator);
  const row = await roster().findByRole("button", { name: /^이서연/ });
  expect(row).toHaveTextContent("소프라노");
  expect(screen.queryByText("member3@example.test")).not.toBeInTheDocument();
  expect(screen.getByText("목록에서 단원을 선택하세요.")).toBeInTheDocument();
  await userEvent.click(row);
  const detail = (await screen.findByRole("heading", { name: "이서연" })).closest("article")!;
  expect(within(detail).getByText("member3@example.test")).toBeInTheDocument();
  expect(within(detail).getByText("기수", { selector: "dt" }).nextElementSibling).toHaveTextContent("2기");
  expect(row).toHaveAttribute("aria-current", "true");
  expect(screen.queryByRole("heading", { name: "박민준" })).not.toBeInTheDocument();
});

test("이름을 치면 목록이 그 글자가 든 사람만 남습니다", async () => {
  vi.mocked(getMembers).mockResolvedValue({ items: [member(3, "이서연"), member(4, "박민준")], page: 0, size: 1000, total: 2 });
  renderWithSession(<MemberAccountManager />, operator);
  await roster().findByRole("button", { name: /^박민준/ });
  await userEvent.type(screen.getByLabelText("이름 검색"), "서연");
  expect(roster().getByRole("button", { name: /^이서연/ })).toBeInTheDocument();
  expect(roster().queryByRole("button", { name: /^박민준/ })).not.toBeInTheDocument();
});

test("파트를 고르면 그 파트 단원만 남고, 없으면 그렇다고 알려 줍니다", async () => {
  vi.mocked(getMembers).mockResolvedValue({ items: [{ ...member(3, "이서연"), part: "SOPRANO" }, { ...member(4, "박민준"), part: "TENOR" }], page: 0, size: 1000, total: 2 });
  renderWithSession(<MemberAccountManager />, operator);
  await roster().findByRole("button", { name: /^박민준/ });
  await userEvent.selectOptions(screen.getByLabelText("파트로 거르기"), "TENOR");
  expect(roster().queryByRole("button", { name: /^이서연/ })).not.toBeInTheDocument();
  expect(roster().getByRole("button", { name: /^박민준/ })).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("파트로 거르기"), "BASS");
  expect(screen.getByText("조건에 맞는 단원이 없습니다.")).toBeInTheDocument();
});

test("제목은 단원 정보 관리이고 목록 절은 단원 명단입니다", async () => {
  renderWithSession(<MemberAccountManager />, operator);
  expect(screen.getByRole("heading", { name: "단원 정보 관리", level: 1 })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "단원 명단", level: 2 })).toBeInTheDocument();
  expect(await screen.findByText("등록된 단원이 없습니다.")).toBeInTheDocument();
});

test("이용 중단한 단원에게는 이용 중단 상태와 다시 초대 버튼이 보입니다", async () => {
  vi.mocked(getMembers).mockResolvedValue({ items: [{ ...member(3, "김하늘"), status: "REVOKED", googleLinked: false }], page: 0, size: 20, total: 1 });
  renderWithSession(<MemberAccountManager />, operator);
  const detail = await open("김하늘");
  expect(within(detail).getByText("이용 중단")).toBeInTheDocument();
  expect(within(detail).getByRole("button", { name: "김하늘 다시 초대" })).toBeInTheDocument();
});
