import { Skeleton, SkeletonRows } from "../../components/ui";
import styles from "./AdminPages.module.css";

const sectionHeight = "calc(var(--text-section) * 1.2)";

// 세션을 기다리는 동안 단원 계정과 같은 틀로 자리를 잡습니다. 라우트의 <main> 안에 놓입니다.
export function MemberAccountSkeleton() {
  return <div className={styles.page}>
    <div className={styles.skeletonHeader}><Skeleton width="var(--space-20)" height="calc(var(--text-title) * 1.2)" /></div>
    <div className={styles.grid}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}><Skeleton width="30%" height={sectionHeight} /></div>
        <div className={styles.form}>
          {[0, 1, 2].map((index) => <div key={index} className={styles.form}>
            <Skeleton width="35%" />
            <Skeleton height="var(--control-medium)" />
          </div>)}
        </div>
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHeader}><Skeleton width="45%" height={sectionHeight} /></div>
        <SkeletonRows count={3} />
      </div>
    </div>
    <div className={styles.memberSection}>
      <Skeleton className={styles.skeletonHeading} width="20%" height={sectionHeight} />
      <SkeletonRows count={4} className={styles.list} />
    </div>
  </div>;
}
