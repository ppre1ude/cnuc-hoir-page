import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { publicNews, type StageItem } from "../../features/onboarding/newsItems";
import { StageDetail } from "./StageDetail";

afterEach(cleanup);

const concert = publicNews.find((item) => item.id === "concert-2026") as StageItem;

it("사진, 이름, 사실 정보, 페이지 링크를 보여 준다", () => {
  render(<StageDetail item={concert} />);
  expect(screen.getByRole("img", { name: /^객석에서 본 민주마루 무대/ })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "제2회 정기연주회" })).toBeInTheDocument();
  expect(screen.getByText("전남대학교 민주마루")).toBeInTheDocument();
  expect(screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
    ["공연 사진 보기", "/gallery"], ["초대장 보기", "/concert"],
  ]);
});

it("소개 글이 없으면 빈 문단을 두지 않는다", () => {
  const { container } = render(<StageDetail item={concert} />);
  expect(container.querySelectorAll("p")).toHaveLength(0);
});

it("소개 글이 있으면 문단으로 보인다", () => {
  render(<StageDetail item={{ ...concert, stage: { ...concert.stage, lead: "시험 소개 글" } }} />);
  expect(screen.getByText("시험 소개 글").tagName).toBe("P");
});
