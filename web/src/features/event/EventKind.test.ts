import { describe, expect, it } from "vitest";
import { eventKind } from "./EventKind";

describe("일정 아이콘 종류", () => {
  it.each([
    ["REGULAR_REHEARSAL", "아무 제목", "regular"],
    ["EXTRA_REHEARSAL", "전체연습", "extra"],
    ["PART_REHEARSAL", "테너 파트연습", "part"],
    ["EVENT", "최종 리허설", "rehearsal"],
    ["EVENT", "공연 리허설", "rehearsal"],
    ["EVENT", "가을 정기연주회", "concert"],
    ["EVENT", "신입 발표회", "concert"],
    ["EVENT", "여름 MT", "trip"],
    ["EVENT", "워크숍", "trip"],
    ["EVENT", "총회", "other"],
    ["EVENT", "전체 정기연습", "other"],
  ] as const)("%s %s → %s", (kind, title, expected) => {
    expect(eventKind({ kind, title })).toBe(expected);
  });
});
