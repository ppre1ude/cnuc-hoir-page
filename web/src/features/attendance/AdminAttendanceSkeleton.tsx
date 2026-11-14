import { Panel, Section, Skeleton, SkeletonRows } from "../../components/ui";
import ui from "../../components/ui/ui.module.css";
import layout from "../../components/ui/layout.module.css";
import styles from "../member/AdminPages.module.css";

const sectionHeight = "calc(var(--text-section) * 1.2)";

// 세션을 기다리는 동안 출석 관리와 같은 틀로 자리를 잡습니다. 라우트의 <main> 안에 놓입니다.
export function AdminAttendanceSkeleton() {
  return <div className={ui.page}>
    <div className={layout.back}><Skeleton width="var(--space-20)" /></div>
    <div className={ui.pageHeader}><Skeleton width="var(--space-20)" height="calc(var(--text-title) * 1.2)" /></div>
    <p><Skeleton width="70%" /></p>
    <div className={styles.grid}>
      <Panel>
        <Section titleProps={{ "aria-hidden": true }} title={<Skeleton width="30%" height={sectionHeight} />}>
          <Skeleton width="50%" />
          <div className={styles.actions}><Skeleton width="var(--space-20)" height="var(--control-medium)" /></div>
        </Section>
      </Panel>
    </div>
    <Section titleProps={{ "aria-hidden": true }} title={<Skeleton width="30%" height={sectionHeight} />}>
      <div className={styles.workspace}>
        <SkeletonRows count={4} className={layout.list} />
        <div className={styles.detail}><Panel><Skeleton height="var(--space-20)" /></Panel></div>
      </div>
    </Section>
  </div>;
}
