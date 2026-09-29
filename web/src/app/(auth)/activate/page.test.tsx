import { StrictMode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActivatePage from "./page";
import { completeAccountSetup } from "../../../features/auth/session";

vi.mock("../../../features/auth/session", () => ({ completeAccountSetup: vi.fn().mockResolvedValue(undefined) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("효과 재실행 뒤에도 초대 토큰으로 비밀번호를 설정하고 주소에서 토큰을 지웁니다", async () => {
  window.history.replaceState(null, "", "/activate#token=once-token");
  render(<StrictMode><ActivatePage /></StrictMode>);
  expect(await screen.findByLabelText("새 비밀번호")).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("새 비밀번호"), "new-correct-horse-battery");
  await userEvent.type(screen.getByLabelText("비밀번호 확인"), "new-correct-horse-battery");
  await userEvent.click(screen.getByRole("button", { name: "비밀번호 설정" }));
  expect(completeAccountSetup).toHaveBeenCalledWith("once-token", "new-correct-horse-battery");
  expect(await screen.findByRole("status")).toHaveTextContent("로그인해 주세요");
  expect(window.location.hash).toBe("");
});
