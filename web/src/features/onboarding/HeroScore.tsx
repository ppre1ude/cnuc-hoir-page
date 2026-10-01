import styles from "./HeroScore.module.css";

// 로고의 오선과 음표 형태를 확장한 장식이며 실제 곡의 악보를 나타내지 않습니다.
function ScoreStrip() {
  return <svg viewBox="0 0 480 160" className={styles.strip} focusable="false">
    <g className={styles.staff} fill="none" stroke="currentColor" strokeWidth="2">
      {[32, 48, 64, 80, 96].map((height) =>
        <path key={height} d={`M0 ${height} C80 ${height - 18} 160 ${height - 18} 240 ${height} S400 ${height + 18} 480 ${height}`} />)}
    </g>
    <g fill="currentColor">
      <g transform="translate(92 68)">
        <ellipse rx="10" ry="6.5" transform="rotate(-22)" />
        <path d="M7 -2 L-3 -47 L1 -48 L11 -3 Z" />
      </g>
      <g transform="translate(248 96)">
        <ellipse rx="10" ry="6.5" transform="rotate(-22)" />
        <path d="M7 -2 L11 -53 L15 -53 L11 -2 Z" />
        <path d="M13 -53 C20 -43 36 -40 31 -26 C28 -18 24 -12 19 -8 C25 -19 28 -29 22 -34 L12 -39 Z" />
      </g>
      <g transform="translate(388 72)">
        <ellipse rx="10" ry="6.5" transform="rotate(-22)" />
        <path d="M7 -2 L7 -48 L11 -48 L11 -2 Z" />
      </g>
    </g>
  </svg>;
}

export function HeroScore() {
  return <div className={styles.score} aria-hidden="true">
    {(["left", "right"] as const).map((side) =>
      <div className={`${styles.side} ${styles[side]}`} key={side}>
        <div className={styles.sway}>
          <div className={styles.track}><ScoreStrip /><ScoreStrip /></div>
        </div>
      </div>)}
  </div>;
}
