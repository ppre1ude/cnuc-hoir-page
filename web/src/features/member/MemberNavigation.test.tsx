import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemberNavigation } from "./MemberNavigation";
import { SessionProvider } from "../auth/SessionProvider";
import { getSession, rememberSession } from "../auth/session";
import { renderWithSession, sessionFixture } from "../../test/session";

const nav = vi.hoisted(() => ({ pathname: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname, useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("../auth/session", async (importOriginal) => ({ ...await importOriginal<typeof import("../auth/session")>(), getSession: vi.fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); rememberSession(null); nav.pathname = "/dashboard"; });

test("메뉴는 홈, 일정, 공지, 내 출석 순서이고 일정 상세에서는 일정이 켜집니다", () => {
  renderWithSession(<MemberNavigation />, sessionFixture());
  const names = ["홈", "일정", "공지", "내 출석"];
  expect(names.map((name) => screen.getByRole("link", { name }).getAttribute("href"))).toEqual(["/dashboard", "/events", "/notices", "/attendance"]);
  expect(screen.getByRole("link", { name: "홈" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "일정" })).not.toHaveAttribute("aria-current");
  cleanup();
  for (const path of ["/events", "/events/12"]) {
    nav.pathname = path;
    renderWithSession(<MemberNavigation />, sessionFixture());
    expect(screen.getByRole("link", { name: "일정" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "홈" })).not.toHaveAttribute("aria-current");
    cleanup();
  }
});

test("세션을 기다리는 동안에도 로고와 로그아웃을 보여 줍니다", () => {
  vi.mocked(getSession).mockReturnValue(new Promise(() => undefined));
  render(<SessionProvider><MemberNavigation /></SessionProvider>);
  expect(screen.getByRole("link", { name: "전남대학교 합창단 일정" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "운영진" })).not.toBeInTheDocument();
});

test("운영진에게는 이름과 운영진 메뉴를 보여 줍니다", () => {
  renderWithSession(<MemberNavigation />, sessionFixture({ name: "수석", permissions: ["MANAGE_EVENTS", "VIEW_MINUTES"] }));
  expect(screen.getByText("수석")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "운영진" })).toBeInTheDocument();
});

test("회의록 보기만 있는 단원에게는 운영진 메뉴가 없습니다", () => {
  renderWithSession(<MemberNavigation />, sessionFixture({ name: "단원" }));
  expect(screen.getByText("단원")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "운영진" })).not.toBeInTheDocument();
});
