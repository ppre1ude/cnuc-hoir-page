import { Callout, Panel, Section, Skeleton, SkeletonRows } from "../../components/ui";
import ui from "../../components/ui/ui.module.css";
import layout from "../../components/ui/layout.module.css";
import styles from "./AdminPages.module.css";

const sectionHeight = "calc(var(--text-section) * 1.2)";

// 세션을 기다리는 동안 단원 정보 관리와 같은 틀로 자리를 잡습니다. 라우트의 <main> 안에 놓입니다.
export function MemberAccountSkeleton() {
  return <div className={ui.page}>
    <div className={ui.pageHeader}><Skeleton width="var(--space-20)" height="calc(var(--text-title) * 1.2)" /></div>
    <Section title={<Skeleton width="20%" height={sectionHeight} />}>
      <Callout><Skeleton height="calc(var(--text-label) * 1.7 * 3)" /></Callout>
      <div className={styles.registerGrid}>
        <div className={layout.form}>
          {[0, 1, 2].map((index) => <div key={index} className={layout.field}>
            <Skeleton width="35%" />
            <Skeleton height="var(--control-medium)" />
          </div>)}
        </div>
        <div>
          <Skeleton width="45%" height="calc(var(--text-body) * 1.3)" />
          <SkeletonRows count={3} className={layout.list} />
        </div>
      </div>
    </Section>
    <Section title={<Skeleton width="20%" height={sectionHeight} />}>
      <div className={styles.workspace}>
        <SkeletonRows count={6} className={layout.list} />
        <div className={styles.detail}><Panel><Skeleton height="var(--space-20)" /></Panel></div>
      </div>
    </Section>
  </div>;
}
