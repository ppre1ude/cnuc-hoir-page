import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// 주소의 ?page=를 0부터 세는 쪽으로 읽고 씁니다. 사람 기준으로 1부터 적고 1쪽은 매개변수를 지웁니다.
// 다른 매개변수(?notice= 등)는 그대로 두고, 바꿀 때 스크롤은 옮기지 않습니다. 범위 밖 보정은 total을 아는 쪽이 setPage로 합니다.
export function usePageParam(): [page: number, setPage: (page: number) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("page");
  const number = Number(raw);
  const page = Number.isSafeInteger(number) && number > 0 ? number - 1 : 0;
  // 지금 검색 문자열은 ref로 들고 있어 setPage가 매번 새 함수가 되지 않습니다. 새 함수가 되면 그것을 의존하는 목록 effect가 되돌이표를 돕니다.
  const current = params.toString();
  const currentRef = useRef(current);
  useEffect(() => { currentRef.current = current; }, [current]);
  const setPage = useCallback((next: number) => {
    const search = new URLSearchParams(currentRef.current);
    if (next > 0) search.set("page", String(next + 1));
    else search.delete("page");
    const query = search.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [router, pathname]);
  // 깨진 번호(글자, 0 이하, 소수)는 첫 쪽으로 읽되 주소에 남겨 두지 않습니다.
  useEffect(() => {
    if (raw !== null && raw !== String(page + 1)) setPage(page);
  }, [raw, page, setPage]);
  return [page, setPage];
}
