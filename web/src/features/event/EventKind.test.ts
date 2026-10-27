import { describe, expect, it } from "vitest";
import { eventKind } from "./EventKind";

describe("행사 종류 판별", () => {
  it.each([
    ["전체 정기연습", "regular"],
    ["전체 비정기연습", "extra"],
    ["소프라노 파트연습", "part"],
    ["최종 리허설", "rehearsal"],
    ["공연 리허설", "rehearsal"],
    ["가을 정기연주회", "concert"],
    ["여름 MT", "trip"],
    ["워크숍", "trip"],
    ["연습", "regular"],
    ["총회", "other"],
  ])("%s → %s", (title, kind) => {
    expect(eventKind(title)).toBe(kind);
  });
});
