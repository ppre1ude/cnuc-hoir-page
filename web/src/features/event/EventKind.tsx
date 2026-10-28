import type { ChoirEvent } from "./events";
import styles from "./EventCalendar.module.css";

export type EventKind = "regular" | "extra" | "rehearsal" | "concert" | "trip" | "part" | "other";

// 정기연습, 비정기연습, 파트연습은 등록할 때 고른 종류를 그대로 씁니다.
const byKind = { REGULAR_REHEARSAL: "regular", EXTRA_REHEARSAL: "extra", PART_REHEARSAL: "part" } as const;

// ponytail: 중요 행사만 제목 단어로 리허설, 공연, MT를 알아맞힙니다. 맞는 단어가 없으면 일정 아이콘입니다.
// 앞 규칙이 이깁니다. "공연 리허설"은 공연보다 리허설로 읽습니다.
const eventRules: [RegExp, EventKind][] = [
  [/리허설/, "rehearsal"],
  [/공연|연주회|발표회/, "concert"],
  [/MT|엠티|워크숍|수련회/i, "trip"],
];

export function eventKind(event: Pick<ChoirEvent, "kind" | "title">): EventKind {
  if (event.kind !== "EVENT") return byKind[event.kind];
  return eventRules.find(([pattern]) => pattern.test(event.title))?.[1] ?? "other";
}

export const kindLabels: Record<EventKind, string> = {
  regular: "정기연습", extra: "비정기연습", rehearsal: "리허설", concert: "공연", trip: "MT·워크숍", part: "파트연습", other: "일정",
};

const icons: Record<EventKind, React.ReactNode> = {
  regular: <><path d="M9 17V5l10-2v12" /><circle cx="6" cy="17" r="3" /><circle cx="16" cy="15" r="3" /></>,
  extra: <><path d="M10 17V4l5 1.5" /><circle cx="7" cy="17" r="3" /><path d="M18 9v6M15 12h6" /></>,
  rehearsal: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></>,
  concert: <path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1L3.2 9.4l6.1-.8z" />,
  trip: <path d="M3 20 12 4l9 16zM12 20v-7M8 20l4-7 4 7" />,
  part: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M21 20c0-3-1.8-5-4-5" /></>,
  other: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
};

// 종류는 제목으로도 읽히므로 아이콘은 보조 표시로만 두고 보조 기술에는 숨깁니다.
export function EventKindIcon({ event }: { event: Pick<ChoirEvent, "kind" | "title"> }) {
  const kind = eventKind(event);
  return <span className={`${styles.kind} ${styles.kindIcon}`} data-kind={kind} aria-hidden="true">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icons[kind]}</svg>
  </span>;
}
