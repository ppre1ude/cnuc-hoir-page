import { StrictMode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActivatePage from "./page";
import { completeAccountSetup } from "../../../features/auth/session";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("../../../features/auth/GoogleButton", () => ({ GoogleButton: ({ onCredential }: { onCredential: (value: string) => void }) =>
  <button onClick={() => onCredential("google-credential")}>구글 계정 연결</button> }));
vi.mock("../../../features/auth/session", () => ({ completeAccountSetup: vi.fn().mockResolvedValue({ status: "APPROVED" }) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("효과 재실행 뒤에도 초대 토큰으로 구글 계정을 연결하고 주소에서 토큰을 지웁니다", async () => {
  window.history.replaceState(null, "", "/activate#token=once-token");
  render(<StrictMode><ActivatePage /></StrictMode>);
  await userEvent.click(await screen.findByRole("button", { name: "구글 계정 연결" }));
  expect(completeAccountSetup).toHaveBeenCalledWith("once-token", "google-credential");
  expect(replace).toHaveBeenCalledWith("/dashboard");
  expect(window.location.hash).toBe("");
});
