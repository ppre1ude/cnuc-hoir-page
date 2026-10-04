import { Skeleton, SkeletonRows } from "../../components/ui";
import styles from "./EventCalendar.module.css";

const titleHeight = "calc(var(--text-title) * 1.2)";
const sectionHeight = "calc(var(--text-section) * 1.2)";

function Section({ className, rows }: { className: string; rows: number }) {
  return <div className={`${styles.card} ${className}`}>
    <div className={styles.sectionHeader}><Skeleton width="30%" height={sectionHeight} /></div>
    <SkeletonRows count={rows} />
  </div>;
}

// 세션을 기다리는 동안 일정 대시보드와 같은 배치로 자리를 잡습니다.
export function EventCalendarSkeleton() {
  return <div className={styles.dashboard}>
    <div className={`${styles.skeletonHeader} ${styles.hero}`}><Skeleton width="var(--space-20)" height={titleHeight} /></div>
    <div className={styles.grid}>
      <div className={`${styles.card} ${styles.calendar}`}>
        <div className={styles.calendarHeader}>
          <Skeleton width="35%" height={sectionHeight} />
          <div className={styles.monthControls}>
            <Skeleton width="var(--control-medium)" height="var(--control-medium)" />
            <Skeleton width="var(--control-medium)" height="var(--control-medium)" />
          </div>
        </div>
        <div className={styles.skeletonCalendar}>
          {Array.from({ length: 7 }, (_, index) => <Skeleton key={`weekday-${index}`} width="40%" />)}
          {Array.from({ length: 35 }, (_, index) => <Skeleton key={index} className={styles.skeletonDay} />)}
        </div>
      </div>
      <Section className={styles.detail} rows={6} />
      <Section className={styles.notices} rows={3} />
      <Section className={styles.attendance} rows={3} />
    </div>
  </div>;
}
