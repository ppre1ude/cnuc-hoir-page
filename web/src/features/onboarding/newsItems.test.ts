import { expect, it } from "vitest";
import { historyByYear, pickStage, publicNews, stageYears } from "./newsItems";

it("오래된 일부터 연도별로 묶고 날짜를 월·일로 적는다", () => {
  const years = historyByYear(publicNews);
  expect(years.map((year) => year.year)).toEqual(["2024", "2025", "2026"]);
  expect(years[2].items.map((item) => [item.monthDay, item.title])).toEqual([
    ["09. 03", "5기 단원 입단"],
    ["09. 29", "전남대학교 중앙동아리 승격"],
    ["11. 20", "제2회 정기연주회 개최"],
  ]);
});

it("원래 목록의 순서는 바꾸지 않는다", () => {
  const before = publicNews.map((item) => item.id);
  historyByYear(publicNews);
  stageYears(publicNews);
  expect(publicNews.map((item) => item.id)).toEqual(before);
});

it("무대 페이지는 최근 해부터, 한 해 안에서도 최근 일부터 둔다", () => {
  const years = stageYears(publicNews);
  expect(years.map((year) => year.year)).toEqual(["2026", "2025", "2024"]);
  expect(years[0].items.map((item) => item.id)).toEqual(["concert-2026", "central-club-2026", "fifth-members-2026"]);
});

it("주소의 행사가 없거나 틀리면 가장 최근 큰 항목을 고른다", () => {
  for (const event of [undefined, "", "없는값", "founding-2024"]) {
    expect(pickStage(publicNews, event)?.id).toBe("concert-2026");
  }
});

it("큰 항목이 여럿이면 주소의 행사를 고르고, 배열 주소는 없는 것으로 본다", () => {
  const concert = publicNews.find((item) => item.id === "concert-2026")!;
  const items = [{ ...concert, id: "old", date: "2025-01-01" }, concert];
  expect(pickStage(items, "old")?.id).toBe("old");
  expect(pickStage(items, ["old"])?.id).toBe("concert-2026");
});

it("큰 항목이 하나도 없으면 고르지 않는다", () => {
  expect(pickStage(publicNews.filter((item) => !item.stage), undefined)).toBeUndefined();
});

it("제2회 정기연주회는 사진, 사실 정보, 페이지 링크를 가진 큰 항목이다", () => {
  const stage = publicNews.find((item) => item.id === "concert-2026")!.stage!;
  expect(stage.name).toBe("제2회 정기연주회");
  expect(stage.photo.src).toMatch(/\/view\/195\.webp$/);
  expect(stage.photo.alt).toMatch(/^객석에서 본 민주마루 무대/);
  expect(stage.lead).toBeUndefined();
  expect(stage.facts).toEqual([
    { label: "일시", value: "2026. 11. 20. (금) 19:00" },
    { label: "장소", value: "전남대학교 민주마루" },
    { label: "지휘", value: "박찬영, 박예영" },
  ]);
  expect(stage.links).toEqual([
    { href: "/gallery", label: "공연 사진 보기" },
    { href: "/concert", label: "초대장 보기" },
  ]);
});
