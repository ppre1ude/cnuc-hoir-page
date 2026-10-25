import {
  band, createWheelGesture, easeInOutCubic, fitTargets, gaussian, graphicColumn,
  SCENE_COUNT, sceneAt, sceneScrollOffset, shuffle, stageSize, type StageSize, type Target,
} from "./layout";

// 공개 메인의 모래 장면 무대입니다.
// 긴 스크롤 영역(root) 안에 화면 크기의 무대(stage)를 고정하고, 캔버스 입자가 장면마다 심벌·파형·음표·오선·사진·길로 모였다 흩어집니다.
// 휠·터치·키보드 한 번에 한 장면씩 넘기며, 장면 글은 data-active가 붙은 것만 보입니다.

type Particle = {
  x: number; y: number; vx: number; vy: number;
  hx: number; hy: number; nhx: number; nhy: number;
  shade: number; nshade: number; size: number;
  delay: number; waiting: boolean; target: Target | null; next: Target | null;
};
type Box = { x: number; y: number; w: number; h: number };

export type SandStageOptions = {
  /** 입자로 그릴 합창단 심벌 이미지 주소와 원본 비율 */
  mark: { src: string; width: number; height: number };
};

const PHOTO_RADIUS = 14;   // 사진 모서리 반지름. CSS의 .photo와 같습니다.
const HEADER_HEIGHT = { mobile: 64, desktop: 76 }; // CSS의 .header 높이와 같습니다.

type StageElements = {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  /** 04·05를 오가는 사진 상자와 그 안의 이미지 */
  photoBox: HTMLElement;
  photoImg: HTMLImageElement;
  /** 04의 사진 자리(4:3 상자)와 05의 사진 자리(연혁 위 띠) */
  anchorBox: HTMLElement;
  banner: HTMLElement;
};

const pick = <T extends Element = HTMLElement>(root: HTMLElement, name: string) => root.querySelector<T>(`[data-sand="${name}"]`);

function findElements(root: HTMLElement): StageElements | null {
  const stage = pick(root, "stage");
  const canvas = pick<HTMLCanvasElement>(root, "canvas");
  const photoBox = pick(root, "photo");
  const banner = pick(root, "banner");
  const photoImg = photoBox?.querySelector("img");
  const anchorBox = pick(root, "photo-anchor")?.firstElementChild;
  if (!stage || !canvas || !photoBox || !banner || !photoImg || !(anchorBox instanceof HTMLElement)) return null;
  return { stage, canvas, photoBox, photoImg, anchorBox, banner };
}

/** 무대를 시작하고, 멈추는 함수를 돌려줍니다. 필요한 요소가 없으면 아무것도 하지 않습니다. */
export function startSandStage(root: HTMLElement, options: SandStageOptions): () => void {
  const elements = findElements(root);
  return elements ? run(root, elements, options) : () => {};
}

function run(root: HTMLElement, { stage, canvas, photoBox, photoImg, anchorBox, banner }: StageElements, { mark }: SandStageOptions) {
  const sceneEls = Array.from(root.querySelectorAll<HTMLElement>("[data-scene]"));
  const navButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-sand-nav]"));
  const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── 정리할 것들 ──
  let stopped = false;
  const disposers: (() => void)[] = [];
  const listen = (target: EventTarget, type: string, handler: (event: Event) => void, options?: AddEventListenerOptions) => {
    target.addEventListener(type, handler, options);
    disposers.push(() => target.removeEventListener(type, handler, options));
  };
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.delete(id); if (!stopped) fn(); }, ms);
    timers.add(id);
    return id;
  };
  const cancel = (id: number) => { window.clearTimeout(id); timers.delete(id); };

  // ── 캔버스 (그릴 수 없는 환경이면 입자 없이 장면 넘김만 합니다) ──
  const context2d = (target: HTMLCanvasElement, settings: CanvasRenderingContext2DSettings) => {
    try { return target.getContext("2d", settings); } catch { return null; }
  };
  const ctx = context2d(canvas, { alpha: true });
  const scratch = document.createElement("canvas");
  const sctx = ctx ? context2d(scratch, { willReadFrequently: true }) : null;

  // 색 레이어: 상징색 하나를 농도로 나눠 연필 질감을 냅니다. 색은 토큰에서 읽습니다.
  const css = getComputedStyle(root);
  const primary = css.getPropertyValue("--color-primary").trim();
  const brand = css.getPropertyValue("--color-brand").trim();
  const palette = [
    { color: primary, alpha: .92, scale: 1 },
    { color: brand, alpha: .62, scale: 1 },
    { color: brand, alpha: .34, scale: 1 },
    { color: brand, alpha: .12, scale: 1 },
    { color: brand, alpha: 1, scale: 1.5 }, // 파형 가운데 줄
  ];
  const layers: Particle[][] = palette.map(() => []);

  const markImg = new Image();
  markImg.decoding = "async";
  markImg.src = mark.src;
  const markAspect = mark.width / mark.height;
  const imageReady = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0;

  // ── 크기 ──
  let size: StageSize = stageSize(1, 1, 1);
  function measure() {
    const rect = stage.getBoundingClientRect();
    size = stageSize(rect.width, rect.height, window.devicePixelRatio);
    if (ctx) {
      canvas.width = Math.round(size.w * size.dpr);
      canvas.height = Math.round(size.h * size.dpr);
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    }
  }

  /** 무대 기준 배치 좌표입니다. transform을 무시하도록 offsetParent를 따라 더합니다. */
  function offsetIn(el: HTMLElement) {
    let x = 0;
    let y = 0;
    let node: HTMLElement | null = el;
    while (node && node !== stage) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    return { x, y };
  }

  // ── 장면별 목표 좌표 ──
  /** 임시 캔버스를 비웁니다. 목표 계산은 targetsOf가 sctx를 확인한 뒤에만 부릅니다. */
  function scratchClear() {
    if (!sctx) throw new Error("입자 계산용 캔버스가 없습니다.");
    scratch.width = size.w;
    scratch.height = size.h;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, size.w, size.h);
    return sctx;
  }
  /** 임시 캔버스에 그린 것을 점으로 뽑습니다. byLuminance면 어두운 정도, 아니면 투명도를 봅니다. */
  function sample(c: CanvasRenderingContext2D, rect: Box, step: number, byLuminance: boolean): Target[] {
    const x0 = Math.max(0, Math.floor(rect.x));
    const x1 = Math.min(size.w, Math.ceil(rect.x + rect.w));
    const y0 = Math.max(0, Math.floor(rect.y));
    const y1 = Math.min(size.h, Math.ceil(rect.y + rect.h));
    if (x1 <= x0 || y1 <= y0) return [];
    let data: Uint8ClampedArray;
    try { data = c.getImageData(x0, y0, x1 - x0, y1 - y0).data; } catch { return []; }
    const width = x1 - x0;
    const out: Target[] = [];
    for (let y = y0; y < y1; y += step) {
      for (let x = x0; x < x1; x += step) {
        const i = 4 * ((y - y0) * width + (x - x0));
        if (byLuminance) {
          if (data[i + 3] < 10) continue;
          const lum = data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114;
          if (lum > 150) continue;
          if (Math.random() > Math.pow(1 - lum / 150, 1.3)) continue;
          out.push({ x: x + Math.random() * step, y: y + Math.random() * step, shade: lum < 55 ? 0 : lum < 105 ? 1 : 2 });
        } else if (data[i + 3] > 120) {
          out.push({ x: x + Math.random() * step, y: y + Math.random() * step, shade: -1 });
        }
      }
    }
    return out;
  }

  /** 심벌과 그 장면 글 블록을 한 묶음으로 보고 화면 세로 가운데에 놓습니다.
   *  심벌은 폭 비율만큼 그리되 묶음이 머리글 아래 여백 안에 들어가도록 높이를 제한하고,
   *  글 블록은 CSS의 --mark-offset으로 (심벌 높이 + 간격)의 절반만큼 가운데에서 내려옵니다. */
  function markBox(scene: number, widthRatio: number) {
    const copy = root.querySelector<HTMLElement>(`[data-sand-mark="${scene}"]`);
    const copyH = copy ? copy.offsetHeight : size.h * .16;
    const gap = size.mobile ? 48 : 72; // 심벌 파일에 여백이 없으므로 잉크와 글 사이 숨을 여기서 둡니다.
    const margin = (size.mobile ? HEADER_HEIGHT.mobile : HEADER_HEIGHT.desktop) + 16;
    const h = Math.max(80, Math.min(size.w * widthRatio / markAspect, size.h - 2 * margin - gap - copyH));
    const w = h * markAspect;
    copy?.style.setProperty("--mark-offset", `${(h + gap) / 2}px`);
    return { x: size.w / 2 - w / 2, y: (size.h - (h + gap + copyH)) / 2, w, h };
  }
  function markTargets(scene: number, widthRatio: number) {
    const c = scratchClear();
    const box = markBox(scene, widthRatio);
    c.drawImage(markImg, box.x, box.y, box.w, box.h);
    return fitTargets(shuffle(sample(c, box, box.w > 420 ? 2 : 1, false).map((t) => ({ ...t, shade: Math.random() < .5 ? 0 : 1 }))), size);
  }
  /** 첫 진입: 심벌 폭만큼의 물결선에서 시작해 심벌로 모입니다. */
  function introLine(): Target[] {
    const box = markBox(0, size.mobile ? .54 : .26);
    const w = box.w * 1.15;
    const cy = box.y + box.h / 2;
    return Array.from({ length: size.count }, () => {
      const t = Math.random();
      return { x: size.w / 2 - w / 2 + t * w, y: cy + Math.sin(t * 12.5) * 18 + gaussian() * 1.5, shade: Math.random() < .5 ? 1 : 2 };
    });
  }

  let waveColumns = 0;
  let waveHeights: number[] = [];
  /** 파형 기둥 하나의 높이: 사인 셋을 섞고 양 끝은 감쇠 곡선으로 줄입니다. */
  function waveHeight(column: number, at: number, loudness: number) {
    const maxH = size.h * (size.mobile ? .12 : .2);
    const energy = Math.abs(Math.sin(.23 * column + .05 * at) * Math.sin(.071 * column - .023 * at) + .35 * Math.sin(.87 * column + .13 * at));
    const envelope = Math.pow(Math.sin(Math.PI * (column + .5) / waveColumns), .7);
    return Math.max(2.5, maxH * Math.min(1, .1 + energy) * envelope * loudness);
  }
  /** 01 독창: 실시간 파형. 입자는 기둥 안의 고정 비율(level)에 서고, 기둥 높이가 매 프레임 바뀝니다. 모션 줄이기에서는 멈춘 파형입니다. */
  function waveTargets() {
    waveColumns = size.mobile ? 64 : 96;
    waveHeights = new Array(waveColumns).fill(4);
    const g = graphicColumn(size);
    const cy = size.h * (size.mobile ? .36 : .5);
    const per = Math.ceil(size.count / waveColumns);
    const gap = g.width / waveColumns;
    const out: Target[] = [];
    for (let column = 0; column < waveColumns; column++) {
      for (let k = 0; k < per; k++) {
        const level = Math.random() * 2 - 1;
        const x = g.left + (column + .5) * gap + gaussian() * .9;
        const shade = Math.abs(level) < .45 ? 0 : Math.abs(level) < .8 ? 1 : 2;
        out.push(reduce
          ? { x, y: cy + level * waveHeight(column, 0, .7), shade: Math.abs(level) < .12 ? 4 : shade } // 4는 가운데 진한 줄
          : { x, y: cy, shade, motion: 1, column, level, centerY: cy });
      }
    }
    return fitTargets(shuffle(out), size);
  }
  /** 02 성부: 음표 하나 */
  function noteTargets() {
    const c = scratchClear();
    const g = graphicColumn(size);
    const h = size.mobile ? size.h * .3 : Math.min(size.h * .42, g.width * .9);
    const cx = size.mobile ? size.w / 2 : g.left + g.width / 2;
    const cy = size.h * (size.mobile ? .36 : .5);
    const s = h / 100;
    c.setTransform(s, 0, 0, s, cx, cy);
    c.fillStyle = "#000";
    c.save(); c.translate(-12, 36); c.rotate(-.35); c.beginPath(); c.ellipse(0, 0, 22, 14, 0, 0, Math.PI * 2); c.fill(); c.restore();
    c.fillRect(6, -50, 5.5, 86);
    c.beginPath(); c.moveTo(11.5, -50); c.bezierCurveTo(14, -28, 44, -24, 32, 10); c.bezierCurveTo(36, -14, 16, -20, 11.5, -32); c.closePath(); c.fill();
    const box = { x: cx - h * .6, y: cy - h * .6, w: h * 1.2, h: h * 1.2 };
    return fitTargets(shuffle(sample(c, box, 1, false).map((t) => ({ ...t, shade: Math.random() < .55 ? 0 : 1 }))), size);
  }
  /** 03 화음: 오선 위에 왼쪽부터 한 음씩 올라가는 네 음표. 가운데 줄 아래 음표는 기둥이 위로, 위 음표는 아래로 뻗습니다. */
  function chordTargets() {
    const c = scratchClear();
    const { left, width: w } = graphicColumn(size);
    const cy = size.h * (size.mobile ? .34 : .5);
    const gap = size.mobile ? 18 : 26;
    const stem = gap * 3.4;
    c.fillStyle = "#000";
    for (let i = -2; i <= 2; i++) c.fillRect(left, cy + i * gap - 1.2, w, 2.4);
    const notes = [.2, .4, .6, .8].map((at, i) => ({ x: left + w * at, y: cy + gap * (1.5 - i) }));
    for (const n of notes) {
      c.save(); c.translate(n.x, n.y); c.rotate(-.35); c.beginPath(); c.ellipse(0, 0, gap * .72, gap * .48, 0, 0, Math.PI * 2); c.fill(); c.restore();
      if (n.y > cy) c.fillRect(n.x + gap * .62, n.y - stem, 3, stem);
      else c.fillRect(n.x - gap * .62 - 3, n.y, 3, stem);
    }
    const points = sample(c, { x: left, y: cy - gap * 4.5, w, h: gap * 9 }, 1, false).map((t) => {
      const onLine = Math.abs((t.y - cy) / gap - Math.round((t.y - cy) / gap)) < .08 && notes.every((n) => Math.abs(t.x - n.x) > gap);
      return { ...t, shade: onLine ? 2 : Math.random() < .6 ? 0 : 1 };
    });
    return fitTargets(shuffle(points), size);
  }
  /** 사진 자리: 04 합창은 오른쪽 4:3 상자, 05 걸어온 길은 연혁 위의 넓은 띠입니다. */
  function photoBoxFor(scene: number): Box {
    const el = scene === 5 ? banner : anchorBox;
    const o = offsetIn(el);
    return { x: o.x, y: o.y, w: el.offsetWidth, h: el.offsetHeight };
  }
  /** 04 합창: 공연 사진의 어두운 픽셀이 입자로 그려집니다. */
  function photoTargets() {
    const c = scratchClear();
    const rect = photoBoxFor(4);
    const scale = Math.max(rect.w / photoImg.naturalWidth, rect.h / photoImg.naturalHeight);
    const dw = photoImg.naturalWidth * scale;
    const dh = photoImg.naturalHeight * scale;
    c.save(); c.beginPath(); c.rect(rect.x, rect.y, rect.w, rect.h); c.clip();
    c.drawImage(photoImg, rect.x + (rect.w - dw) / 2, rect.y + (rect.h - dh) / 2, dw, dh);
    c.restore();
    // 테두리 안쪽 3px와 둥근 모서리 안에서만 뽑아 입자가 사진 밖으로 삐져나오지 않게 합니다.
    const inset = 3;
    const inner = { x: rect.x + inset, y: rect.y + inset, w: rect.w - 2 * inset, h: rect.h - 2 * inset };
    const points = sample(c, inner, 2, true).filter((t) => {
      const dx = Math.max(0, Math.abs(t.x - (rect.x + rect.w / 2)) - (rect.w / 2 - PHOTO_RADIUS));
      const dy = Math.max(0, Math.abs(t.y - (rect.y + rect.h / 2)) - (rect.h / 2 - PHOTO_RADIUS));
      return dx * dx + dy * dy <= (PHOTO_RADIUS - inset) ** 2;
    });
    return fitTargets(shuffle(points), size);
  }
  /** 05 걸어온 길: 연도 점 자리(data-sand="dot")를 잇는 길. PC는 띠를 가로로, 모바일은 세로로 지나며 마지막 점 뒤로는 점점 옅어집니다. */
  function pathTargets() {
    const dots = Array.from(root.querySelectorAll<HTMLElement>('[data-sand="dot"]')).map((el) => {
      const o = offsetIn(el);
      return { x: o.x + el.offsetWidth / 2, y: o.y + el.offsetHeight / 2 };
    });
    if (!dots.length) return fitTargets([], size);
    const c = scratchClear();
    const b = band(size);
    const r = 7;
    const first = dots[0];
    const last = dots[dots.length - 1];
    let rect: Box;
    let end: number;
    let fadeLength: number;
    c.fillStyle = "#000";
    if (size.mobile) {
      const y0 = first.y - 8;
      const y1 = last.y + 84;
      c.fillRect(first.x - 1.2, y0, 2.4, y1 - y0);
      rect = { x: first.x - r - 2, y: y0 - 2, w: 2 * r + 4, h: y1 - y0 + 4 };
      end = last.y;
      fadeLength = y1 - last.y;
    } else {
      const x0 = b.left;
      const x1 = b.left + b.width;
      c.fillRect(x0, first.y - 1.2, x1 - x0, 2.4);
      rect = { x: x0 - 2, y: first.y - r - 2, w: x1 - x0 + 4, h: 2 * r + 4 };
      end = last.x;
      fadeLength = x1 - last.x;
    }
    for (const d of dots) { c.beginPath(); c.arc(d.x, d.y, r, 0, Math.PI * 2); c.fill(); }
    const points = sample(c, rect, 1, false).map((t) => {
      const onDot = dots.some((d) => (t.x - d.x) ** 2 + (t.y - d.y) ** 2 <= (r + 1) ** 2);
      const beyond = (size.mobile ? t.y : t.x) - end;
      return { ...t, shade: onDot ? (Math.random() < .7 ? 0 : 1) : beyond > 0 && Math.random() < beyond / fadeLength ? 3 : 2 };
    });
    return fitTargets(shuffle(points), size);
  }

  let cache: Record<number, Target[]> = {};
  function targetsOf(scene: number) {
    if (cache[scene]) return cache[scene];
    // 캔버스나 이미지가 아직 없으면 흩어진 채로 두고 저장하지 않습니다. 이미지가 준비되면 다시 계산합니다.
    const needsMark = scene === 0 || scene === 6;
    if (!sctx || (needsMark && !imageReady(markImg)) || (scene === 4 && !imageReady(photoImg))) return fitTargets([], size);
    const targets = scene === 0 ? markTargets(0, size.mobile ? .54 : .26)
      : scene === 1 ? waveTargets()
      : scene === 2 ? noteTargets()
      : scene === 3 ? chordTargets()
      : scene === 4 ? photoTargets()
      : scene === 5 ? pathTargets()
      : markTargets(6, size.mobile ? .44 : .21);
    cache[scene] = targets;
    return targets;
  }

  // ── 입자 ──
  let particles: Particle[] = [];
  let particlesReady = false;
  let frame = 0;
  let scene = -1;
  let settleTimer = 0;
  const mouse = { x: -9999, y: -9999 };
  const shocks: { x: number; y: number; r: number; max: number; power: number }[] = [];
  let lastClickAt = -1e9;
  let clickPower = 1;

  function makeParticles() {
    particles = Array.from({ length: size.count }, () => ({
      x: Math.random() * size.w, y: Math.random() * size.h, vx: 0, vy: 0, hx: 0, hy: 0, nhx: 0, nhy: 0,
      shade: 1, nshade: 1, size: .9 + Math.random() * .9, delay: 0, waiting: false, target: null, next: null,
    }));
  }
  /** 입자와 목표를 모두 x 순으로 정렬해 짝지으면 왼쪽부터 쓸려 가며 바뀝니다. */
  function assign(targets: Target[], instant: boolean) {
    const order = particles.map((_, i) => i).sort((a, b) => particles[a].x - particles[b].x);
    const targetOrder = targets.map((_, i) => i).sort((a, b) => targets[a].x - targets[b].x);
    order.forEach((pi, o) => {
      const p = particles[pi];
      const t = targets[targetOrder[o]];
      p.nhx = t.x; p.nhy = t.y; p.nshade = t.shade; p.next = t;
      if (instant || reduce) {
        p.vx = 0; p.vy = 0; p.hx = p.x = t.x; p.hy = p.y = t.y; p.shade = t.shade; p.target = t; p.waiting = false;
      } else {
        p.delay = frame + (o / particles.length) * 36 + 8 * Math.random();
        p.waiting = true;
      }
    });
  }

  // ── 장면 전환 ──
  const photoShown = () => photoBox.hasAttribute("data-show");
  const showPhoto = (on: boolean) => {
    photoBox.toggleAttribute("data-show", on);
    photoBox.setAttribute("aria-hidden", String(!on));
  };
  /** instant면 전환 없이 그 자리에 두고, 아니면 CSS 전환으로 날아갑니다. */
  function placePhoto(box: Box, instant: boolean) {
    if (instant) photoBox.style.transition = "none";
    photoBox.style.left = `${box.x}px`;
    photoBox.style.top = `${box.y}px`;
    photoBox.style.width = `${box.w}px`;
    photoBox.style.height = `${box.h}px`;
    if (instant) { void photoBox.offsetWidth; photoBox.style.transition = ""; }
  }

  /** force는 화면 크기가 바뀌어 같은 장면의 자리를 다시 잡을 때입니다. */
  function setScene(next: number, force = false) {
    const prev = scene;
    if (next === prev && !force) return;
    scene = next;
    root.dataset.current = String(next);
    for (const el of sceneEls) {
      const on = Number(el.dataset.scene) === next;
      el.toggleAttribute("data-active", on);
      el.setAttribute("aria-hidden", String(!on));
      el.toggleAttribute("inert", !on);
    }
    navButtons.forEach((button, i) => {
      if (i === next) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    // 사진: 04에서는 입자가 모인 뒤 나타나고, 05로 넘어가면 그대로 넓어지며 위로 올라갑니다. 되돌아올 때도 날아옵니다.
    const flying = !force && photoShown() && ((next === 4 && prev === 5) || (next === 5 && prev === 4));
    if (next === 4 || next === 5) placePhoto(photoBoxFor(next), !flying);
    if (next === 5) showPhoto(true);
    else if (next !== 4) showPhoto(false);
    else if (!force && !flying) showPhoto(false);

    if (particlesReady) assign(targetsOf(next), false);
    cancel(settleTimer);
    settleTimer = later(() => { if (scene === next && next === 4) showPhoto(true); }, reduce ? 0 : 1200);
  }

  // ── 한 번 넘기면 한 장면 ──
  const wheel = createWheelGesture();
  let tween: { from: number; to: number; at: number; dur: number } | null = null;
  let pending = -1;
  let lockUntil = 0;
  let lastStepAt = -1e9;
  const range = () => Math.max(1, root.offsetHeight - size.h);
  const progress = () => Math.min(1, Math.max(0, -root.getBoundingClientRect().top / range()));
  const moving = () => !!tween || performance.now() < lockUntil;
  const active = () => (pending >= 0 && moving() ? pending : scene);
  function stepTo(target: number) {
    const next = Math.min(SCENE_COUNT - 1, Math.max(0, target));
    if (next === active()) return;
    pending = next;
    lastStepAt = performance.now();
    lockUntil = lastStepAt + (reduce ? 250 : 900);
    const to = root.getBoundingClientRect().top + window.scrollY + sceneScrollOffset(next, range());
    tween = { from: window.scrollY, to, at: performance.now(), dur: reduce ? 0 : 820 };
  }
  const stepBy = (direction: number) => stepTo(active() + direction);

  listen(window, "wheel", (event) => {
    const e = event as WheelEvent;
    if (e.ctrlKey) return; // 확대·축소 제스처는 그대로 둡니다.
    e.preventDefault();
    const delta = e.deltaMode === 1 ? 16 * e.deltaY : e.deltaMode === 2 ? e.deltaY * size.h : e.deltaY;
    const direction = wheel.next(delta, e.timeStamp || performance.now(), performance.now() - lastStepAt, moving());
    if (direction) stepBy(direction);
  }, { passive: false });
  // 한 손가락으로 쓸면 한 장면씩 넘깁니다. 두 손가락 확대와 확대한 화면의 이동은 브라우저에 맡깁니다.
  const zoomed = () => (window.visualViewport?.scale ?? 1) > 1.01;
  let touchY: number | null = null;
  listen(window, "touchstart", (event) => {
    const touches = (event as TouchEvent).touches;
    touchY = touches.length === 1 && !zoomed() ? touches[0].clientY : null;
  }, { passive: true });
  listen(window, "touchmove", (event) => {
    if ((event as TouchEvent).touches.length === 1 && !zoomed()) event.preventDefault();
  }, { passive: false });
  listen(window, "touchend", (event) => {
    if (touchY === null || zoomed()) return;
    const end = (event as TouchEvent).changedTouches[0];
    const d = touchY - (end ? end.clientY : touchY);
    touchY = null;
    if (Math.abs(d) > 30 && !moving()) stepBy(d > 0 ? 1 : -1);
  }, { passive: true });
  listen(window, "keydown", (event) => {
    const e = event as KeyboardEvent;
    if (e.altKey || e.metaKey || e.ctrlKey || e.defaultPrevented) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    const space = e.key === " " && tag !== "BUTTON" && tag !== "A";
    if (e.key === "Home" || e.key === "End") { e.preventDefault(); stepTo(e.key === "Home" ? 0 : SCENE_COUNT - 1); return; }
    const forward = e.key === "ArrowDown" || e.key === "PageDown" || (space && !e.shiftKey);
    const backward = e.key === "ArrowUp" || e.key === "PageUp" || (space && e.shiftKey);
    if (forward || backward) { e.preventDefault(); if (!e.repeat && !moving()) stepBy(forward ? 1 : -1); }
  });
  navButtons.forEach((button, i) => listen(button, "click", () => stepTo(i)));
  const home = pick(root, "home");
  if (home) listen(home, "click", (event) => { event.preventDefault(); stepTo(0); });
  const cue = pick(root, "cue");
  if (cue) listen(cue, "click", () => stepTo(1));
  const top = pick(root, "top");
  if (top) listen(top, "click", () => stepTo(0));
  // 마우스 근처의 모래는 밀려나고, 빈 곳을 누르면 충격파가 퍼집니다. 연달아 누르면 세집니다.
  listen(stage, "mousemove", (event) => {
    const e = event as MouseEvent;
    const rect = stage.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  listen(stage, "mouseleave", () => { mouse.x = -9999; mouse.y = -9999; });
  listen(stage, "click", (event) => {
    const e = event as MouseEvent;
    if ((e.target as Element | null)?.closest("a, button")) return;
    const rect = stage.getBoundingClientRect();
    const now = performance.now();
    clickPower = now - lastClickAt < 1500 ? Math.min(3.2, clickPower * 1.6) : 1;
    lastClickAt = now;
    shocks.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, r: 0, max: Math.max(size.w, size.h), power: clickPower });
  });

  // ── 매 프레임 ──
  let rafId = 0;
  function tick() {
    rafId = 0;
    if (stopped) return;
    frame++;
    if (tween) {
      const t = tween.dur ? Math.min(1, Math.max(0, (performance.now() - tween.at) / tween.dur)) : 1;
      window.scrollTo(0, tween.from + (tween.to - tween.from) * easeInOutCubic(t));
      if (t >= 1) tween = null;
    }
    const current = sceneAt(progress());
    if (current !== scene) setScene(current);
    if (particlesReady && ctx) draw(ctx);
    if (!document.hidden) rafId = window.requestAnimationFrame(tick);
  }
  function draw(c: CanvasRenderingContext2D) {
    if (scene === 1 && !reduce) {
      const loud = .62 + .38 * Math.sin(.019 * frame) * Math.sin(.0073 * frame + 1.3);
      for (let column = 0; column < waveColumns; column++) waveHeights[column] = waveHeight(column, frame, loud);
    }
    for (const layer of layers) layer.length = 0;
    for (let s = shocks.length - 1; s >= 0; s--) { shocks[s].r += 12; if (shocks[s].r > shocks[s].max) shocks.splice(s, 1); }
    for (const p of particles) {
      if (p.waiting && frame >= p.delay) { p.waiting = false; p.hx = p.nhx; p.hy = p.nhy; p.shade = p.nshade; p.target = p.next; }
      const tg = p.target;
      if (!p.waiting && tg?.motion === 1) { p.hx = tg.x; p.hy = (tg.centerY ?? tg.y) + (tg.level ?? 0) * (waveHeights[tg.column ?? 0] ?? 0); }
      const k = tg?.motion ? .09 : .05;
      let ax = (p.hx - p.x) * k + (Math.random() - .5) * .18;
      let ay = (p.hy - p.y) * k + (Math.random() - .5) * .18;
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 95 * 95 && d2 > 0) { const d = Math.sqrt(d2); const f = (1 - d / 95) ** 2 * 6; ax += dx / d * f; ay += dy / d * f; }
      for (const shock of shocks) {
        const sx = p.x - shock.x;
        const sy = p.y - shock.y;
        const sd = Math.sqrt(sx * sx + sy * sy);
        const ring = Math.abs(sd - shock.r);
        if (ring < 46 && sd > 0) { const sf = (1 - ring / 46) * 2.2 * shock.power; ax += sx / sd * sf; ay += sy / sd * sf; }
      }
      p.vx = (p.vx + ax) * .84; p.vy = (p.vy + ay) * .84; p.x += p.vx; p.y += p.vy;
      let layer = p.shade < 0 ? 1 : p.shade;
      if (scene === 1 && tg?.motion === 1 && Math.abs(tg.level ?? 1) < .12) layer = 4;
      layers[layer].push(p);
    }
    c.clearRect(0, 0, size.w, size.h);
    layers.forEach((list, li) => {
      if (!list.length) return;
      c.globalAlpha = palette[li].alpha;
      c.fillStyle = palette[li].color;
      for (const p of list) { const sz = p.size * palette[li].scale; c.fillRect(p.x, p.y, sz, sz); }
    });
    c.globalAlpha = 1;
  }
  const schedule = () => { if (!rafId && !stopped && !document.hidden) rafId = window.requestAnimationFrame(tick); };
  listen(document, "visibilitychange", schedule);

  // ── 크기 변화 ──
  let resizeTimer = 0;
  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver === "function") {
    observer = new ResizeObserver(() => {
      cancel(resizeTimer);
      resizeTimer = later(() => {
        const { w, h, count } = size;
        measure();
        if (size.w === w && size.h === h) return; // 관찰을 시작할 때의 첫 호출처럼 크기가 그대로면 할 일이 없습니다.
        cache = {};
        // 입자 수가 그대로면 흩뿌리지 않고 새 자리로 옮겨 갑니다.
        if (particlesReady && count !== size.count) makeParticles();
        setScene(scene < 0 ? 0 : scene, true);
      }, 150);
    });
    observer.observe(stage);
  }

  // ── 시작 ──
  // 휠을 이 무대가 받으므로 브라우저의 당겨서 새로고침·넘침 효과를 끕니다. 멈출 때 되돌립니다.
  const html = document.documentElement;
  const previousOverscroll = html.style.overscrollBehavior;
  html.style.overscrollBehavior = "none";
  measure();
  setScene(sceneAt(progress()));
  schedule();

  // 입자는 심벌·사진·글꼴이 준비된 뒤 시작합니다(최대 2초 대기). 심벌 위치가 글 위치를 따르기 때문입니다.
  const decode = (img: HTMLImageElement) => (typeof img.decode === "function" ? img.decode() : Promise.resolve());
  let particlesStarted = false;
  const startParticles = () => {
    if (particlesStarted || stopped || !ctx || !sctx) return;
    particlesStarted = true;
    cache = {};
    makeParticles();
    particlesReady = true;
    if (!reduce) assign(introLine(), true);
    assign(targetsOf(scene), reduce);
    // 다음 장면들의 목표를 미리 계산해 넘길 때 끊기지 않게 합니다.
    later(() => { for (let s = 0; s < SCENE_COUNT; s++) if (s !== scene) targetsOf(s); }, 1500);
  };
  const fallback = later(startParticles, 2000);
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  Promise.all([decode(markImg), decode(photoImg), fonts ? fonts.ready : Promise.resolve()])
    .then(() => { cancel(fallback); startParticles(); }, startParticles);
  // 이미지가 시작 뒤에 오면 그 이미지를 쓰는 장면의 목표를 그때 다시 만듭니다.
  const refresh = (scenes: number[]) => () => {
    for (const s of scenes) delete cache[s];
    if (particlesReady && scenes.includes(scene)) assign(targetsOf(scene), false);
  };
  if (!imageReady(photoImg)) listen(photoImg, "load", refresh([4]));
  if (!imageReady(markImg)) listen(markImg, "load", refresh([0, 6]));

  return () => {
    stopped = true;
    if (rafId) window.cancelAnimationFrame(rafId);
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
    observer?.disconnect();
    for (const dispose of disposers) dispose();
    html.style.overscrollBehavior = previousOverscroll;
  };
}
