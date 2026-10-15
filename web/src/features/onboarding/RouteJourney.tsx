"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import Image from "next/image";
import styles from "./RouteJourney.module.css";

// 공개 메인의 네 문장을 노선도처럼 읽습니다. 역 셋을 지나 종착역인 무대에 닿습니다.
type Pictogram = "voice" | "self" | "together";
type Stop = { side: "left" | "right"; pictogram: Pictogram; text: ReactNode };

const stops: Stop[] = [
  { side: "left", pictogram: "voice", text: <><strong>내 목소리</strong>를 알아가고,</> },
  { side: "right", pictogram: "self", text: <><strong>나</strong>를 발견하고,</> },
  { side: "left", pictogram: "together", text: <>함께 노래하며</> },
];

const BEND_TOP = 44;   // 위쪽 꺾임이 시작되는 세로 위치
const RADIUS = 22;     // 꺾임 모서리의 둥근 정도
const SAMPLES = 400;   // 노선 길이를 세로 위치로 바꾸기 위한 표본 수

function startX(width: number) {
  return Math.round(width * (width <= 760 ? .64 : .58));
}

// 수직으로 내려오다 45도 대각선으로 옮겨 다시 수직으로 잇습니다. 꺾이는 자리는 둥글게 합니다.
function jog(x1: number, y1: number, x2: number, r: number) {
  const sign = x2 < x1 ? -1 : 1;
  const run = Math.abs(x2 - x1);
  return ` V ${y1 - r} Q ${x1} ${y1} ${x1 + sign * r * .7} ${y1 + r * .7}`
    + ` L ${x2 - sign * r * .7} ${y1 + run - r * .7} Q ${x2} ${y1 + run} ${x2} ${y1 + run + r}`;
}

function routePath(width: number, height: number, railX: number, lastStopY: number) {
  const endX = Math.round(width / 2);
  let d = `M ${startX(width)} 0${jog(startX(width), BEND_TOP, railX, RADIUS)}`;
  if (Math.abs(endX - railX) > 2) {
    // 마지막 역을 지난 뒤 가운데로 꺾어 종착역으로 들어갑니다. 꺾임은 초록 블록 가장자리 전에 끝납니다.
    const turn = height - (Math.abs(endX - railX) + RADIUS + 30);
    d += `${jog(railX, Math.max(lastStopY + 50, turn), endX, RADIUS)} V ${height}`;
  } else {
    d += ` V ${height}`;
  }
  return d;
}

// 역 픽토그램. 길 안내 표지판의 언어로 세 문장을 그립니다.
function Pictograms({ id }: { id: string }) {
  return <svg className={styles.defs} aria-hidden="true" focusable="false">
    <defs>
      <symbol id={`${id}-voice`} viewBox="0 0 76 76" overflow="visible">
        <g className={styles.ink}><circle cx="20" cy="24" r="10" /><path d="M4 76 V54 a16 16 0 0 1 32 0 V76 Z" /></g>
        <g className={styles.line}><path d="M41.5 14.4 A15 15 0 0 1 41.5 33.6" /><path d="M49.2 7.9 A25 25 0 0 1 49.2 40.1" /><path d="M56.8 1.5 A35 35 0 0 1 56.8 46.5" /></g>
      </symbol>
      <symbol id={`${id}-self`} viewBox="0 0 76 76" overflow="visible">
        <path className={styles.light} d="M38 2 L6 76 H70 Z" />
        <g className={styles.ink}><circle cx="38" cy="30" r="10" /><path d="M22 76 V58 a16 16 0 0 1 32 0 V76 Z" /></g>
      </symbol>
      <symbol id={`${id}-together`} viewBox="0 0 76 76" overflow="visible">
        <g className={styles.ink}>
          <circle cx="10" cy="44" r="7" /><path d="M0 76 V58 a10 10 0 0 1 20 0 V76 Z" />
          <circle cx="29" cy="40" r="7" /><path d="M19 76 V54 a10 10 0 0 1 20 0 V76 Z" />
          <circle cx="47" cy="40" r="7" /><path d="M37 76 V54 a10 10 0 0 1 20 0 V76 Z" />
          <circle cx="66" cy="44" r="7" /><path d="M56 76 V58 a10 10 0 0 1 20 0 V76 Z" />
        </g>
        <g className={styles.line}><path d="M25.7 25.7 A16 16 0 0 1 50.3 25.7" /><path d="M16.6 18 A28 28 0 0 1 59.4 18" /></g>
      </symbol>
    </defs>
  </svg>;
}

// description은 합창단 소개 한 문장이며 종착역 블록의 마지막 문장 아래에 둡니다.
export function RouteJourney({ description }: { description?: ReactNode }) {
  const id = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const casingRef = useRef<SVGPathElement>(null);
  const baseRef = useRef<SVGPathElement>(null);
  const railRef = useRef<SVGPathElement>(null);
  const tintRef = useRef<HTMLDivElement>(null);
  const stopsRef = useRef<HTMLDivElement>(null);
  const finaleRef = useRef<HTMLDivElement>(null);
  const stopRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const section = sectionRef.current, area = areaRef.current, svg = svgRef.current, stopsBox = stopsRef.current;
    const casing = casingRef.current, base = baseRef.current, rail = railRef.current, tint = tintRef.current, finale = finaleRef.current;
    if (!section || !area || !svg || !stopsBox || !casing || !base || !rail || !tint || !finale) return;
    // 경로 길이 API가 없는 환경에서는 완성된 노선과 역을 그대로 보여 줍니다.
    if (typeof rail.getTotalLength !== "function") return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stopElements = stopRefs.current.filter((element): element is HTMLDivElement => element !== null);
    let samples: { y: number; len: number }[] = [];
    let railLength = 0;
    let stopY: number[] = [];
    let frame = 0;
    let visible = true;
    let cancelled = false;
    // 이때부터 역과 무대 사진을 스크롤 진행에 맞춰 드러냅니다.
    section.dataset.ready = "true";

    const readStops = () => {
      const areaRect = area.getBoundingClientRect();
      let railX = 0;
      const ys = stopElements.map((stop) => {
        const badge = stop.firstElementChild?.getBoundingClientRect();
        if (!badge) return 0;
        railX = badge.left - areaRect.left + badge.width / 2;
        return badge.top - areaRect.top + badge.height / 2;
      });
      return { ys, railX: Math.round(railX) };
    };

    const lengthAtY = (y: number) => {
      // 표본점의 세로 위치는 단조 증가하므로 이분 탐색으로 길이를 찾습니다.
      let lo = 0, hi = samples.length - 1;
      if (y <= samples[0].y) return 0;
      if (y >= samples[hi].y) return samples[hi].len;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (samples[mid].y < y) lo = mid; else hi = mid; }
      const a = samples[lo], b = samples[hi], t = (y - a.y) / Math.max(1e-6, b.y - a.y);
      return a.len + (b.len - a.len) * t;
    };

    const update = () => {
      frame = 0;
      if (cancelled || !samples.length) return;
      const height = area.clientHeight;
      const areaTop = area.getBoundingClientRect().top;
      // 화면 세로 60% 지점까지 노선이 그려집니다. 모션 줄이기 설정에서는 완성된 노선을 보여 줍니다.
      const tipY = preference.matches ? height : Math.max(0, Math.min(height, window.innerHeight * .6 - areaTop));
      rail.style.strokeDashoffset = String(railLength - lengthAtY(tipY));
      tint.style.opacity = String(tipY / height);
      stopElements.forEach((stop, index) => stop.classList.toggle(styles.on, preference.matches || tipY >= stopY[index] - 4));
      finale.classList.toggle(styles.on, preference.matches || tipY >= height - 4);
    };

    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
      if (cancelled) return;
      const width = area.clientWidth;
      // 첫 역은 위쪽 꺾임이 끝난 뒤에, 마지막 역은 아래쪽 꺾임이 시작되기 전에 오도록 여백을 맞춥니다.
      stopsBox.style.paddingTop = "0px";
      stopsBox.style.paddingBottom = "0px";
      const raw = readStops();
      const needTop = BEND_TOP + Math.abs(startX(width) - raw.railX) + RADIUS + 48;
      const runEnd = Math.abs(Math.round(width / 2) - raw.railX);
      const needBottom = runEnd > 2 ? 50 + runEnd + RADIUS + 54 : 40;
      stopsBox.style.paddingTop = `${Math.max(0, needTop - raw.ys[0])}px`;
      stopsBox.style.paddingBottom = `${Math.max(0, needBottom - (area.clientHeight - raw.ys[raw.ys.length - 1]))}px`;
      const height = area.clientHeight;
      const placed = readStops();
      stopY = placed.ys;
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      const d = routePath(width, height, placed.railX, stopY[stopY.length - 1]);
      casing.setAttribute("d", d);
      base.setAttribute("d", d);
      rail.setAttribute("d", d);
      railLength = rail.getTotalLength();
      rail.style.strokeDasharray = String(railLength);
      samples = [];
      for (let index = 0; index <= SAMPLES; index += 1) {
        const len = railLength * index / SAMPLES;
        samples.push({ y: rail.getPointAtLength(len).y, len });
      }
      update();
    };

    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    const onScroll = () => { if (visible && !preference.matches) schedule(); };
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(area);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
    }, { rootMargin: "120px" });
    intersectionObserver.observe(area);
    window.addEventListener("scroll", onScroll, { passive: true });
    // 화면 높이만 바뀌어도 스크롤 진행률을 다시 계산합니다.
    window.addEventListener("resize", schedule);
    preference.addEventListener("change", schedule);
    document.fonts.ready.then(() => { if (!cancelled) measure(); });
    measure();

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
      preference.removeEventListener("change", schedule);
      window.cancelAnimationFrame(frame);
      delete section.dataset.ready;
    };
  }, []);

  return <section ref={sectionRef} className={styles.journey} aria-label="합창단의 가치">
    <Pictograms id={id} />
    <div ref={areaRef} className={styles.routeArea}>
      <div ref={tintRef} className={styles.tint} aria-hidden="true" />
      <svg ref={svgRef} className={styles.route} viewBox="0 0 1280 1200" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path ref={casingRef} className={styles.casing} />
        <path ref={baseRef} className={styles.railBase} />
        <path ref={railRef} className={styles.rail} />
      </svg>
      <div ref={stopsRef} className={styles.stops}>
        {stops.map((stop, index) => <div key={stop.pictogram} className={styles.stop} data-side={stop.side}
          ref={(element) => { stopRefs.current[index] = element; }}>
          <span className={styles.badge} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <p className={styles.text}>{stop.text}</p>
          <svg className={styles.pict} aria-hidden="true" focusable="false"><use href={`#${id}-${stop.pictogram}`} /></svg>
        </div>)}
      </div>
    </div>
    <div ref={finaleRef} className={styles.finale}>
      <span className={styles.terminal} aria-hidden="true" />
      <div className={styles.finaleInner}>
        <div className={styles.stageCard}>
          <Image src="/images/choir-performance.jpg" alt="지휘자와 단원들이 무대에서 합창하는 모습" width={2880} height={2160}
            sizes="(max-width: 760px) calc(100vw - 40px), 760px" />
        </div>
        <p className={styles.finaleText}><strong>우리가 됩니다.</strong></p>
        {description && <p className={styles.description}>{description}</p>}
      </div>
    </div>
  </section>;
}
