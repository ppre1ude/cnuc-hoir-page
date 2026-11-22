"use client";

import { useId, useState } from "react";
import { BrandLogo } from "../../components/ui";
import type { Greeting } from "../../features/concert/greetings";
import styles from "./gallery.module.css";

/** 줄 쳐진 편지지 한 장. 처음에는 접혀 있어 첫 문단만 보이고, 아래 가장자리의 밀랍 봉인을 누르면 나머지가 펼쳐집니다. */
export function Letter({ greeting }: { greeting: Greeting }) {
  const [open, setOpen] = useState(false);
  const restId = useId();
  const [first, ...rest] = greeting.paragraphs;

  return (
    <div className={styles.letter} data-open={open || undefined}>
      <header className={styles.letterHead}>
        <h3>{greeting.heading}</h3>
        <p><strong>{greeting.name}</strong> {greeting.role}</p>
      </header>
      <p className={styles.line}>{first}</p>
      {/* 접힌 부분은 화면 읽기 프로그램에도 접힌 것으로 알립니다. */}
      <div className={styles.rest} id={restId} inert={!open}>
        <div>
          <div className={styles.flap}>
            {rest.map((paragraph) => <p className={styles.line} key={paragraph}>{paragraph}</p>)}
          </div>
        </div>
      </div>
      <button type="button" className={styles.unfold} aria-expanded={open} aria-controls={restId} onClick={() => setOpen(!open)}>
        <span className={styles.seal} aria-hidden="true"><BrandLogo mark alt="" /></span>
        {open ? "편지 접기" : "편지 펼치기"}
      </button>
    </div>
  );
}
