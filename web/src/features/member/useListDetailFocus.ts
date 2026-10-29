import { useEffect, useRef } from "react";

// 좁은 화면에서는 단원을 고르면 목록이, 돌아가면 상세가 숨겨집니다. 눌렀던 버튼이 사라져 초점이 날아가지 않게
// 고르면 상세 칸으로, 돌아가면 그 단원의 목록 행으로 초점을 옮깁니다. 넓은 화면은 둘 다 보이므로 건드리지 않습니다.
export function useListDetailFocus(selected: number | null) {
  const detail = useRef<HTMLDivElement>(null);
  const returnTo = useRef<number | null>(null);
  useEffect(() => {
    if (!window.matchMedia?.("(max-width: 760px)").matches) return;
    if (selected !== null) detail.current?.focus();
    else if (returnTo.current !== null) document.getElementById(rosterRowId(returnTo.current))?.focus();
  }, [selected]);
  return { detail, leave: (id: number | null) => { returnTo.current = id; } };
}
export const rosterRowId = (id: number) => `roster-${id}`;
