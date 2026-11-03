import { Skeleton } from "../../components/ui";
import styles from "../member/AdminPages.module.css";

// 세션이나 공지를 기다리는 동안 작성과 수정 화면과 같은 틀로 자리를 잡습니다.
export function NoticeFormSkeleton() {
  return <div className={styles.page}>
    <div className={styles.back}><Skeleton width="var(--space-20)" /></div>
    <div className={styles.skeletonHeader}><Skeleton width="10rem" height="calc(var(--text-title) * 1.2)" /></div>
    <div className={`${styles.detail} ${styles.form}`}>
      <Skeleton width="20%" />
      <Skeleton height="var(--control-medium)" />
      <Skeleton width="20%" />
      <Skeleton height="var(--space-20)" />
      <Skeleton width="20%" />
      <Skeleton height="var(--control-medium)" />
    </div>
  </div>;
}
