import { expect, test, vi } from "vitest";
import { localInput, openPicker, utcInput } from "./eventTime";

test("UTC 시각과 한국 시간 datetime-local 값을 서로 바꿉니다", () => {
  expect(localInput("2026-10-04T10:00:00Z")).toBe("2026-10-04T19:00");
  expect(utcInput("2026-10-04T19:00")).toBe("2026-10-04T10:00:00.000Z");
  expect(utcInput("")).toBeNull();
});

test("선택기를 열고, 열 수 없는 브라우저에서는 조용히 넘어갑니다", () => {
  const input = document.createElement("input");
  const showPicker = vi.fn();
  Object.assign(input, { showPicker });
  openPicker(input);
  expect(showPicker).toHaveBeenCalledTimes(1);
  expect(() => openPicker(document.createElement("input"))).not.toThrow();
});
