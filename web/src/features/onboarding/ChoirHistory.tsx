import type { ChoirMilestone } from "./choirProfile";
import { Reveal } from "./Reveal";
import styles from "./ChoirHistory.module.css";

export function ChoirHistory({ milestones }: { milestones: ChoirMilestone[] }) {
  return <ol className={styles.history} aria-label="합창단 연혁">
    {milestones.map((milestone) => <li className={milestone.featured ? styles.featured : undefined} key={milestone.id}>
      <Reveal className={styles.row}>
        <span className={styles.date}>{milestone.date}</span>
        <div>
          <h3>{milestone.title}</h3>
          {milestone.venue && <p className={styles.venue}>{milestone.venue}</p>}
        </div>
      </Reveal>
    </li>)}
  </ol>;
}
