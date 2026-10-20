import { StrictMode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApplicationStatusPage from "./page";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), logout: vi.fn(), getSession: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("../../../features/auth/session", () => ({ logout: mocks.logout, getSession: mocks.getSession }));

beforeEach(() => { mocks.logout.mockReset(); mocks.replace.mockReset(); mocks.getSession.mockReset(); });
afterEach(() => { cleanup(); });

test("승인 대기 상태를 표시하고 세션을 유지합니다", async () => {
  mocks.getSession.mockResolvedValue({ id: 1, name: "신청자", status: "APPROVAL_PENDING" });
  render(<StrictMode><ApplicationStatusPage /></StrictMode>);
  expect(await screen.findByText("가입 승인 대기 중입니다")).toBeInTheDocument();
  expect(mocks.logout).not.toHaveBeenCalled();
});

test("직접 로그아웃하면 로그인 화면으로 이동합니다", async () => {
  mocks.getSession.mockResolvedValue({ id: 1, name: "신청자", status: "REJECTED" });
  mocks.logout.mockResolvedValue(undefined);
  render(<ApplicationStatusPage />);
  await userEvent.click(await screen.findByRole("button", { name: "로그아웃" }));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
});

test.each(["APPROVAL_PENDING", "REJECTED", "INVITED"])("%s 상태에서 로그인한 구글 계정과 계정을 바꾸는 방법을 보여 줍니다", async (status) => {
  mocks.getSession.mockResolvedValue({ id: 1, name: "신청자", email: "other@gmail.com", status });
  render(<ApplicationStatusPage />);
  expect(await screen.findByText(/other@gmail\.com 계정으로 로그인했습니다/)).toHaveTextContent("로그아웃한 뒤 그 계정으로 다시 로그인해 주세요");
});

test("승인 대기 중 다시 로그인해 확인을 누르면 로그아웃하고 로그인 화면으로 갑니다", async () => {
  mocks.getSession.mockResolvedValue({ id: 1, name: "신청자", status: "APPROVAL_PENDING" });
  mocks.logout.mockResolvedValue(undefined);
  render(<ApplicationStatusPage />);
  expect(await screen.findByText("운영진이 승인한 뒤 다시 로그인하면 결과를 확인할 수 있습니다.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "다시 로그인해 확인" }));
  expect(mocks.logout).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
});

test("승인 대기 화면은 Gmail이 아닌 구글 계정이 운영진 승인을 기다린다고 알려 줍니다", async () => {
  mocks.getSession.mockResolvedValue({ id: 1, name: "신청자", email: "member@naver.com", status: "APPROVAL_PENDING" });
  render(<ApplicationStatusPage />);
  expect(await screen.findByText(/Gmail이 아닌 주소로 만든 구글 계정은 자동 승인 명단에 있어도 운영진이 직접 승인해야 합니다/)).toBeInTheDocument();
});
