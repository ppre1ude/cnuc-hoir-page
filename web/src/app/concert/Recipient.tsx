"use client";

import { useEffect, useState } from "react";
import { typingSteps } from "@/features/concert/typing";

// 제목의 빈칸에 편지를 받을 사람을 썼다 지웁니다. 빈칸 폭이 두 글자라서 이름은 두 글자만 넣습니다.
const NAMES = ["가족", "친구", "연인", "동료", "당신"];
const TYPE = 125, ERASE = 70, HOLD = 1600, REST = 530; // 한 타, 한 글자 지우기, 다 쓰고 머무는 시간, 다 지우고 쉬는 시간(ms)

/** 한 바퀴 동안 보일 글자와 그 글자가 머무는 시간입니다. */
const FRAMES = NAMES.flatMap((name) => {
  const typed = typingSteps(name).map((text, i, all) => ({ text, wait: i === all.length - 1 ? HOLD : TYPE }));
  const erased = [...name].map((_, i, all) => ({ text: name.slice(0, all.length - 1 - i), wait: i === all.length - 1 ? REST : ERASE }));
  return [...typed, ...erased];
});

export function Recipient({ className, caretClassName }: { className?: string; caretClassName?: string }) {
  const [text, setText] = useState("");

  useEffect(() => {
    // 움직임 줄이기를 켠 사람에게는 포스터처럼 빈칸만 보입니다.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    let timer = window.setTimeout(function tick() {
      setText(FRAMES[i].text);
      timer = window.setTimeout(tick, FRAMES[i].wait);
      i = (i + 1) % FRAMES.length;
    }, 900);
    return () => window.clearTimeout(timer);
  }, []);

  // 폭 없는 글자를 늘 두어 빈칸일 때와 글자가 있을 때 밑줄 높이가 같게 합니다.
  return <span className={className} aria-hidden="true">{"​"}{text}<i className={caretClassName} /></span>;
}
