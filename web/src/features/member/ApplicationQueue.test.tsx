import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApplicationQueue } from "./ApplicationQueue";
import { approveApplication, getApplications, rejectApplication } from "./adminMembers";
import { getSession } from "../auth/session";
import { ApiRequestError } from "../../lib/api";

vi.mock("./adminMembers", () => ({ getApplications: vi.fn(), approveApplication: vi.fn(), rejectApplication: vi.fn() }));
vi.mock("../auth/session", () => ({ getSession: vi.fn() }));

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue({ id: 1, name: "운영진", status: "APPROVED", memberType: "ACTIVE", admin: true });
  vi.mocked(getApplications).mockResolvedValue({ items: [{ id: 2, name: "신청자", email: "member@example.org", status: "APPROVAL_PENDING", createdAt: "2026-09-27T00:00:00Z" }], page: 0, size: 20, total: 1 });
  vi.mocked(approveApplication).mockResolvedValue();
  vi.mocked(rejectApplication).mockResolvedValue();
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("신청 목록에서 OB를 선택해 승인합니다", async () => {
  render(<ApplicationQueue />);
  expect(await screen.findByText("member@example.org")).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("신청자 단원 구분"), "OB");
  await userEvent.click(screen.getByRole("button", { name: "신청자 승인" }));
  expect(approveApplication).toHaveBeenCalledWith(2, "OB");
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
