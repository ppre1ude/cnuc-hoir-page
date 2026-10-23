import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { choirChannels } from "./choirProfile";
import { SandLanding } from "./SandLanding";

// 마크업 검사는 엔진이 시작하기 전, 곧 자바스크립트가 없을 때와 같은 문서를 봅니다. 엔진 검사에서만 실제 엔진을 켭니다.
const engine = vi.hoisted(() => ({ real: false }));
vi.mock("./sand/stage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./sand/stage")>();
  return { startSandStage: (...args: Parameters<typeof actual.startSandStage>) => (engine.real ? actual.startSandStage(...args) : () => {}) };
});

beforeEach(() => {
  engine.real = false;
  // jsdom에는 캔버스가 없습니다. 엔진은 입자 없이 장면 넘김만 합니다.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SandLanding", () => {
  it("일곱 장면의 글을 처음부터 문서 순서대로 읽을 수 있다", () => {
    render(<SandLanding />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/합창으로 전하는\s*울림과 감동의 이야기/);
    expect(screen.getByText("전남대학교 합창단은 교내 유일의 합창 동아리입니다.")).toBeInTheDocument();
    const titles = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(titles).toEqual(["내 목소리를알아가고,", "나를발견하고,", "함께노래하며", "우리가 됩니다.", "우리가 걸어온 길", "함께 노래해요."]);
    // 꼬리표는 음악이 쌓이는 순서를 말합니다.
    for (const eyebrow of ["01독창", "02성부", "03화음", "04합창", "05기록"]) expect(screen.getByText((_, el) => el?.textContent === eyebrow && el.tagName === "P")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "지휘자와 단원들이 무대에서 합창하는 모습" })).toBeInTheDocument();
  });

  it("걸어온 길은 연도별로 오래된 일부터 날짜와 함께 보인다", () => {
    render(<SandLanding />);
    const history = screen.getByRole("region", { name: "우리가 걸어온 길" });
    expect(within(history).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["2024", "2025", "2026"]);
    const fifth = within(history).getByText("5기 단원 입단").closest("li")!;
    expect(within(fifth).getByText("09. 03")).toHaveAttribute("datetime", "2026-09-03");
  });

  it("지원서와 공식 채널은 마지막 장면에, 단원 로그인은 머리글에 있다", () => {
    render(<SandLanding />);
    expect(screen.getByRole("link", { name: "단원 로그인" })).toHaveAttribute("href", "/login");
    const join = screen.getByRole("region", { name: "함께 노래해요." });
    expect(within(join).getByRole("link", { name: /지원서 작성하기/ })).toHaveAttribute("href", choirChannels.application);
    const channels = within(join).getByRole("navigation", { name: "공식 채널" });
    expect(within(channels).getByRole("link", { name: /인스타그램/ })).toHaveAttribute("href", choirChannels.instagram);
    expect(within(channels).getByRole("link", { name: /유튜브/ })).toHaveAttribute("href", choirChannels.youtube);
  });

  it("오른쪽 목차는 네 문장 장면을 번호로 보이고 장면 이름으로 읽어 준다", () => {
    render(<SandLanding />);
    const nav = screen.getByRole("navigation", { name: "장면" });
    expect(within(nav).getAllByRole("button").map((button) => button.textContent)).toEqual(["소개", "01", "02", "03", "04", "걸어온 길", "지원"]);
    expect(within(nav).getByRole("button", { name: "내 목소리 장면으로 이동" })).toHaveTextContent("01");
  });

  it("자바스크립트 전에는 어떤 장면도 가리지 않는다", () => {
    const { container } = render(<SandLanding />);
    expect(container.querySelectorAll("[inert], [data-scene][aria-hidden='true']")).toHaveLength(0);
  });

  it("엔진이 시작되면 지금 장면만 조작할 수 있고, 멈추면 바꾼 문서 설정을 되돌린다", () => {
    engine.real = true;
    const { container, unmount } = render(<SandLanding />);
    const scenes = Array.from(container.querySelectorAll<HTMLElement>("[data-scene]"));
    expect(scenes.filter((el) => el.hasAttribute("inert")).map((el) => el.dataset.scene)).toEqual(["1", "2", "3", "4", "5", "6", "6"]);
    expect(scenes.filter((el) => !el.hasAttribute("inert")).every((el) => el.dataset.scene === "0" && el.getAttribute("aria-hidden") === "false")).toBe(true);
    expect(container.querySelector("[data-sand='photo']")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "소개 장면으로 이동" })).toHaveAttribute("aria-current", "step");
    expect(document.documentElement.style.overscrollBehavior).toBe("none");
    unmount();
    expect(document.documentElement.style.overscrollBehavior).toBe("");
  });
});
