import { Skeleton } from "../../components/ui";
import styles from "./CheckInPanel.module.css";

// 세션을 기다리는 동안 현장 출석과 같은 틀로 자리를 잡습니다. 라우트의 <main> 안에 놓입니다.
export function CheckInSkeleton() {
  return <div className={styles.panel}>
    <div className={styles.skeletonHeader}><Skeleton width="var(--space-20)" height="calc(var(--text-title) * 1.2)" /></div>
    <div className={styles.state}><Skeleton width="40%" /></div>
    <div className={styles.form}>
      <Skeleton width="45%" />
      <Skeleton height="var(--space-16)" />
      <Skeleton height="var(--control-large)" />
    </div>
  </div>;
}
