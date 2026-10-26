"use client";

import { useEffect, useRef } from "react";
import Image, { getImageProps } from "next/image";
import { BRAND_MARK } from "../../lib/brandMark";
import { startSandMark } from "./sandMarkStage";
import styles from "./LoginPoster.module.css";

const WIDTH = 540;
const HEIGHT = Math.round(WIDTH * BRAND_MARK.height / BRAND_MARK.width);

/** 합창단 심벌을 글자색 모래 입자로 그리는 상자입니다. 캔버스를 못 쓰거나 자바스크립트가 없으면 흰색으로 바꾼 심벌 이미지를 대신 보입니다. */
export function SandMark({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const src = getImageProps({ src: BRAND_MARK.src, alt: "", width: WIDTH, height: HEIGHT }).props.src;

  useEffect(() => {
    const root = rootRef.current;
    return root ? startSandMark(root, src) : undefined;
  }, [src]);

  return <div ref={rootRef} className={className} role="img" aria-label="전남대학교 합창단">
    <canvas className={styles.canvas} aria-hidden="true" />
    <Image className={styles.fallback} src={BRAND_MARK.src} alt="" width={WIDTH} height={HEIGHT} />
  </div>;
}
