"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import styles from "./HeroEmphasis.module.css";

export function HeroEmphasis() {
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    // 글꼴이 준비된 뒤 한 번만 움직이며, 그 전에도 문구는 그대로 읽을 수 있습니다.
    document.fonts.ready.then(() => {
      if (!cancelled && elementRef.current) elementRef.current.dataset.enter = "ready";
    });
    return () => { cancelled = true; };
  }, []);

  return <strong ref={elementRef} className={styles.emphasis}>
    <span className={styles.accessibleText}>울림과 감동</span>
    <span aria-hidden="true">
      {[..."울림과 감동"].map((letter, index) =>
        <span className={styles.letter} key={index}
          style={{ "--letter-index": index } as CSSProperties}>{letter}</span>)}
    </span>
  </strong>;
}
