"use client";

import { useEffect, useRef } from "react";
import styles from "./ScoreJourney.module.css";

function scorePath(width: number, height: number, offset: number) {
  const mobile = width <= 760;
  const right = width * (mobile ? .9 : .82) + offset;
  const left = width * (mobile ? .85 : .18) + offset;
  // 마지막 문장 옆을 지난 뒤 아래에서 합류해 글자와 오선이 겹치지 않게 합니다.
  return `M ${right} 0 C ${right} ${height * .2} ${left} ${height * .16} ${left} ${height * .38}
    S ${right} ${height * .45} ${right} ${height * .63}
    C ${right} ${height * .86} ${right} ${height * .9} ${width * .55 + offset} ${height}`;
}

export function ScoreJourney() {
  const sectionRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const roadRefs = useRef<(SVGPathElement | null)[]>([]);
  const baseRefs = useRef<(SVGPathElement | null)[]>([]);
  const noteRefs = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    const section = sectionRef.current;
    const svg = svgRef.current;
    if (!section || !svg) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let roads: { element: SVGPathElement; length: number }[] = [];
    let frame = 0;
    let visible = true;
    let cancelled = false;

    const update = () => {
      frame = 0;
      if (cancelled) return;
      const rect = section.getBoundingClientRect();
      const progress = preference.matches ? 1 : Math.max(0, Math.min(1,
        (window.innerHeight * .78 - rect.top) / Math.max(1, rect.height - window.innerHeight * .22)));
      for (const road of roads) road.element.style.strokeDashoffset = String(road.length * (1 - progress));
      const base = roads[2];
      if (!base) return;
      noteRefs.current.forEach((note, index) => {
        if (!note) return;
        const position = Math.max(0, Math.min(.96, progress * .85 - index * .055));
        const point = base.element.getPointAtLength(base.length * position);
        note.setAttribute("transform", `translate(${point.x} ${point.y})`);
        note.style.opacity = preference.matches || progress >= index * .22 ? "1" : "0";
      });
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
      const width = section.clientWidth;
      const height = section.clientHeight;
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      roads = [];
      roadRefs.current.forEach((element, index) => {
        if (!element) return;
        const path = scorePath(width, height, (index - 2) * 10);
        element.setAttribute("d", path);
        baseRefs.current[index]?.setAttribute("d", path);
        const length = element.getTotalLength();
        element.style.strokeDasharray = String(length);
        roads.push({ element, length });
      });
      update();
    };
    const onScroll = () => { if (visible && !preference.matches) schedule(); };
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(section);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
    }, { rootMargin: "100px" });
    intersectionObserver.observe(section);
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
    };
  }, []);

  return <section ref={sectionRef} className={styles.journey} aria-label="합창단의 가치">
    <svg ref={svgRef} className={styles.score} viewBox="0 0 1280 1518" preserveAspectRatio="none"
      aria-hidden="true" focusable="false">
      {[0, 1, 2, 3, 4].map((index) => <g key={index}>
        <path ref={(element) => { baseRefs.current[index] = element; }} className={styles.base}
          d={scorePath(1280, 1518, (index - 2) * 10)} />
        <path ref={(element) => { roadRefs.current[index] = element; }} className={styles.road}
          d={scorePath(1280, 1518, (index - 2) * 10)} />
      </g>)}
      {[0, 1, 2, 3].map((index) => <g className={styles.note} key={index}
        ref={(element) => { noteRefs.current[index] = element; }} transform={`translate(1049 ${850 + index * 24})`}>
        <ellipse rx="11" ry="7" transform="rotate(-20)" />
        <path d="M9 0 V-42" className={styles.stem} />
      </g>)}
    </svg>
    <div className={styles.step}><p><strong>내 목소리</strong>를 알아가고,</p></div>
    <div className={styles.step}><p><strong>나</strong>를 발견하고,</p></div>
    <div className={styles.step}><p>함께 노래하며</p></div>
    <div className={`${styles.step} ${styles.ending}`}><p><strong>우리가 됩니다.</strong></p></div>
  </section>;
}
