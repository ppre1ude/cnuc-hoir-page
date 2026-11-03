import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { ApprovalReminder } from "./ApprovalReminder";
import { getApplications } from "./adminMembers";
import { onWriteCompleted } from "../../lib/api";
import { pollWhileVisible } from "../../lib/poll";
import { renderWithSession, sessionFixture } from "../../test/session";

const nav = vi.hoisted(() => ({ pathname: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("./adminMembers", () => ({ getApplications: vi.fn() }));
vi.mock("../../lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../lib/api")>(), onWriteCompleted: vi.fn(() => () => undefined),
}));
vi.mock("../../lib/poll", () => ({ pollWhileVisible: vi.fn(() => () => undefined) }));

const approver = sessionFixture({ permissions: ["APPROVE_APPLICATIONS"] });
const page = (total: number) => ({ items: [], page: 0, size: 20, total });
const region = () => screen.findByRole("region", { name: "가입 승인 알림" });

beforeEach(() => { vi.mocked(getApplications).mockResolvedValue(page(3)); });
afterEach(() => { cleanup(); vi.clearAllMocks(); nav.pathname = "/dashboard"; });

test("승인 대기가 있으면 인원과 승인하러 가기 링크를 보입니다", async () => {
  renderWithSession(<ApprovalReminder />, approver);
  expect(await region()).toHaveTextContent("가입 승인을 기다리는 단원이 3명 있어요.");
  expect(screen.getByRole("link", { name: "승인하러 가기" })).toHaveAttribute("href", "/admin/applications");
});

test("대기가 0명이면 아무것도 그리지 않습니다", async () => {
  vi.mocked(getApplications).mockResolvedValue(page(0));
  const { container } = renderWithSession(<ApprovalReminder />, approver);
  await waitFor(() => expect(getApplications).toHaveBeenCalledTimes(1));
  await act(async () => undefined);
  expect(container).toBeEmptyDOMElement();
});

test("권한이 없으면 요청도 보내지 않고 그리지 않습니다", () => {
  const { container } = renderWithSession(<ApprovalReminder />, sessionFixture());
  expect(getApplications).not.toHaveBeenCalled();
  expect(container).toBeEmptyDOMElement();
});

test.each(["/admin/applications", "/events/12/check-in", "/admin/events/12/attendance"])(
  "%s에서는 숨기고 요청도 보내지 않습니다", (pathname) => {
    nav.pathname = pathname;
    const { container } = renderWithSession(<ApprovalReminder />, approver);
    expect(getApplications).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

test("일정 상세에서는 보입니다", async () => {
  nav.pathname = "/events/12";
  renderWithSession(<ApprovalReminder />, approver);
  expect(await region()).toBeInTheDocument();
});

test("요청이 실패하면 조용히 비워 둡니다", async () => {
  vi.mocked(getApplications).mockRejectedValue(new Error("서버 꺼짐"));
  const { container } = renderWithSession(<ApprovalReminder />, approver);
  await waitFor(() => expect(getApplications).toHaveBeenCalledTimes(1));
  await act(async () => undefined);
  expect(container).toBeEmptyDOMElement();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("쓰기가 끝나면 다시 받아 숫자를 바꿉니다", async () => {
  renderWithSession(<ApprovalReminder />, approver);
  await region();
  vi.mocked(getApplications).mockResolvedValue(page(1));
  const [listener] = vi.mocked(onWriteCompleted).mock.calls[0];
  await act(async () => { listener(); });
  expect(await screen.findByText("가입 승인을 기다리는 단원이 1명 있어요.")).toBeInTheDocument();
});

test("경로가 바뀌면 다시 받습니다", async () => {
  const { rerender } = renderWithSession(<ApprovalReminder />, approver);
  await region();
  nav.pathname = "/notices";
  rerender(<ApprovalReminder />);
  await waitFor(() => expect(getApplications).toHaveBeenCalledTimes(2));
});

test("1분 주기 요청은 기억을 건너뜁니다", async () => {
  renderWithSession(<ApprovalReminder />, approver);
  await region();
  const [load, interval] = vi.mocked(pollWhileVisible).mock.calls[0];
  expect(interval).toBe(60_000);
  await act(async () => { await load(); });
  expect(getApplications).toHaveBeenLastCalledWith(0, { cache: "reload" });
});

test("느린 응답보다 늦게 시작한 요청이 먼저 끝나면 늦은 응답은 버립니다", async () => {
  let resolveSlow!: (value: ReturnType<typeof page>) => void;
  vi.mocked(getApplications)
    .mockReturnValueOnce(new Promise((done) => { resolveSlow = done; }))
    .mockResolvedValueOnce(page(1));
  renderWithSession(<ApprovalReminder />, approver);
  const [listener] = vi.mocked(onWriteCompleted).mock.calls[0];
  await act(async () => { listener(); });
  expect(await screen.findByText("가입 승인을 기다리는 단원이 1명 있어요.")).toBeInTheDocument();
  await act(async () => { resolveSlow(page(3)); });
  expect(screen.getByText("가입 승인을 기다리는 단원이 1명 있어요.")).toBeInTheDocument();
});
