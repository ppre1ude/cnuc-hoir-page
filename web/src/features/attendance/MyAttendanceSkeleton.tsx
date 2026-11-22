import { List, Skeleton, SkeletonRows } from "../../components/ui";
import ui from "../../components/ui/ui.module.css";

// 세션을 기다리는 동안 내 출석 기록과 같은 틀로 자리를 잡습니다.
export function MyAttendanceSkeleton() {
  return <div className={ui.readingPage}>
    <div className={ui.pageHeader}><Skeleton width="var(--space-20)" height="calc(var(--text-title) * 1.2)" /></div>
    <List><SkeletonRows count={4} /></List>
  </div>;
}
