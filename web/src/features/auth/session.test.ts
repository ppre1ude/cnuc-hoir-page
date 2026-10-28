import { expect, it } from "vitest";
import { canManageEvent } from "./session";
import { sessionFixture } from "../../test/session";

it("정기연습과 비정기연습은 전체연습 권한으로 등록합니다", () => {
  const vice = sessionFixture({ permissions: ["MANAGE_FULL_REHEARSALS"] });
  expect(canManageEvent(vice, "REGULAR_REHEARSAL", null)).toBe(true);
  expect(canManageEvent(vice, "EXTRA_REHEARSAL", null)).toBe(true);
  expect(canManageEvent(vice, "EVENT", null)).toBe(false);
  expect(canManageEvent(sessionFixture({ permissions: ["MANAGE_EVENTS"] }), "EXTRA_REHEARSAL", null)).toBe(false);
});
