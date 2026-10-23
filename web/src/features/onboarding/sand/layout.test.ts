import { describe, expect, it } from "vitest";
import { band, createWheelGesture, fitTargets, graphicColumn, sceneAt, sceneScrollOffset, stageSize } from "./layout";

describe("무대 배치", () => {
  it("760px 이하는 모바일로 보고 입자 수와 화면 배율을 정한다", () => {
    expect(stageSize(390, 844, 3)).toEqual({ w: 390, h: 844, mobile: true, count: 4200, dpr: 1.75 });
    expect(stageSize(760, 900, 1).mobile).toBe(true);
    expect(stageSize(761, 900, 1)).toMatchObject({ mobile: false, count: 7000, dpr: 1 });
  });

  it("PC의 내용 띠는 가운데 최대 900px이고 좌우 140px 이상을 비운다", () => {
    expect(band(stageSize(1440, 900, 1))).toEqual({ left: 270, width: 900 });
    expect(band(stageSize(1000, 900, 1))).toEqual({ left: 140, width: 720 });
    // 그림은 띠의 40% 지점부터 끝까지입니다.
    expect(graphicColumn(stageSize(1440, 900, 1))).toEqual({ left: 630, width: 540 });
  });

  it("모바일은 좌우 8%를 비우고 그림도 띠 전체를 쓴다", () => {
    const size = stageSize(400, 800, 1);
    expect(band(size)).toEqual({ left: 32, width: 336 });
    expect(graphicColumn(size)).toEqual(band(size));
  });
});

describe("입자 수 맞추기", () => {
  const size = stageSize(400, 800, 1);

  it("목표가 없으면 화면 안에 옅게 흩뿌린다", () => {
    const targets = fitTargets([], size);
    expect(targets).toHaveLength(size.count);
    expect(targets.every((t) => t.shade === 3 && t.x >= 0 && t.x <= 400 && t.y >= 0 && t.y <= 800)).toBe(true);
  });

  it("모자라면 복제하고 넘치면 고르게 솎아 입자 수와 같게 만든다", () => {
    expect(fitTargets([{ x: 10, y: 10, shade: 0 }], size)).toHaveLength(size.count);
    const many = Array.from({ length: size.count * 2 }, (_, i) => ({ x: i, y: 0, shade: 1 }));
    const thinned = fitTargets(many, size);
    expect(thinned).toHaveLength(size.count);
    expect(thinned[1].x).toBe(2);
  });
});

describe("장면 위치", () => {
  it("진행도를 장면 수로 똑같이 나눈다", () => {
    expect(sceneAt(0)).toBe(0);
    expect(sceneAt(1 / 7)).toBe(1);
    expect(sceneAt(.999)).toBe(6);
    expect(sceneAt(1)).toBe(6);
  });

  it("첫 장면은 맨 위, 나머지는 그 장면 구간의 가운데로 넘긴다", () => {
    expect(sceneScrollOffset(0, 700)).toBe(0);
    expect(sceneScrollOffset(1, 700)).toBeCloseTo(150);
    expect(sceneAt(sceneScrollOffset(3, 700) / 700)).toBe(3);
  });
});

describe("휠 한 번에 한 장면", () => {
  it("트랙패드 관성으로 잇따라 오는 휠은 한 번만 넘긴다", () => {
    const gesture = createWheelGesture();
    let lastStepAt = -1e9;
    const steps: number[] = [];
    // 16ms 간격으로 점점 약해지는 휠 60개
    for (let i = 0; i < 60; i++) {
      const time = 1000 + i * 16;
      const direction = gesture.next(Math.max(1, 80 * .93 ** i), time, time - lastStepAt, time - lastStepAt < 900);
      if (direction) { steps.push(direction); lastStepAt = time; }
    }
    expect(steps).toEqual([1]);
  });

  it("관성이 끝나고 새로 밀면 다시 넘기고, 위로 밀면 거꾸로 넘긴다", () => {
    const gesture = createWheelGesture();
    expect(gesture.next(40, 1000, 1e9, false)).toBe(1);
    expect(gesture.next(-40, 3000, 2000, false)).toBe(-1);
  });

  it("넘기는 중에 온 휠은 무시한다", () => {
    const gesture = createWheelGesture();
    expect(gesture.next(40, 1000, 100, true)).toBe(0);
  });
});
