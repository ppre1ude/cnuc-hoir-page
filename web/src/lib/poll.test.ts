import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { pollWhileVisible } from "./poll";

let hidden = false;
function setHidden(value: boolean) {
  hidden = value;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  hidden = false;
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
});
afterEach(() => { vi.useRealTimers(); Reflect.deleteProperty(document, "hidden"); });

test("숨겨진 동안 멈추고, 다시 보이면 바로 받은 뒤 이어 갑니다", async () => {
  const load = vi.fn().mockResolvedValue(undefined);
  const stop = pollWhileVisible(load);
  await vi.advanceTimersByTimeAsync(15000);
  expect(load).toHaveBeenCalledTimes(1);

  setHidden(true);
  await vi.advanceTimersByTimeAsync(60000);
  expect(load).toHaveBeenCalledTimes(1);

  setHidden(false);
  await vi.advanceTimersByTimeAsync(0);
  expect(load).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(15000);
  expect(load).toHaveBeenCalledTimes(3);

  stop();
  setHidden(true);
  setHidden(false);
  await vi.advanceTimersByTimeAsync(60000);
  expect(load).toHaveBeenCalledTimes(3);
});

test("앞 요청이 끝나기 전에는 다음 요청을 보내지 않고, 실패해도 이어 갑니다", async () => {
  let finish!: (error: Error) => void;
  const load = vi.fn()
    .mockReturnValueOnce(new Promise((_, reject) => { finish = reject; }))
    .mockResolvedValue(undefined);
  const stop = pollWhileVisible(load);
  await vi.advanceTimersByTimeAsync(60000);
  setHidden(true);
  setHidden(false);
  expect(load).toHaveBeenCalledTimes(1);

  finish(new Error("실패"));
  await vi.advanceTimersByTimeAsync(15000);
  expect(load).toHaveBeenCalledTimes(2);
  stop();
});
