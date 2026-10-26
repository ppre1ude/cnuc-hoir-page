import { expect, test } from "vitest";
import { sampleMark, sampleStep } from "./sandMarkStage";

test("불투명한 칸에서만 자리를 뽑고 농도는 0~2 사이입니다", () => {
  // 4×2 그림. 왼쪽 두 칸만 불투명합니다.
  const data = new Uint8ClampedArray(4 * 2 * 4);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) data[4 * (y * 4 + x) + 3] = 255;
  const points = sampleMark(data, 4, 2, 1, () => 0);
  expect(points).toHaveLength(4);
  expect(points.every((p) => p.x < 2 && p.shade === 0)).toBe(true);
  expect(sampleMark(data, 4, 2, 1, () => .9).every((p) => p.shade === 2)).toBe(true);
});

test("표본 간격은 입자 수를 늘리면 좁아지고 1.5 아래로는 내려가지 않습니다", () => {
  expect(sampleStep(480, 320, 5200)).toBeLessThan(sampleStep(480, 320, 3400));
  expect(sampleStep(40, 30, 5200)).toBe(1.5);
});
