import { afterEach, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Letter } from "./Letter";

afterEach(cleanup);

const greeting = { heading: "축사", name: "홍길동", role: "지도교수", photo: 1, photoAlt: "", paragraphs: ["첫 문단", "둘째 문단", "셋째 문단"] };

test("처음에는 접혀 있고, 봉인을 누르면 펼쳐졌다가 다시 누르면 접힙니다", () => {
  render(<Letter greeting={greeting} />);
  const rest = screen.getByText("둘째 문단").closest("[id]")!;
  expect(rest).toHaveAttribute("inert");

  fireEvent.click(screen.getByRole("button", { name: "편지 펼치기" }));
  expect(rest).not.toHaveAttribute("inert");

  const fold = screen.getByRole("button", { name: "편지 접기" });
  expect(fold).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(fold);
  expect(rest).toHaveAttribute("inert");
});
