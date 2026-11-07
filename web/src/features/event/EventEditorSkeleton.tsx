import { Panel, Section, Skeleton, SkeletonRows } from "../../components/ui";
import ui from "../../components/ui/ui.module.css";
import layout from "../../components/ui/layout.module.css";
import styles from "./EventEditor.module.css";

const sectionHeight = "calc(var(--text-section) * 1.2)";

// 세션을 기다리는 동안 일정 관리와 같은 틀로 자리를 잡습니다. 라우트의 <main> 안에 놓입니다.
export function EventEditorSkeleton() {
  return <div className={ui.page}>
    <div className={ui.pageHeader}><Skeleton width="var(--space-20)" height="calc(var(--text-title) * 1.2)" /></div>
    <Section title={<Skeleton width="20%" height={sectionHeight} />}>
      <div className={styles.workspace}>
        <div>
          <Skeleton height="var(--control-medium)" />
          <div className={styles.days} style={{ marginTop: "var(--space-4)" }}>{Array.from({ length: 35 }, (_, index) => <Skeleton key={index} height="36px" />)}</div>
        </div>
        <div className={styles.fieldGrid}>
          {[0, 1, 2, 3].map((index) => <div key={index}><Skeleton width="45%" /><Skeleton height="var(--control-medium)" /></div>)}
        </div>
      </div>
    </Section>
    <Section title={<Skeleton width="20%" height={sectionHeight} />}>
      <div className={styles.workspace}>
        <SkeletonRows count={5} className={layout.list} />
        <div className={styles.detail}><Panel><Skeleton height="var(--space-20)" /></Panel></div>
      </div>
    </Section>
  </div>;
}
