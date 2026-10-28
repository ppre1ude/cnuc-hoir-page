import { Skeleton, SkeletonRows } from "../../components/ui";
import styles from "../member/AdminPages.module.css";

// 세션을 기다리는 동안 공지 관리와 같은 틀로 자리를 잡습니다. 라우트의 <main> 안에 놓입니다.
export function NoticeEditorSkeleton() {
  return <div className={styles.page}>
    <div className={styles.skeletonHeader}><Skeleton width="var(--space-20)" height="calc(var(--text-title) * 1.2)" /></div>
    <div className={styles.workspace}>
      <div>
        <Skeleton height="var(--control-medium)" />
        <SkeletonRows count={5} className={styles.rosterList} />
      </div>
      <div className={`${styles.detail} ${styles.form}`}>
        <Skeleton className={styles.skeletonHeading} width="30%" height="calc(var(--text-section) * 1.2)" />
        <Skeleton width="20%" />
        <Skeleton height="var(--control-medium)" />
        <Skeleton width="20%" />
        <Skeleton height="var(--space-20)" />
      </div>
    </div>
  </div>;
}
