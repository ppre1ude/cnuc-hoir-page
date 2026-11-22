import { Panel, Skeleton } from "../../components/ui";
import ui from "../../components/ui/ui.module.css";
import layout from "../../components/ui/layout.module.css";
import styles from "./EventCalendar.module.css";

// 세션을 기다리는 동안 일정 상세와 같은 틀로 자리를 잡습니다.
export function EventPageSkeleton() {
  return <div className={ui.readingPage}>
    <div className={layout.back}><Skeleton width="var(--space-16)" /></div>
    <div className={ui.pageHeader}><Skeleton width="var(--space-20)" height="calc(var(--text-title) * 1.2)" /></div>
    <Panel className={styles.skeletonStack}>
      <Skeleton width="50%" height="calc(var(--text-section) * 1.2)" />
      <Skeleton width="35%" />
      <Skeleton />
      <Skeleton width="90%" />
      <Skeleton width="70%" />
      <Skeleton height="var(--control-large)" />
    </Panel>
  </div>;
}
