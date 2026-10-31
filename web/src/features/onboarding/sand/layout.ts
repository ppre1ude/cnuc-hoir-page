// 모래 장면 무대의 크기·배치·장면 넘김 계산입니다. DOM과 캔버스 없이 계산만 하므로 따로 테스트합니다.

export const SCENE_COUNT = 7;
/** 이 너비 이하는 모바일 배치입니다. 토큰의 모바일 구간(max-width: 760px)과 같습니다. */
export const MOBILE_MAX_WIDTH = 760;
/** 이 높이 이하는 한 화면에 장면이 다 들어가지 않아 엔진을 끄고 세로로 쌓습니다. 휴대폰 가로와 PC 200% 확대가 여기 듭니다. CSS의 같은 @media와 맞춥니다. */
export const STACKED_MEDIA = "(max-height: 559px), (max-width: 760px) and (max-height: 619px)";

export type StageSize = { w: number; h: number; mobile: boolean; count: number; dpr: number };

/** 입자 하나가 모일 자리입니다. shade는 색 농도 단계(0 진함 ~ 3 옅음, -1은 미정)입니다. */
export type Target = {
  x: number;
  y: number;
  shade: number;
  /** 1이면 파형 기둥처럼 매 프레임 높이가 바뀌는 자리입니다. */
  motion?: 1;
  column?: number;
  level?: number;
  centerY?: number;
};

export function stageSize(width: number, height: number, devicePixelRatio: number): StageSize {
  const w = Math.round(width);
  const h = Math.round(height);
  const mobile = w <= MOBILE_MAX_WIDTH;
  return { w, h, mobile, count: mobile ? 4200 : 7000, dpr: Math.min(1.75, devicePixelRatio || 1) };
}

/** 내용이 놓이는 가로 띠입니다. PC는 화면 가운데 900px, 넓은 모니터에서는 화면 폭의 56%(최대 1200px)로 넓어지되 좌우 140px 이상을 비워 오른쪽 목차와 겹치지 않고, 모바일은 좌우 8%를 비웁니다. CSS의 --band와 같은 계산입니다. */
export function band(size: StageSize) {
  if (size.mobile) return { left: size.w * .08, width: size.w * .84 };
  const width = Math.min(Math.max(900, Math.min(1200, size.w * .56)), size.w - 280);
  return { left: (size.w - width) / 2, width };
}

/** 그림이 놓이는 칸입니다. PC는 띠의 40%부터 끝까지(왼쪽은 글), 모바일은 띠 전체입니다. */
export function graphicColumn(size: StageSize) {
  const b = band(size);
  return size.mobile ? b : { left: b.left + b.width * .4, width: b.width * .6 };
}

/** 0~1 사이 랜덤 값의 합으로 만든 가벼운 종 모양 흔들림입니다. */
export function gaussian(random: () => number = Math.random) {
  return (random() + random() + random() - 1.5) * 1.3;
}

export function shuffle<T>(list: T[], random: () => number = Math.random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** 목표 목록을 입자 수에 맞춥니다. 비어 있으면 화면에 흩뿌리고, 모자라면 흔들어 복제하고, 넘치면 고르게 솎습니다. */
export function fitTargets(targets: Target[], size: StageSize, random: () => number = Math.random): Target[] {
  const n = size.count;
  const len = targets.length;
  if (!len) return Array.from({ length: n }, () => ({ x: random() * size.w, y: random() * size.h, shade: 3 }));
  if (len >= n) return Array.from({ length: n }, (_, k) => targets[Math.floor(k * len / n)]);
  return Array.from({ length: n }, (_, m) => {
    const source = targets[m % len];
    return m < len ? source : { ...source, x: source.x + 1.2 * gaussian(random), y: source.y + 1.2 * gaussian(random) };
  });
}

/** 스크롤 진행도(0~1)가 속한 장면 번호입니다. 진행 구간을 장면 수로 똑같이 나눕니다. */
export function sceneAt(progress: number, count = SCENE_COUNT) {
  return Math.min(count - 1, Math.max(0, Math.floor(progress * count + 1e-9)));
}

/** 장면으로 넘길 때 스크롤할 위치입니다. 첫 장면은 맨 위, 나머지는 그 장면 구간의 가운데입니다. */
export function sceneScrollOffset(scene: number, range: number, count = SCENE_COUNT) {
  return scene === 0 ? 0 : (scene / count + .5 / count) * range;
}

/**
 * 마우스 휠과 트랙패드를 "한 번 넘기면 한 장면"으로 바꿉니다.
 * 트랙패드 관성으로 잇따라 오는 휠 이벤트를 한 제스처로 묶고, 약한 값 뒤에 갑자기 센 값이 오면 새 제스처로 봅니다.
 */
export function createWheelGesture() {
  let lastWheelAt = -1e9;
  let lastWheelDelta = 0;
  let ready = true;
  return {
    /**
     * @param delta 픽셀로 바꾼 세로 휠 값
     * @param time 이벤트 시각(ms)
     * @param sinceStep 마지막으로 장면을 넘긴 뒤 지난 시간(ms)
     * @param moving 넘김 스크롤이나 잠금이 진행 중인지
     * @returns 넘길 방향. 넘기지 않으면 0
     */
    next(delta: number, time: number, sinceStep: number, moving: boolean): -1 | 0 | 1 {
      const strength = Math.abs(delta);
      const gap = time - lastWheelAt;
      const surge = strength >= 15 && strength > 2.5 * lastWheelDelta && lastWheelDelta < 12;
      const fresh = sinceStep < 1320 ? gap > 400 || (gap > 180 && strength <= 12) : gap > 180 || surge;
      if (fresh) ready = true;
      lastWheelAt = time;
      lastWheelDelta = strength;
      if (moving) { ready = false; return 0; }
      if (!ready || strength < 1) return 0;
      if (sinceStep < 1170 && gap < 400) { ready = false; return 0; }
      ready = false;
      return delta > 0 ? 1 : -1;
    },
  };
}

export const easeInOutCubic = (t: number) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
