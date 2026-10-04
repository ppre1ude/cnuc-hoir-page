import { Skeleton, SkeletonRows } from "../../components/ui";
import styles from "./AdminPages.module.css";

// 세션을 기다리는 동안 가입 승인과 같은 틀로 자리를 잡습니다. 라우트의 <main> 안에 놓입니다.
export function ApplicationQueueSkeleton() {
  return <div className={styles.page}>
    <div className={styles.skeletonHeader}><Skeleton width="var(--space-20)" height="calc(var(--text-title) * 1.2)" /></div>
    <p><Skeleton width="60%" /></p>
    <SkeletonRows count={3} className={styles.list} />
  </div>;
}
