import { StrictMode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResetPasswordPage from "./page";
import { confirmPasswordReset, requestPasswordReset } from "../../../features/auth/session";

vi.mock("../../../features/auth/session", () => ({
  confirmPasswordReset: vi.fn().mockResolvedValue(undefined),
  requestPasswordReset: vi.fn(),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("효과 재실행 뒤에도 해시 토큰으로 비밀번호를 변경합니다", async () => {
  window.history.replaceState(null, "", "/reset-password#token=once-token");
  render(<StrictMode><ResetPasswordPage /></StrictMode>);
  expect(await screen.findByLabelText("새 비밀번호")).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("새 비밀번호"), "new-correct-horse-battery");
  await userEvent.click(screen.getByRole("button", { name: "비밀번호 변경" }));
  expect(confirmPasswordReset).toHaveBeenCalledWith("once-token", "new-correct-horse-battery");
  expect(requestPasswordReset).not.toHaveBeenCalled();
  expect(window.location.hash).toBe("");
});
