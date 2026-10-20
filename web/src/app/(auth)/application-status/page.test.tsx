import { StrictMode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiRequestError } from "../../../lib/api";
import ApplicationStatusPage from "./page";

const mocks = vi.hoisted(() => {
  const replace = vi.fn();
  return { replace, router: { replace }, logout: vi.fn(), getSession: vi.fn(), saveApplication: vi.fn() };
});
// 실제 라우터처럼 렌더마다 같은 객체를 돌려줘야 세션을 다시 불러오지 않습니다.
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("../../../features/auth/session", () => ({ logout: mocks.logout, getSession: mocks.getSession, saveApplication: mocks.saveApplication }));

beforeEach(() => { mocks.logout.mockReset(); mocks.replace.mockReset(); mocks.getSession.mockReset(); mocks.saveApplication.mockReset(); });
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
  const account = await screen.findByRole("region", { name: "로그인한 계정" });
  expect(account).toHaveTextContent("other@gmail.com");
  expect(account).toHaveTextContent("운영진에게 알려 준 구글 계정이 아니면 로그아웃한 뒤 그 계정으로 다시 로그인해 주세요.");
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

test("승인 대기 중이면 가입 정보를 채워 저장하고 계속 고칠 수 있습니다", async () => {
  mocks.getSession.mockResolvedValue({ id: 1, name: "Gildong Hong", status: "APPROVAL_PENDING", part: null, cohort: null });
  mocks.saveApplication.mockResolvedValue({ id: 1, name: "홍길동", status: "APPROVAL_PENDING", part: "SOPRANO", cohort: 5 });
  render(<ApplicationStatusPage />);
  expect(await screen.findByRole("heading", { name: "가입 정보" })).toBeInTheDocument();
  const name = screen.getByLabelText("이름");
  expect(name).toHaveValue("Gildong Hong");
  expect(screen.getByLabelText("기수")).toHaveValue(null);
  expect(screen.getByLabelText("파트")).toHaveValue("");

  await userEvent.clear(name);
  await userEvent.type(name, "홍길동");
  await userEvent.type(screen.getByLabelText("기수"), "5");
  await userEvent.selectOptions(screen.getByLabelText("파트"), "소프라노");
  await userEvent.click(screen.getByRole("button", { name: "가입 정보 저장" }));

  expect(mocks.saveApplication).toHaveBeenCalledWith({ name: "홍길동", cohort: 5, part: "SOPRANO" });
  expect(await screen.findByRole("status")).toHaveTextContent("저장했습니다. 운영진이 확인하면 승인됩니다.");
  expect(screen.getByText("홍길동님의 계정 상태입니다.")).toBeInTheDocument();
  expect(screen.getByLabelText("이름")).toBeEnabled();
  expect(screen.getByRole("button", { name: "가입 정보 저장" })).toBeEnabled();
});

test("이미 저장한 기수와 파트를 채워 보여 줍니다", async () => {
  mocks.getSession.mockResolvedValue({ id: 1, name: "김민지", status: "APPROVAL_PENDING", part: "TENOR", cohort: 12 });
  render(<ApplicationStatusPage />);
  expect(await screen.findByLabelText("이름")).toHaveValue("김민지");
  expect(screen.getByLabelText("기수")).toHaveValue(12);
  expect(screen.getByLabelText("파트")).toHaveValue("TENOR");
});

test("저장하는 동안 버튼을 막고 실패하면 서버 안내를 보여 줍니다", async () => {
  mocks.getSession.mockResolvedValue({ id: 1, name: "홍길동", status: "APPROVAL_PENDING", part: "ALTO", cohort: 3 });
  let fail: (error: Error) => void = () => {};
  mocks.saveApplication.mockReturnValue(new Promise((_, reject) => { fail = reject; }));
  render(<ApplicationStatusPage />);
  await userEvent.click(await screen.findByRole("button", { name: "가입 정보 저장" }));
  expect(screen.getByRole("button", { name: "가입 정보 저장" })).toBeDisabled();
  fail(new ApiRequestError(409, "APPLICATION_CLOSED", "승인 대기 중일 때만 가입 정보를 고칠 수 있습니다."));
  expect(await screen.findByRole("alert")).toHaveTextContent("승인 대기 중일 때만 가입 정보를 고칠 수 있습니다.");
  expect(screen.getByRole("button", { name: "가입 정보 저장" })).toBeEnabled();
});

test.each(["REJECTED", "INVITED"])("%s 상태에서는 가입 정보 양식을 보여 주지 않습니다", async (status) => {
  mocks.getSession.mockResolvedValue({ id: 1, name: "신청자", status });
  render(<ApplicationStatusPage />);
  expect(await screen.findByRole("button", { name: "로그아웃" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "가입 정보" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("기수")).not.toBeInTheDocument();
});
