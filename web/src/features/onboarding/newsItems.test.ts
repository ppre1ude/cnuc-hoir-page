import { expect, it } from "vitest";
import { historyByYear, publicNews } from "./newsItems";

it("오래된 일부터 연도별로 묶고 날짜를 월·일로 적는다", () => {
  const years = historyByYear(publicNews);
  expect(years.map((year) => year.year)).toEqual(["2024", "2025", "2026"]);
  expect(years[2].items.map((item) => [item.monthDay, item.title])).toEqual([
    ["09. 03", "5기 단원 입단"],
    ["09. 29", "전남대학교 중앙동아리 승격"],
  ]);
});

it("원래 목록의 순서는 바꾸지 않는다", () => {
  const before = publicNews.map((item) => item.id);
  historyByYear(publicNews);
  expect(publicNews.map((item) => item.id)).toEqual(before);
});
