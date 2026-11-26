import { expect, it } from "vitest";
import { historyByYear, newestDetailed, publicNews, stageYears } from "./newsItems";

it("오래된 일부터 연도별로 묶고 날짜를 월·일로 적는다", () => {
  const years = historyByYear(publicNews);
  expect(years.map((year) => year.year)).toEqual(["2024", "2025", "2026"]);
  expect(years[2].items.map((item) => [item.monthDay, item.title])).toEqual([
    ["09. 03", "5기 단원 입단"],
    ["09. 29", "전남대학교 중앙동아리 승격"],
    ["11. 20", "제2회 정기연주회"],
  ]);
});

it("원래 목록의 순서는 바꾸지 않는다", () => {
  const before = publicNews.map((item) => item.id);
  historyByYear(publicNews);
  stageYears(publicNews);
  expect(publicNews.map((item) => item.id)).toEqual(before);
});

it("행사 이름은 한 칸에만 두고 '개최'를 붙이지 않는다", () => {
  expect(publicNews.filter((item) => item.title.includes("개최"))).toEqual([]);
  expect(publicNews.find((item) => item.id === "concert-2025")?.title).toBe("제1회 정기연주회");
});

it("무대 페이지는 최근 해부터, 한 해 안에서도 최근 일부터 둔다", () => {
  const years = stageYears(publicNews);
  expect(years.map((year) => year.year)).toEqual(["2026", "2025", "2024"]);
  expect(years[0].items.map((item) => item.id)).toEqual(["concert-2026", "central-club-2026", "fifth-members-2026"]);
});

it("처음에는 세부 내용이 있는 가장 최근 행사를 고른다", () => {
  expect(newestDetailed(publicNews)?.id).toBe("concert-2026");
  expect(newestDetailed([...publicNews].reverse())?.id).toBe("concert-2026");
  expect(newestDetailed(publicNews.filter((item) => !item.detail))).toBeUndefined();
});

it("제2회 정기연주회는 사진, 사실 정보, 페이지 링크를 가진다", () => {
  const detail = publicNews.find((item) => item.id === "concert-2026")!.detail!;
  expect(detail.photo?.src).toMatch(/\/view\/195\.webp$/);
  expect(detail.photo?.alt).toMatch(/^객석에서 본 민주마루 무대/);
  expect(detail.lead).toBeUndefined();
  expect(detail.facts).toEqual([
    { label: "일시", value: "2026. 11. 20. (금) 19:00" },
    { label: "장소", value: "전남대학교 민주마루" },
    { label: "지휘", value: "박찬영, 박예영" },
  ]);
  expect(detail.links).toEqual([
    { href: "/gallery", label: "공연 사진 보기" },
    { href: "/concert", label: "초대장 보기" },
  ]);
});

it("제1회 정기연주회는 전용 페이지 없이도 세부 내용을 가진다", () => {
  const detail = publicNews.find((item) => item.id === "concert-2025")!.detail!;
  expect(detail.photo).toBeUndefined();
  expect(detail.links).toBeUndefined();
  expect(detail.facts).toEqual([
    { label: "일시", value: "2025. 9. 12. (금)" },
    { label: "장소", value: "전남대학교 예술대학 3호관 예향홀" },
  ]);
});
