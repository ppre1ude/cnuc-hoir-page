import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// 주소의 ?page=를 0부터 세는 쪽으로 읽고 씁니다. 사람 기준으로 1부터 적고 1쪽은 매개변수를 지웁니다.
// 다른 매개변수(?notice= 등)는 그대로 두고, 바꿀 때 스크롤은 옮기지 않습니다. 범위 밖 보정은 total을 아는 쪽이 setPage로 합니다.
export function usePageParam(): [page: number, setPage: (page: number) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = Number(params.get("page"));
  const page = Number.isSafeInteger(raw) && raw > 0 ? raw - 1 : 0;
  // 의존성은 객체가 아니라 문자열로 둡니다. useSearchParams가 그릴 때마다 새 객체를 주면 setPage가 매번 바뀌어 effect가 되돌이표를 돕니다.
  const current = params.toString();
  const setPage = useCallback((next: number) => {
    const search = new URLSearchParams(current);
    if (next > 0) search.set("page", String(next + 1));
    else search.delete("page");
    const query = search.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [current, router, pathname]);
  return [page, setPage];
}
