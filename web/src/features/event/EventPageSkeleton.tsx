import { Skeleton } from "../../components/ui";
import styles from "./EventCalendar.module.css";

// 세션을 기다리는 동안 행사 상세와 같은 틀로 자리를 잡습니다.
export function EventPageSkeleton() {
  return <div className={styles.eventPage}>
    <div className={styles.backLink}><Skeleton width="var(--space-16)" /></div>
    <div className={styles.skeletonHeader}><Skeleton width="var(--space-20)" height="calc(var(--text-title) * 1.2)" /></div>
    <div className={`${styles.eventPageCard} ${styles.skeletonStack}`}>
      <Skeleton width="50%" height="calc(var(--text-section) * 1.2)" />
      <Skeleton width="35%" />
      <Skeleton />
      <Skeleton width="90%" />
      <Skeleton width="70%" />
      <Skeleton height="var(--control-large)" />
    </div>
  </div>;
}
