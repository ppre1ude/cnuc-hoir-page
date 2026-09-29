import { StrictMode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import ApplicationStatusPage from "./page";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), logout: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("../../../features/auth/session", () => ({ logout: mocks.logout }));

beforeEach(() => { mocks.logout.mockReset(); mocks.replace.mockReset(); });
afterEach(() => { cleanup(); });

test("남은 세션을 한 번 로그아웃하고 로그인 화면으로 이동합니다", async () => {
  mocks.logout.mockResolvedValue(undefined);
  render(<StrictMode><ApplicationStatusPage /></StrictMode>);
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
  expect(mocks.logout).toHaveBeenCalledTimes(1);
});

test("로그아웃 요청이 실패해도 로그인 화면으로 이동합니다", async () => {
  mocks.logout.mockRejectedValue(new Error("로그아웃 실패"));
  render(<ApplicationStatusPage />);
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
});
