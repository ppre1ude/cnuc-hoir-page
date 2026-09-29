import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";
import { getSession, login } from "./session";
import { ApiRequestError } from "../../lib/api";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("./session", () => ({ login: vi.fn(), getSession: vi.fn() }));

beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

async function fill() {
  await userEvent.type(screen.getByLabelText("이메일"), "member@example.org");
  await userEvent.type(screen.getByLabelText("비밀번호"), "correct-horse-battery");
  await userEvent.click(screen.getByRole("button", { name: "로그인" }));
}

test("잘못된 자격 증명을 안내합니다", async () => {
  vi.mocked(login).mockRejectedValue(new ApiRequestError(401, "INVALID_CREDENTIALS", "실패"));
  render(<LoginForm />);
  await fill();
  expect(await screen.findByRole("alert")).toHaveTextContent("이메일 또는 비밀번호");
});

test("승인 회원을 대시보드로 이동합니다", async () => {
  vi.mocked(login).mockResolvedValue();
  vi.mocked(getSession).mockResolvedValue({ id: 1, name: "단원", status: "APPROVED", memberType: "ACTIVE", admin: false });
  render(<LoginForm />);
  await fill();
  expect(replace).toHaveBeenCalledWith("/dashboard");
  expect(screen.getByText("계정 발급이나 비밀번호 재설정은 운영진에게 요청해 주세요.")).toBeInTheDocument();
});
