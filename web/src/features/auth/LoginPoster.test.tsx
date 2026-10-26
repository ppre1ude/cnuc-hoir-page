import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LoginPoster } from "./LoginPoster";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("./session", () => ({ loginWithGoogle: vi.fn() }));
vi.mock("./GoogleButton", () => ({ GoogleButton: () => <button type="button">구글로 로그인</button> }));

// jsdom에는 캔버스가 없습니다. 심벌은 대체 이미지로 보여야 합니다.
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test("제목, 구글 버튼, 홈 링크가 있고 캔버스를 못 쓰면 심벌 이미지를 대신 보입니다", () => {
  render(<LoginPoster />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("단원 로그인");
  expect(screen.getByRole("button", { name: "구글로 로그인" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "합창단 홈으로" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("img", { name: "전남대학교 합창단" })).toHaveAttribute("data-sand-mark", "fallback");
});
