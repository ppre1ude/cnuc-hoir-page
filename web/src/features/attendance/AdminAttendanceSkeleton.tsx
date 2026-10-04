import { Skeleton, SkeletonRows } from "../../components/ui";
import styles from "../member/AdminPages.module.css";

const sectionHeight = "calc(var(--text-section) * 1.2)";

// 세션을 기다리는 동안 출석 관리와 같은 틀로 자리를 잡습니다. 라우트의 <main> 안에 놓입니다.
export function AdminAttendanceSkeleton() {
  return <div className={styles.page}>
    <div className={styles.back}><Skeleton width="var(--space-20)" /></div>
    <div className={styles.skeletonHeader}><Skeleton width="var(--space-20)" height="calc(var(--text-title) * 1.2)" /></div>
    <p><Skeleton width="70%" /></p>
    <div className={styles.grid}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}><Skeleton width="30%" height={sectionHeight} /></div>
        <Skeleton width="50%" />
        <div className={styles.actions}><Skeleton width="var(--space-20)" height="var(--control-medium)" /></div>
      </div>
      <div className={styles.panel}>
        <Skeleton className={styles.skeletonHeading} width="30%" height={sectionHeight} />
        <SkeletonRows count={4} />
      </div>
    </div>
  </div>;
}
