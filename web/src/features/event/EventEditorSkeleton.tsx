import { Skeleton, SkeletonRows } from "../../components/ui";
import styles from "./EventEditor.module.css";

const sectionHeight = "calc(var(--text-section) * 1.2)";

// 세션을 기다리는 동안 행사 관리와 같은 틀로 자리를 잡습니다. 라우트의 <main> 안에 놓입니다.
export function EventEditorSkeleton() {
  return <div className={styles.page}>
    <div className={styles.skeletonHeader}><Skeleton width="var(--space-20)" height="calc(var(--text-title) * 1.2)" /></div>
    <div className={`${styles.card} ${styles.batch}`}>
      <Skeleton className={styles.skeletonHeading} width="30%" height={sectionHeight} />
      <div className={styles.form}>
        <div className={styles.batchWeekdays}>{Array.from({ length: 7 }, (_, index) => <Skeleton key={index} />)}</div>
        <div className={styles.batchDays}>{Array.from({ length: 35 }, (_, index) => <Skeleton key={index} height="var(--control-medium)" />)}</div>
        <div className={styles.batchFields}>
          {[0, 1].map((index) => <div key={index} className={styles.form}>
            <Skeleton width="45%" />
            <Skeleton height="var(--control-medium)" />
          </div>)}
        </div>
      </div>
    </div>
    <div className={styles.card}>
      <Skeleton className={styles.skeletonHeading} width="25%" height={sectionHeight} />
      <SkeletonRows count={5} />
    </div>
  </div>;
}
