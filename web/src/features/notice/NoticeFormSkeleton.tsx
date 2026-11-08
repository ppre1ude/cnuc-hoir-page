import { Panel, Skeleton } from "../../components/ui";
import ui from "../../components/ui/ui.module.css";
import layout from "../../components/ui/layout.module.css";

// 세션이나 공지를 기다리는 동안 작성과 수정 화면과 같은 틀로 자리를 잡습니다.
export function NoticeFormSkeleton() {
  return <div className={ui.page}>
    <div className={layout.back}><Skeleton width="var(--space-20)" /></div>
    <div className={ui.pageHeader}><Skeleton width="10rem" height="calc(var(--text-title) * 1.2)" /></div>
    <Panel><div className={layout.form}>
      <div className={layout.field}><Skeleton width="20%" /><Skeleton height="var(--control-medium)" /></div>
      <div className={layout.field}><Skeleton width="20%" /><Skeleton height="var(--space-20)" /></div>
      <div className={layout.field}><Skeleton width="20%" /><Skeleton height="var(--control-medium)" /></div>
    </div></Panel>
  </div>;
}
