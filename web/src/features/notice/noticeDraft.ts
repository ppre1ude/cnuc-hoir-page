export type PollKind = "none" | "attendance" | "agree" | "custom";
export type Draft = {
  title: string; body: string; poll: PollKind;
  pollQuestion: string; firstOption: string; secondOption: string; pollClosesAt: string;
};
export const emptyDraft: Draft = { title: "", body: "", poll: "none", pollQuestion: "", firstOption: "", secondOption: "", pollClosesAt: "" };
const kinds: PollKind[] = ["none", "attendance", "agree", "custom"];

// 세션이 끝나 로그인 화면으로 넘어갔다 돌아와도 쓰던 새 공지를 되살리려고 같은 탭의 sessionStorage에 둡니다.
// 수정 화면은 쓰지 않습니다. 옛 모양(published, includePoll 같은 키)이 남아 있어도 아는 키만 읽습니다.
const key = "notice-draft";

export const isEmptyDraft = (draft: Draft) => JSON.stringify(draft) === JSON.stringify(emptyDraft);

export function readDraft(): Draft {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) ?? "{}") as Record<string, unknown>;
    const known = Object.fromEntries(Object.keys(emptyDraft).filter((field) => typeof parsed[field] === "string").map((field) => [field, parsed[field]]));
    const draft = { ...emptyDraft, ...known } as Draft;
    return kinds.includes(draft.poll) ? draft : { ...draft, poll: "none" };
  } catch { return emptyDraft; }
}

export function writeDraft(draft: Draft) {
  try {
    if (isEmptyDraft(draft)) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(draft));
  } catch { /* 저장소가 막힌 브라우저에서는 임시 저장 없이 씁니다. */ }
}

export function clearDraft() {
  try { sessionStorage.removeItem(key); } catch { /* 위와 같습니다. */ }
}
