import { List, PageHeader, RowLink, Section } from "../../components/ui";
import ui from "../../components/ui/ui.module.css";
import { memberLinkGroups } from "./memberLinks";
import styles from "./MemberLinksPage.module.css";

export function MemberLinksPage() {
  return <main id="member-content" tabIndex={-1} className={ui.readingPage}>
    <PageHeader title="자료실" />
    {memberLinkGroups().map((group) => <Section key={group.title} title={group.title}>
      <List as="ul">{group.links.map((link) => <li key={link.href}>
        <RowLink href={link.href} target="_blank" rel="noopener noreferrer">
          <span className={styles.text}><strong>{link.label}</strong>{link.note && <span className={styles.note}>{link.note}</span>}</span>
          <span aria-hidden="true" className={styles.arrow}>↗</span>
        </RowLink>
      </li>)}</List>
    </Section>)}
  </main>;
}
