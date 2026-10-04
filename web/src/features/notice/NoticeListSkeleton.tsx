import { Skeleton, SkeletonRows } from "../../components/ui";
import styles from "./NoticeList.module.css";

// 세션을 기다리는 동안 공지 목록과 같은 틀로 자리를 잡습니다.
export function NoticeListSkeleton() {
  return <div className={styles.page}>
    <div className={styles.skeletonHeader}><Skeleton width="var(--space-20)" height="calc(var(--text-title) * 1.2)" /></div>
    <SkeletonRows count={5} className={styles.list} />
  </div>;
}
