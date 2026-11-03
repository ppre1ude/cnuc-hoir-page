import { PageHeader } from "../../components/ui";
import { memberLinkGroups } from "./memberLinks";
import styles from "./MemberLinksPage.module.css";

export function MemberLinksPage() {
  return <main id="member-content" tabIndex={-1} className={styles.page}>
    <PageHeader title="자료실" />
    {memberLinkGroups().map((group) => <section key={group.title} className={styles.group}>
      <h2>{group.title}</h2>
      <ul className={styles.list}>{group.links.map((link) => <li key={link.href}>
        <a href={link.href} target="_blank" rel="noopener noreferrer">
          <span className={styles.text}><strong>{link.label}</strong>{link.note && <span className={styles.note}>{link.note}</span>}</span>
          <span aria-hidden="true" className={styles.arrow}>↗</span>
        </a>
      </li>)}</ul>
    </section>)}
  </main>;
}
