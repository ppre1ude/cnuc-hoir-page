import type { ChoirMilestone } from "./choirProfile";
import { Reveal } from "./Reveal";
import styles from "./ChoirHistory.module.css";

export function ChoirHistory({ milestones }: { milestones: ChoirMilestone[] }) {
  const years = new Map<number, ChoirMilestone[]>();
  for (const milestone of milestones) {
    const entries = years.get(milestone.year) ?? [];
    entries.push(milestone);
    years.set(milestone.year, entries);
  }

  return <ol className={styles.history} aria-label="합창단 연혁">
    {[...years.entries()].sort(([first], [second]) => second - first).map(([year, entries]) =>
      <li className={styles.yearGroup} key={year}>
        <div><h3 className={styles.year}>{year}</h3></div>
        <ol className={styles.entries} aria-label={`${year}년 연혁`}>
          {entries.map((milestone) => <li className={milestone.featured ? styles.featured : undefined} key={milestone.id}>
            <Reveal className={styles.entry}>
              <span className={styles.date}>{milestone.date}</span>
              <div>
                <p className={styles.title}>{milestone.title}</p>
                {milestone.venue && <p className={styles.venue}>{milestone.venue}</p>}
              </div>
            </Reveal>
          </li>)}
        </ol>
      </li>)}
  </ol>;
}
