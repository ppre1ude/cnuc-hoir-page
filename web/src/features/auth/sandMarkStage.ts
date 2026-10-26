// 로그인 포스터의 심벌을 모래 입자로 그립니다. 공개 메인의 모래 장면(onboarding/sand)과 같은 기법이지만,
// 장면 하나에 심벌 하나뿐이라 그 엔진을 끌어오지 않고 작은 엔진을 따로 둡니다.
// 처음에는 상자 전체에 흩뿌린 입자가 왼쪽부터 심벌로 모이고, 그 뒤에는 제자리에서 가늘게 흔들리며 포인터를 피합니다.

type Point = { x: number; y: number; shade: number };
type Particle = Point & { hx: number; hy: number; vx: number; vy: number; size: number; delay: number };

/** 농도 단계별 불투명도. 진함 0부터 옅음 2까지입니다. */
const ALPHA = [.95, .62, .36];
const PUSH_RADIUS = 70;
const FAR = -1e4;

/** 불투명한 자리를 step 간격으로 뽑습니다. 농도는 무작위로 섞어 모래 질감을 냅니다. */
export function sampleMark(data: Uint8ClampedArray, width: number, height: number, step: number, random = Math.random): Point[] {
  const out: Point[] = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = 4 * (Math.floor(y) * width + Math.floor(x));
      if (data[i + 3] < 120) continue;
      const r = random();
      out.push({ x: x + random() * step, y: y + random() * step, shade: r < .5 ? 0 : r < .8 ? 1 : 2 });
    }
  }
  return out;
}

/** 입자 수가 대략 count가 되는 표본 간격입니다. 심벌은 상자의 1/3쯤을 채웁니다. */
export function sampleStep(width: number, height: number, count: number) {
  return Math.max(1.5, Math.sqrt(width * height / (count * 3)));
}

function context2d(target: HTMLCanvasElement, settings?: CanvasRenderingContext2DSettings) {
  try { return target.getContext("2d", settings); } catch { return null; }
}

/** 상자 안의 캔버스에 src 심벌을 입자로 그리고, 멈추는 함수를 돌려줍니다. 캔버스를 못 쓰거나 이미지를 못 받으면 상자에 data-sand-mark="fallback"을 붙입니다. */
export function startSandMark(root: HTMLElement, src: string): () => void {
  const found = root.querySelector("canvas");
  const paintOrNull = found && context2d(found);
  const scratch = document.createElement("canvas");
  const probeOrNull = paintOrNull && context2d(scratch, { willReadFrequently: true });
  const fallback = () => { root.dataset.sandMark = "fallback"; };
  if (!found || !paintOrNull || !probeOrNull) { fallback(); return () => {}; }
  // 아래 함수 선언 안에서도 null이 아니라고 알도록 타입을 적어 다시 둡니다.
  const canvas: HTMLCanvasElement = found;
  const ctx: CanvasRenderingContext2D = paintOrNull;
  const sctx: CanvasRenderingContext2D = probeOrNull;

  const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ink = getComputedStyle(root).color;
  const mouse = { x: FAR, y: FAR };
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  let stopped = false;
  let loaded = false;
  let rafId = 0;
  let frame = 0;
  let w = 0;
  let h = 0;
  let particles: Particle[] = [];
  const disposers: (() => void)[] = [];
  const listen = (target: EventTarget, type: string, handler: EventListener) => {
    target.addEventListener(type, handler);
    disposers.push(() => target.removeEventListener(type, handler));
  };

  function measure() {
    const rect = root.getBoundingClientRect();
    w = Math.round(rect.width);
    h = Math.round(rect.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** 심벌을 상자 크기로 임시 캔버스에 그려 자리를 뽑고 왼쪽부터 늘어놓습니다. */
  function targets(): Point[] {
    if (!w || !h) return [];
    scratch.width = w;
    scratch.height = h;
    sctx.clearRect(0, 0, w, h);
    sctx.drawImage(img, 0, 0, w, h);
    let data: Uint8ClampedArray;
    try { data = sctx.getImageData(0, 0, w, h).data; } catch { return []; }
    return sampleMark(data, w, h, sampleStep(w, h, w > 400 ? 5200 : 3400)).sort((a, b) => a.x - b.x);
  }

  /** instant면 자리에 바로 놓고, 아니면 지금 위치(처음엔 흩뿌린 자리)에서 차례로 출발합니다. 크기가 바뀌면 입자가 새 자리로 옮겨 갑니다. */
  function place(instant: boolean) {
    const points = targets();
    const previous = particles;
    particles = points.map((t, i) => {
      const from = previous[i] ?? { x: Math.random() * w, y: Math.random() * h };
      return {
        x: instant ? t.x : from.x, y: instant ? t.y : from.y, vx: 0, vy: 0, hx: t.x, hy: t.y, shade: t.shade,
        size: 1 + Math.random() * .9, delay: instant ? 0 : frame + (i / points.length) * 30 + Math.random() * 10,
      };
    });
  }

  function draw() {
    const layers: Particle[][] = [[], [], []];
    for (const p of particles) {
      if (!reduce) {
        const ready = frame >= p.delay;
        let ax = (ready ? (p.hx - p.x) * .05 : 0) + (Math.random() - .5) * .18;
        let ay = (ready ? (p.hy - p.y) * .05 : 0) + (Math.random() - .5) * .18;
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < PUSH_RADIUS * PUSH_RADIUS && d2 > 0) {
          const d = Math.sqrt(d2);
          const f = (1 - d / PUSH_RADIUS) ** 2 * 5;
          ax += dx / d * f;
          ay += dy / d * f;
        }
        p.vx = (p.vx + ax) * .84;
        p.vy = (p.vy + ay) * .84;
        p.x += p.vx;
        p.y += p.vy;
      }
      layers[p.shade].push(p);
    }
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = ink;
    layers.forEach((list, i) => {
      ctx.globalAlpha = ALPHA[i];
      for (const p of list) ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
  }

  function tick() {
    rafId = 0;
    if (stopped) return;
    frame++;
    draw();
    if (!document.hidden) rafId = window.requestAnimationFrame(tick);
  }
  /** 모션 줄이기면 한 번만 그리고 움직이지 않습니다. 탭이 숨으면 멈췄다가 돌아오면 다시 돕니다. */
  const schedule = () => {
    if (stopped || !loaded) return;
    if (reduce) draw();
    else if (!rafId && !document.hidden) rafId = window.requestAnimationFrame(tick);
  };
  listen(document, "visibilitychange", schedule);

  listen(window, "pointermove", (event) => {
    const { clientX, clientY } = event as PointerEvent;
    const rect = canvas.getBoundingClientRect();
    mouse.x = clientX - rect.left;
    mouse.y = clientY - rect.top;
  });
  // 손가락을 떼면 밀려난 자리가 메워지도록 포인터를 멀리 둡니다. 마우스는 올려 둔 자리를 그대로 피합니다.
  const release = (event: Event) => { if ((event as PointerEvent).pointerType !== "mouse") { mouse.x = FAR; mouse.y = FAR; } };
  listen(window, "pointerup", release);
  listen(window, "pointercancel", release);
  listen(document, "pointerleave", () => { mouse.x = FAR; mouse.y = FAR; });

  let resizeTimer = 0;
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (stopped || !loaded) return;
      // 크기가 그대로면 재측정하지 않습니다. 캔버스 크기를 다시 쓰면 그림이 지워지는데, 모션 줄이기에서는 다시 그리지 않기 때문입니다.
      const rect = root.getBoundingClientRect();
      if (Math.round(rect.width) === w && Math.round(rect.height) === h) return;
      measure();
      place(reduce);
      schedule();
    }, 150);
  }) : null;
  observer?.observe(root);

  measure();
  const decode = typeof img.decode === "function" ? img.decode()
    : new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error("mark")); });
  decode.then(() => {
    if (stopped) return;
    loaded = true;
    measure();
    place(reduce);
    schedule();
  }, () => { if (!stopped) fallback(); });

  return () => {
    stopped = true;
    if (rafId) window.cancelAnimationFrame(rafId);
    window.clearTimeout(resizeTimer);
    observer?.disconnect();
    for (const dispose of disposers) dispose();
  };
}
