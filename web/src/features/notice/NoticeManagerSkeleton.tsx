import { Skeleton, SkeletonRows } from "../../components/ui";
import styles from "./NoticeManager.module.css";

// 세션을 기다리는 동안 공지 관리 목록과 같은 틀로 자리를 잡습니다. 라우트의 <main> 안에 놓입니다.
export function NoticeManagerSkeleton() {
  return <div className={styles.page}>
    <div className={styles.skeletonHeader}>
      <Skeleton width="var(--space-20)" height="calc(var(--text-title) * 1.2)" />
      <Skeleton width="7rem" height="var(--control-medium)" />
    </div>
    <SkeletonRows count={5} />
  </div>;
}
