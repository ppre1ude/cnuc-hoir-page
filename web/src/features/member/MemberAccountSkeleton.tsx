import { Skeleton, SkeletonRows } from "../../components/ui";
import styles from "./AdminPages.module.css";

const sectionHeight = "calc(var(--text-section) * 1.2)";

// 세션을 기다리는 동안 단원 정보 관리와 같은 틀로 자리를 잡습니다. 라우트의 <main> 안에 놓입니다.
export function MemberAccountSkeleton() {
  return <div className={styles.page}>
    <div className={styles.skeletonHeader}><Skeleton width="var(--space-20)" height="calc(var(--text-title) * 1.2)" /></div>
    <Skeleton className={styles.skeletonHeading} width="20%" height={sectionHeight} />
    <Skeleton className={styles.callout} height="calc(var(--text-label) * 1.7 * 3)" />
    <div className={styles.registerGrid}>
      <div className={styles.form}>
        {[0, 1, 2].map((index) => <div key={index} className={styles.form}>
          <Skeleton width="35%" />
          <Skeleton height="var(--control-medium)" />
        </div>)}
      </div>
      <div>
        <Skeleton width="45%" height="calc(var(--text-body) * 1.3)" />
        <SkeletonRows count={3} className={styles.pendingList} />
      </div>
    </div>
    <div className={styles.memberSection}>
      <Skeleton className={styles.skeletonHeading} width="20%" height={sectionHeight} />
      <div className={styles.workspace}>
        <SkeletonRows count={6} className={styles.rosterList} />
        <div className={styles.detail}><Skeleton height="var(--space-20)" /></div>
      </div>
    </div>
  </div>;
}
