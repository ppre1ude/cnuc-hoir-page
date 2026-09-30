import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";
import { loginWithGoogle } from "./session";
import { ApiRequestError } from "../../lib/api";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("./session", () => ({ loginWithGoogle: vi.fn() }));
vi.mock("./GoogleButton", () => ({ GoogleButton: ({ onCredential }: { onCredential: (value: string) => void }) =>
  <button onClick={() => onCredential("google-credential")}>구글로 로그인</button> }));

beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

async function fill() {
  await userEvent.click(screen.getByRole("button", { name: "구글로 로그인" }));
}

test("구글 인증 오류를 안내합니다", async () => {
  vi.mocked(loginWithGoogle).mockRejectedValue(new ApiRequestError(401, "INVALID_GOOGLE_CREDENTIAL", "구글 인증 실패"));
  render(<LoginForm />);
  await fill();
  expect(await screen.findByRole("alert")).toHaveTextContent("구글 인증 실패");
});

test("승인 회원을 대시보드로 이동합니다", async () => {
  vi.mocked(loginWithGoogle).mockResolvedValue({ id: 1, name: "단원", status: "APPROVED", memberType: "ACTIVE", admin: false });
  render(<LoginForm />);
  await fill();
  expect(replace).toHaveBeenCalledWith("/dashboard");
});

test("승인 대기 회원을 상태 화면으로 이동합니다", async () => {
  vi.mocked(loginWithGoogle).mockResolvedValue({ id: 2, name: "신청자", status: "APPROVAL_PENDING", memberType: null, admin: false });
  render(<LoginForm />);
  await fill();
  expect(replace).toHaveBeenCalledWith("/application-status");
});
