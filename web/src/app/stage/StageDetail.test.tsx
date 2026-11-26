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
  expect([...container.querySelectorAll("p")].filter((p) => !p.textContent?.trim())).toEqual([]);
});

it("공연 이름은 행사 이름 바로 아래에 붙는다", () => {
  render(<StageDetail item={first} />);
  const subtitle = screen.getByText("희망 L'espoir");
  expect(subtitle.closest("hgroup")).toContainElement(screen.getByRole("heading", { name: "제1회 정기연주회" }));
});

it("프로그램이 있으면 부마다 곡과 설명을 보여 주고, 없으면 칸을 만들지 않는다", () => {
  const { unmount } = render(<StageDetail item={first} />);
  expect(screen.getByRole("heading", { name: "프로그램" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 5 }).map((h) => h.textContent)).toEqual(["1부", "2부"]);
  expect(screen.getAllByRole("list").map((list) => list.children.length)).toEqual([6, 5]);
  expect(screen.getByText("Seasons of Love")).toBeInTheDocument();
  expect(screen.getByText("뮤지컬 '팬텀' 中, 듀엣")).toBeInTheDocument();
  unmount();
  render(<StageDetail item={second} />);
  expect(screen.queryByRole("heading", { name: "프로그램" })).toBeNull();
});

it("소개 글이 있으면 문단으로 보인다", () => {
  render(<StageDetail item={{ ...second, detail: { ...second.detail, lead: "시험 소개 글" } }} />);
  expect(screen.getByText("시험 소개 글").tagName).toBe("P");
});
