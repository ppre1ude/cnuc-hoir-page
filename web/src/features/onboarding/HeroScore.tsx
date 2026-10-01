import { useId } from "react";
import styles from "./HeroScore.module.css";

// 로고의 오선과 음표 형태를 확장한 장식이며 실제 곡의 악보가 아닙니다.
function ScoreCanvas({ id, mobile = false }: { id: string; mobile?: boolean }) {
  const width = mobile ? 420 : 580;
  const height = width * 140 / 580;
  return <svg className={`${styles.canvas} ${mobile ? styles.mobile : styles.desktop}`}
    focusable="false" height={height}>
    <defs>
      <pattern id={id} width={width} height={height} patternUnits="userSpaceOnUse" viewBox="0 0 580 140">
        <g fill="none" stroke="currentColor" strokeWidth="2">
          {[30, 48, 66, 84, 102].map((y) =>
            <path key={y} d={`M0 ${y} C100 ${y - 12} 160 ${y - 12} 260 ${y} S460 ${y + 12} 580 ${y}`} />)}
          <path d="M189 65 V20" /><path d="M389 91 V43 Q420 54 399 75" />
        </g>
        <g fill="currentColor">
          <ellipse cx="180" cy="66" rx="10" ry="7" transform="rotate(-20 180 66)" />
          <ellipse cx="380" cy="92" rx="10" ry="7" transform="rotate(-20 380 92)" />
        </g>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>;
}

export function HeroScore() {
  const id = useId();
  return <div className={styles.score} aria-hidden="true">
    <ScoreCanvas id={`${id}-desktop`} /><ScoreCanvas id={`${id}-mobile`} mobile />
  </div>;
}
