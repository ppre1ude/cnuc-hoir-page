import { afterEach, beforeEach, expect, onTestFinished, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApplicationQueue } from "./ApplicationQueue";
import { approveApplication, getApplications, rejectApplication } from "./adminMembers";
import { ApiRequestError } from "../../lib/api";

vi.mock("./adminMembers", () => ({ getApplications: vi.fn(), approveApplication: vi.fn(), rejectApplication: vi.fn() }));

beforeEach(() => {
  vi.mocked(getApplications).mockResolvedValue({ items: [{ id: 2, name: "신청자", email: "member@example.org", status: "APPROVAL_PENDING", createdAt: "2026-09-27T00:00:00Z", part: null, cohort: null }], page: 0, size: 20, total: 1 });
  vi.mocked(approveApplication).mockResolvedValue();
  vi.mocked(rejectApplication).mockResolvedValue();
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("마지막 페이지의 마지막 신청을 처리하면 첫 페이지를 다시 불러옵니다", async () => {
  const firstPage = Array.from({ length: 20 }, (_, index) => ({
    id: index + 2, name: `${index + 1}번 신청자`, email: `member${index + 1}@example.org`,
    status: "APPROVAL_PENDING" as const, createdAt: "2026-09-27T00:00:00Z", part: null, cohort: null,
  }));
  const last = { id: 22, name: "마지막 신청자", email: "last@example.org", status: "APPROVAL_PENDING" as const, createdAt: "2026-09-27T00:00:00Z", part: null, cohort: null };
  vi.mocked(getApplications).mockImplementation(async (page = 0) => {
    if (page === 0) return { items: firstPage, page: 0, size: 20,
      total: vi.mocked(approveApplication).mock.calls.length === 0 ? 21 : 20 };
    if (vi.mocked(approveApplication).mock.calls.length === 0) return { items: [last], page: 1, size: 20, total: 21 };
    return { items: [], page: 1, size: 20, total: 20 };
  });
  render(<ApplicationQueue />);
  await screen.findByText("member1@example.org");
  await userEvent.click(screen.getByRole("button", { name: "다음" }));
  await screen.findByText("last@example.org");
  await userEvent.click(screen.getByRole("button", { name: "마지막 신청자 승인" }));
  await waitFor(() => expect(getApplications).toHaveBeenLastCalledWith(0));
  expect(await screen.findByText("member1@example.org")).toBeInTheDocument();
});

test("신청 목록에서 OB를 선택해 승인합니다", async () => {
  render(<ApplicationQueue />);
  expect(await screen.findByText("member@example.org")).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("신청자 단원 구분"), "OB");
  await userEvent.click(screen.getByRole("button", { name: "신청자 승인" }));
  expect(approveApplication).toHaveBeenCalledWith(2, "OB");
});

test("신청 목록 조회 실패 후 다시 시도하면 목록을 표시합니다", async () => {
  vi.mocked(getApplications).mockRejectedValueOnce(new Error("연결 실패"))
    .mockResolvedValueOnce({ items: [{ id: 2, name: "신청자", email: "member@example.org",
      status: "APPROVAL_PENDING", createdAt: "2026-09-27T00:00:00Z", part: null, cohort: null }], page: 0, size: 20, total: 1 });
  render(<ApplicationQueue />);
  expect(await screen.findByRole("alert")).toHaveTextContent("신청 목록을 불러오지 못했습니다");
  expect(screen.queryByText("신청 목록을 불러오는 중입니다.")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(await screen.findByText("member@example.org")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("반려는 확인 대화상자에서 취소하면 요청하지 않습니다", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  onTestFinished(() => confirm.mockRestore());
  render(<ApplicationQueue />);
  await screen.findByText("member@example.org");
  await userEvent.type(screen.getByLabelText("신청자 반려 이유"), "명단 확인 불가");
  await userEvent.click(screen.getByRole("button", { name: "신청자 반려" }));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining("신청자의 가입 신청을 반려할까요?"));
  expect(rejectApplication).not.toHaveBeenCalled();
});

test("반려 이유를 입력하고 충돌을 안내합니다", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  onTestFinished(() => confirm.mockRestore());
  vi.mocked(rejectApplication).mockRejectedValue(new ApiRequestError(409, "INVALID_MEMBER_STATE", "이미 처리됨"));
  render(<ApplicationQueue />);
  await screen.findByText("member@example.org");
  await userEvent.type(screen.getByLabelText("신청자 반려 이유"), "명단 확인 불가");
  await userEvent.click(screen.getByRole("button", { name: "신청자 반려" }));
  expect(rejectApplication).toHaveBeenCalledWith(2, "명단 확인 불가");
  expect(await screen.findByRole("alert")).toHaveTextContent("이미 처리된 신청");
});

test("신청자가 적은 파트와 기수를 이름 옆에 보이고 적지 않았으면 정보 미입력으로 표시합니다", async () => {
  vi.mocked(getApplications).mockResolvedValue({ items: [
    { id: 3, name: "홍길동", email: "hong@example.org", status: "APPROVAL_PENDING", createdAt: "2026-09-27T00:00:00Z", part: "SOPRANO", cohort: 5 },
    { id: 4, name: "Kim", email: "kim@example.org", status: "APPROVAL_PENDING", createdAt: "2026-09-27T00:00:00Z", part: null, cohort: null },
  ], page: 0, size: 20, total: 2 });
  render(<ApplicationQueue />);
  expect(await screen.findByRole("heading", { name: "홍길동 · 소프라노 5기" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Kim · 정보 미입력" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Kim 승인" }));
  expect(approveApplication).toHaveBeenCalledWith(4, "ACTIVE");
});
