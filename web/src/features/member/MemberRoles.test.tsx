import { afterEach, expect, onTestFinished, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberFacts, MemberRoles } from "./MemberRoles";
import { assignMemberRole, removeMemberRole, updateMemberProfile, type MemberItem } from "./adminMembers";
import type { MemberSession } from "../auth/session";

vi.mock("./adminMembers", () => ({ assignMemberRole: vi.fn(), removeMemberRole: vi.fn(), updateMemberProfile: vi.fn(), setSiteAdmin: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const president: MemberSession = { id: 1, name: "단장", status: "APPROVED", memberType: "ACTIVE", admin: false,
  permissions: ["MANAGE_ROLES", "REVOKE_ACCESS", "MANAGE_ALLOWLIST", "APPROVE_APPLICATIONS", "MANAGE_EVENTS", "VIEW_MEMBERS", "VIEW_MINUTES"] };
const item: MemberItem = { id: 7, name: "단원", email: "member@example.test", status: "APPROVED", memberType: "ACTIVE",
  admin: false, googleLinked: true, createdAt: "2026-09-01T00:00:00Z", part: "ALTO", cohort: 2,
  roles: [{ id: 11, role: "SECTION_LEAD", department: null, unit: null, part: "ALTO" }] };

test("직책을 한글로 보여 주고 해제합니다", async () => {
  vi.mocked(removeMemberRole).mockResolvedValue(undefined);
  const onChanged = vi.fn();
  render(<><MemberFacts item={item} /><MemberRoles item={item} session={president} onChanged={onChanged} /></>);
  expect(screen.getByText("알토수석")).toBeInTheDocument();
  expect(screen.getByText("2기")).toBeInTheDocument();
  expect(screen.getByText("단원 정보 수정").closest("details")).not.toHaveAttribute("open");
  await userEvent.click(screen.getByRole("button", { name: "단원 알토수석 해제" }));
  expect(removeMemberRole).toHaveBeenCalledWith(7, 11);
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
});

test("부원은 부서와 계를 함께 골라 추가합니다", async () => {
  vi.mocked(assignMemberRole).mockResolvedValue({ id: 12, role: "DEPARTMENT_MEMBER", department: "MANAGEMENT", unit: "SCORES", part: null });
  render(<MemberRoles item={item} session={president} onChanged={vi.fn()} />);
  expect(screen.getByRole("button", { name: "단원 직책 추가" })).toBeDisabled();
  await userEvent.selectOptions(screen.getByLabelText("추가할 직책"), "DEPARTMENT_MEMBER");
  await userEvent.selectOptions(screen.getByLabelText("부서"), "MANAGEMENT");
  await userEvent.selectOptions(screen.getByLabelText("계"), "SCORES");
  await userEvent.click(screen.getByRole("button", { name: "단원 직책 추가" }));
  expect(assignMemberRole).toHaveBeenCalledWith(7, { role: "DEPARTMENT_MEMBER", department: "MANAGEMENT", unit: "SCORES" });
});

test("단장은 부단장 직책을 고를 수 없고 사이트 관리자 전환도 보이지 않습니다", () => {
  render(<MemberRoles item={item} session={president} onChanged={vi.fn()} />);
  const options = [...screen.getByLabelText<HTMLSelectElement>("추가할 직책").options].map((option) => option.value);
  expect(options).not.toContain("VICE_PRESIDENT");
  expect(options).toContain("TREASURER");
  expect(screen.queryByRole("button", { name: /사이트 관리자/ })).not.toBeInTheDocument();
});

test("파트와 기수를 저장합니다", async () => {
  vi.mocked(updateMemberProfile).mockResolvedValue(undefined);
  render(<MemberRoles item={item} session={president} onChanged={vi.fn()} />);
  await userEvent.selectOptions(screen.getByLabelText("파트"), "TENOR");
  await userEvent.clear(screen.getByLabelText("기수"));
  await userEvent.type(screen.getByLabelText("기수"), "3");
  await userEvent.click(screen.getByRole("button", { name: "단원 정보 저장" }));
  expect(updateMemberProfile).toHaveBeenCalledWith(7, { part: "TENOR", cohort: 3 });
});

test("구분이 비어 있는 승인 계정은 미지정으로 보이고, 파트만 저장하면 구분을 바꾸지 않습니다", async () => {
  vi.mocked(updateMemberProfile).mockResolvedValue(undefined);
  render(<MemberRoles item={{ ...item, memberType: null, roles: [] }} session={president} onChanged={vi.fn()} />);
  expect(screen.getByLabelText("단원 구분")).toHaveDisplayValue("미지정");
  await userEvent.selectOptions(screen.getByLabelText("파트"), "TENOR");
  await userEvent.click(screen.getByRole("button", { name: "단원 정보 저장" }));
  expect(updateMemberProfile).toHaveBeenLastCalledWith(7, { part: "TENOR", cohort: 2 });
});

test("직책이 있는 단원을 OB로 바꾸기 전에 직책 해제를 확인합니다", async () => {
  vi.mocked(updateMemberProfile).mockResolvedValue(undefined);
  const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
  onTestFinished(() => confirm.mockRestore());
  render(<MemberRoles item={item} session={president} onChanged={vi.fn()} />);
  await userEvent.selectOptions(screen.getByLabelText("단원 구분"), "OB");
  await userEvent.click(screen.getByRole("button", { name: "단원 정보 저장" }));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining("직책(알토수석)이 모두 해제됩니다"));
  expect(updateMemberProfile).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "단원 정보 저장" }));
  expect(updateMemberProfile).toHaveBeenCalledWith(7, { part: "ALTO", cohort: 2, memberType: "OB" });
});

test("직책이 없으면 확인 없이 OB로 바꾸고, 승인 전 계정에는 단원 구분을 보내지 않습니다", async () => {
  vi.mocked(updateMemberProfile).mockResolvedValue(undefined);
  const confirm = vi.spyOn(window, "confirm");
  onTestFinished(() => confirm.mockRestore());
  const { unmount } = render(<MemberRoles item={{ ...item, roles: [] }} session={president} onChanged={vi.fn()} />);
  await userEvent.selectOptions(screen.getByLabelText("단원 구분"), "OB");
  await userEvent.click(screen.getByRole("button", { name: "단원 정보 저장" }));
  expect(confirm).not.toHaveBeenCalled();
  expect(updateMemberProfile).toHaveBeenLastCalledWith(7, { part: "ALTO", cohort: 2, memberType: "OB" });
  unmount();

  render(<MemberRoles item={{ ...item, status: "APPROVAL_PENDING", memberType: null, roles: [] }} session={president} onChanged={vi.fn()} />);
  expect(screen.queryByLabelText("단원 구분")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "단원 정보 저장" }));
  expect(updateMemberProfile).toHaveBeenLastCalledWith(7, { part: "ALTO", cohort: 2 });
});

test("직책을 줄 수 없는 이유를 그 자리에 적고, 열어 달라고 하면 단원 정보 수정을 펼칩니다", () => {
  const { unmount } = render(<MemberRoles item={{ ...item, status: "APPROVAL_PENDING", memberType: null, roles: [] }} session={president} open onChanged={vi.fn()} />);
  expect(screen.getByText("단원 정보 수정").closest("details")).toHaveAttribute("open");
  expect(screen.queryByLabelText("추가할 직책")).not.toBeInTheDocument();
  expect(screen.getByText("가입을 승인하면 직책을 줄 수 있습니다.")).toBeInTheDocument();
  unmount();
  render(<MemberRoles item={{ ...item, memberType: "OB", roles: [] }} session={president} onChanged={vi.fn()} />);
  expect(screen.queryByLabelText("추가할 직책")).not.toBeInTheDocument();
  expect(screen.getByText(/OB는 직책을 가질 수 없습니다/)).toBeInTheDocument();
});
