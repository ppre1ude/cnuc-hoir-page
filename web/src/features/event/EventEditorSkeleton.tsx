import { Skeleton, SkeletonRows } from "../../components/ui";
import styles from "./EventEditor.module.css";

const sectionHeight = "calc(var(--text-section) * 1.2)";

// 세션을 기다리는 동안 일정 관리와 같은 틀로 자리를 잡습니다. 라우트의 <main> 안에 놓입니다.
export function EventEditorSkeleton() {
  return <div className={styles.page}>
    <div className={styles.skeletonHeader}><Skeleton width="var(--space-20)" height="calc(var(--text-title) * 1.2)" /></div>
    <div className={styles.section}>
      <Skeleton className={styles.skeletonHeading} width="20%" height={sectionHeight} />
      <div className={styles.workspace}>
        <div>
          <Skeleton height="var(--control-medium)" />
          <div className={styles.days} style={{ marginTop: "var(--space-4)" }}>{Array.from({ length: 35 }, (_, index) => <Skeleton key={index} height="36px" />)}</div>
        </div>
        <div className={styles.fieldGrid}>
          {[0, 1, 2, 3].map((index) => <div key={index}><Skeleton width="45%" /><Skeleton height="var(--control-medium)" /></div>)}
        </div>
      </div>
    </div>
    <div className={styles.section}>
      <Skeleton className={styles.skeletonHeading} width="20%" height={sectionHeight} />
      <div className={styles.workspace}>
        <SkeletonRows count={5} className={styles.rosterList} />
        <div className={styles.detail}><Skeleton height="var(--space-20)" /></div>
      </div>
    </div>
  </div>;
}
