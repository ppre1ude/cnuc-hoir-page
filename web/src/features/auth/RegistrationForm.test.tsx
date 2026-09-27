import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegistrationForm } from "./RegistrationForm";
import { applyForMembership } from "./registration";

vi.mock("./registration", () => ({ applyForMembership: vi.fn() }));

beforeEach(() => vi.mocked(applyForMembership).mockReset());
afterEach(cleanup);

test("필수 입력이 없으면 신청하지 않습니다", async () => {
  render(<RegistrationForm />);
  await userEvent.click(screen.getByRole("button", { name: "가입 신청" }));
  expect(applyForMembership).not.toHaveBeenCalled();
});

test("요청 중 중복 전송을 막고 승인 대기를 안내합니다", async () => {
  let complete!: () => void;
  vi.mocked(applyForMembership).mockReturnValue(new Promise<void>((resolve) => { complete = resolve; }));
  render(<RegistrationForm />);
  await userEvent.type(screen.getByLabelText("이메일"), "member@example.org");
  await userEvent.type(screen.getByLabelText("이름"), "신청자");
  fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "correct-horse-battery" } });
  await userEvent.click(screen.getByRole("button", { name: "가입 신청" }));
  expect(screen.getByRole("button", { name: "신청 중..." })).toBeDisabled();
  expect(applyForMembership).toHaveBeenCalledTimes(1);
  complete();
  expect(await screen.findByRole("status")).toHaveTextContent("운영진 승인을 기다려 주세요");
});
