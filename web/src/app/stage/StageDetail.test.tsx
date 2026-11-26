import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { publicNews, type DetailedItem } from "../../features/onboarding/newsItems";
import { StageDetail } from "./StageDetail";

afterEach(cleanup);

const second = publicNews.find((item) => item.id === "concert-2026") as DetailedItem;
const first = publicNews.find((item) => item.id === "concert-2025") as DetailedItem;

it("사진, 이름, 사실 정보, 페이지 링크를 보여 준다", () => {
  render(<StageDetail item={second} />);
  expect(screen.getByRole("img", { name: /^객석에서 본 민주마루 무대/ })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "제2회 정기연주회" })).toBeInTheDocument();
  expect(screen.getByText("전남대학교 민주마루")).toBeInTheDocument();
  expect(screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
    ["공연 사진 보기", "/gallery"], ["초대장 보기", "/concert"],
  ]);
});

it("사진과 페이지가 없는 행사는 그 자리를 비워 두지 않는다", () => {
  const { container } = render(<StageDetail item={first} />);
  expect(screen.getByRole("heading", { name: "제1회 정기연주회" })).toBeInTheDocument();
  expect(screen.getByText("전남대학교 예술대학 3호관 예향홀")).toBeInTheDocument();
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.queryAllByRole("link")).toHaveLength(0);
  expect(container.querySelectorAll("p")).toHaveLength(0);
});

it("소개 글이 있으면 문단으로 보인다", () => {
  render(<StageDetail item={{ ...second, detail: { ...second.detail, lead: "시험 소개 글" } }} />);
  expect(screen.getByText("시험 소개 글").tagName).toBe("P");
});
