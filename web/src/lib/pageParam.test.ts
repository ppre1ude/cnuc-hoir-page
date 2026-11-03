import { afterEach, expect, test, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePageParam } from "./pageParam";

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/notices",
}));

afterEach(() => { nav.search = ""; vi.clearAllMocks(); });

test.each([["", 0], ["page=abc", 0], ["page=0", 0], ["page=-2", 0], ["page=1.5", 0], ["page=3", 2]])(
  "주소가 '%s'이면 %i쪽(0부터)입니다", (search, expected) => {
    nav.search = search;
    const { result } = renderHook(() => usePageParam());
    expect(result.current[0]).toBe(expected);
  });

test("쪽을 바꾸면 주소에 1부터 센 번호를 남기고 1쪽은 지우며 다른 매개변수는 둡니다", () => {
  nav.search = "notice=9";
  const { result } = renderHook(() => usePageParam());
  act(() => result.current[1](2));
  expect(nav.replace).toHaveBeenLastCalledWith("/notices?notice=9&page=3", { scroll: false });
  act(() => result.current[1](0));
  expect(nav.replace).toHaveBeenLastCalledWith("/notices?notice=9", { scroll: false });
  nav.search = "page=2";
  const bare = renderHook(() => usePageParam());
  act(() => bare.result.current[1](0));
  expect(nav.replace).toHaveBeenLastCalledWith("/notices", { scroll: false });
});
