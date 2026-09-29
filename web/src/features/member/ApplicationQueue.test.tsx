import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApplicationQueue } from "./ApplicationQueue";
import { approveApplication, getApplications, rejectApplication } from "./adminMembers";
import { getSession } from "../auth/session";
import { ApiRequestError } from "../../lib/api";

const replace = vi.fn();
const router = { replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("./adminMembers", () => ({ getApplications: vi.fn(), approveApplication: vi.fn(), rejectApplication: vi.fn() }));
vi.mock("../auth/session", () => ({ getSession: vi.fn() }));

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue({ id: 1, name: "운영진", status: "APPROVED", memberType: "ACTIVE", admin: true });
  vi.mocked(getApplications).mockResolvedValue({ items: [{ id: 2, name: "신청자", email: "member@example.org", status: "APPROVAL_PENDING", createdAt: "2026-09-27T00:00:00Z" }], page: 0, size: 20, total: 1 });
  vi.mocked(approveApplication).mockResolvedValue();
  vi.mocked(rejectApplication).mockResolvedValue();
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("로그인 세션이 없으면 로그인 화면으로 이동합니다", async () => {
  vi.mocked(getSession).mockRejectedValue(new ApiRequestError(401, "UNAUTHENTICATED", "로그인이 필요합니다."));
  render(<ApplicationQueue />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  expect(getApplications).not.toHaveBeenCalled();
});

test("신청 처리 중 세션이 만료되어도 로그인 화면으로 이동합니다", async () => {
  vi.mocked(approveApplication).mockRejectedValue(new ApiRequestError(401, "SESSION_EXPIRED", "다시 로그인해 주세요."));
  render(<ApplicationQueue />);
  await screen.findByText("member@example.org");
  await userEvent.click(screen.getByRole("button", { name: "신청자 승인" }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
});

test("마지막 페이지의 마지막 신청을 처리하면 첫 페이지를 다시 불러옵니다", async () => {
  const firstPage = Array.from({ length: 20 }, (_, index) => ({
    id: index + 2, name: `${index + 1}번 신청자`, email: `member${index + 1}@example.org`,
    status: "APPROVAL_PENDING" as const, createdAt: "2026-09-27T00:00:00Z",
  }));
  const last = { id: 22, name: "마지막 신청자", email: "last@example.org", status: "APPROVAL_PENDING" as const, createdAt: "2026-09-27T00:00:00Z" };
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
      status: "APPROVAL_PENDING", createdAt: "2026-09-27T00:00:00Z" }], page: 0, size: 20, total: 1 });
  render(<ApplicationQueue />);
  expect(await screen.findByRole("alert")).toHaveTextContent("신청 목록을 불러오지 못했습니다");
  expect(screen.queryByText("신청 목록을 불러오는 중입니다.")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(await screen.findByText("member@example.org")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("반려 이유를 입력하고 충돌을 안내합니다", async () => {
  vi.mocked(rejectApplication).mockRejectedValue(new ApiRequestError(409, "INVALID_MEMBER_STATE", "이미 처리됨"));
  render(<ApplicationQueue />);
  await screen.findByText("member@example.org");
  await userEvent.type(screen.getByLabelText("신청자 반려 이유"), "명단 확인 불가");
  await userEvent.click(screen.getByRole("button", { name: "신청자 반려" }));
  expect(rejectApplication).toHaveBeenCalledWith(2, "명단 확인 불가");
  expect(await screen.findByRole("alert")).toHaveTextContent("이미 처리된 신청");
});
