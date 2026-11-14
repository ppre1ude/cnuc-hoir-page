import { describe, expect, it } from "vitest";
import { isConcertUpcoming } from "./concert";

describe("isConcertUpcoming", () => {
  it("공연 당일 밤까지는 안내를 띄우고 다음 날 0시(한국 시간)부터 내린다", () => {
    expect(isConcertUpcoming(new Date("2026-11-20T23:59:00+09:00"))).toBe(true);
    expect(isConcertUpcoming(new Date("2026-11-21T00:00:00+09:00"))).toBe(false);
  });
});
