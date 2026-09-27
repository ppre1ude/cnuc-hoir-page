import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiRequestError } from "../../../lib/api";
import { verifyEmail } from "../../../features/auth/registration";
import VerifyEmailPage from "./page";

vi.mock("../../../features/auth/registration", () => ({ verifyEmail: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.mocked(verifyEmail).mockReset();
});

test.each([
  ["서버 오류", new ApiRequestError(503, "REQUEST_FAILED", "서비스 오류")],
  ["CSRF 오류", new ApiRequestError(403, "CSRF_UNAVAILABLE", "요청 준비 오류")],
  ["네트워크 오류", new Error("연결 실패")],
])("%s에도 URL 토큰을 제거하고 같은 토큰으로 재시도합니다", async (_case, failure) => {
  window.history.replaceState(null, "", "/verify-email#token=temporary-token");
  vi.mocked(verifyEmail)
    .mockRejectedValueOnce(failure)
    .mockResolvedValueOnce(undefined);

  render(<VerifyEmailPage />);
  expect(await screen.findByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  expect(window.location.hash).toBe("");
  expect(verifyEmail).toHaveBeenCalledWith("temporary-token");
  await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(await screen.findByRole("status")).toHaveTextContent("운영진 승인을 기다려 주세요");
  expect(verifyEmail).toHaveBeenCalledTimes(2);
});

test("확인 링크가 사용되었을 때만 만료 안내를 표시합니다", async () => {
  window.history.replaceState(null, "", "/verify-email#token=used-token");
  vi.mocked(verifyEmail).mockRejectedValueOnce(
    new ApiRequestError(409, "INVALID_VERIFICATION_TOKEN", "사용할 수 없는 확인 링크입니다."),
  );
  render(<VerifyEmailPage />);
  expect(await screen.findByRole("status")).toHaveTextContent("만료되었거나 이미 사용되었습니다");
  expect(screen.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument();
  expect(window.location.hash).toBe("");
});
