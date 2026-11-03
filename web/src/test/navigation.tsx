import { useEffect, useReducer } from "react";

// next/navigation 흉내입니다. 테스트가 nav.search와 nav.pathname으로 주소를 넣고,
// router.replace와 push는 주소를 바꾼 뒤 useSearchParams를 쓰는 컴포넌트를 다시 그립니다.
// 쓰는 법: vi.mock("next/navigation", () => import("../../test/navigation")); beforeEach(nav.reset).
const listeners = new Set<() => void>();
function go(url: string) {
  const [path, query = ""] = url.split("?");
  nav.pathname = path;
  nav.search = query;
  listeners.forEach((listener) => listener());
}

export const nav = {
  pathname: "/notices",
  search: "",
  replaced: [] as string[],
  pushed: [] as string[],
  reset() { nav.pathname = "/notices"; nav.search = ""; nav.replaced = []; nav.pushed = []; },
};

// 실제 router처럼 같은 객체를 돌려줘야 useCallback 의존성이 매번 바뀌지 않습니다.
const router = {
  replace: (url: string) => { nav.replaced.push(url); go(url); },
  push: (url: string) => { nav.pushed.push(url); go(url); },
  back: () => undefined,
};

export const usePathname = () => nav.pathname;
export const useRouter = () => router;
export function useSearchParams() {
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  useEffect(() => { listeners.add(rerender); return () => { listeners.delete(rerender); }; }, []);
  return new URLSearchParams(nav.search);
}
