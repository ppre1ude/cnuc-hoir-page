import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberAccountManager } from "./MemberAccountManager";
import { getSession } from "../auth/session";
import { getAllowlist, getMembers, getOperatorPreapprovals, inviteMember } from "./adminMembers";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("../auth/session", () => ({ getSession: vi.fn() }));
vi.mock("./adminMembers", () => ({ getMembers: vi.fn(), inviteMember: vi.fn(),
  reissueAccountSetup: vi.fn(), revokeMember: vi.fn(), getAllowlist: vi.fn(),
  addAllowlist: vi.fn(), removeAllowlist: vi.fn(), getOperatorPreapprovals: vi.fn(),
  addOperatorPreapproval: vi.fn(), removeOperatorPreapproval: vi.fn() }));

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue({ id: 1, name: "운영진", status: "APPROVED", memberType: "ACTIVE", admin: true });
  vi.mocked(getMembers).mockResolvedValue({ items: [], page: 0, size: 20, total: 0 });
  vi.mocked(getAllowlist).mockResolvedValue({ items: [], page: 0, size: 20, total: 0 });
  vi.mocked(getOperatorPreapprovals).mockResolvedValue({ items: [], page: 0, size: 20, total: 0 });
  vi.mocked(inviteMember).mockResolvedValue({ memberId: 2, token: "temporary-private-token" });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("운영진이 단원 계정을 만들면 1회용 링크를 표시합니다", async () => {
  render(<MemberAccountManager />);
  await screen.findByText("등록된 계정이 없습니다.");
  await userEvent.type(screen.getByLabelText("이름"), "새 단원");
  await userEvent.type(within(screen.getByRole("form", { name: "1회용 링크로 초대" })).getByLabelText("구글 계정 이메일"), "member@example.org");
  await userEvent.click(screen.getByRole("button", { name: "1회용 링크 발급" }));
  expect(inviteMember).toHaveBeenCalledWith({ name: "새 단원", email: "member@example.org", memberType: "ACTIVE" });
  expect(await screen.findByLabelText("구글 계정 연결 링크")).toHaveValue(
    `${window.location.origin}/activate#token=temporary-private-token`);
});
