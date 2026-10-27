import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LoginPoster } from "./LoginPoster";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("./session", () => ({ loginWithGoogle: vi.fn() }));
vi.mock("./GoogleButton", () => ({ GoogleButton: () => <button type="button">구글로 로그인</button> }));

afterEach(() => { cleanup(); });

test("겉면에 합창단 이름, 안쪽 면에 제목과 구글 버튼과 홈 링크가 있습니다", () => {
  render(<LoginPoster />);
  expect(screen.getByText("전남대학교 합창단")).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("단원 로그인");
  expect(screen.getByRole("button", { name: "구글로 로그인" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "합창단 홈으로" })).toHaveAttribute("href", "/");
});
