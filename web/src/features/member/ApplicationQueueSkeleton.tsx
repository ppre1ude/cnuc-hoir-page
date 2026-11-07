import { Skeleton, SkeletonRows } from "../../components/ui";
import ui from "../../components/ui/ui.module.css";
import layout from "../../components/ui/layout.module.css";

// 세션을 기다리는 동안 가입 승인과 같은 틀로 자리를 잡습니다. 라우트의 <main> 안에 놓입니다.
export function ApplicationQueueSkeleton() {
  return <div className={ui.page}>
    <div className={ui.pageHeader}><Skeleton width="var(--space-20)" height="calc(var(--text-title) * 1.2)" /></div>
    <p><Skeleton width="60%" /></p>
    <SkeletonRows count={3} className={layout.list} />
  </div>;
}
