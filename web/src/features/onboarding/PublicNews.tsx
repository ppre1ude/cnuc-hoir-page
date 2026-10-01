import type { PublicNewsItem } from "./newsItems";
import styles from "./PublicNews.module.css";

export function PublicNews({ items }: { items: PublicNewsItem[] }) {
  return <div className={styles.news}>
    {items.map((item) => <article className={styles.item} key={item.id}>
      <time dateTime={item.date}>{item.dateLabel}</time>
      <div><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}</div>
    </article>)}
  </div>;
}
