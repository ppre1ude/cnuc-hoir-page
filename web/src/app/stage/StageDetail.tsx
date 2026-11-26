import Image from "next/image";
import { ActionLink } from "../../components/ui";
import type { StageItem } from "../../features/onboarding/newsItems";
import styles from "./stage.module.css";

/** 고른 행사의 본문. 데스크톱은 오른쪽 칸에, 휴대폰은 목록에서 고른 항목 바로 아래에 그립니다. */
export function StageDetail({ item, className }: { item: StageItem; className?: string }) {
  const { name, photo, lead, facts, links } = item.stage;
  return (
    <div className={[styles.detail, className].filter(Boolean).join(" ")}>
      <Image className={styles.photo} src={photo.src} width={photo.width} height={photo.height} alt={photo.alt}
        sizes="(max-width: 760px) 100vw, 760px" unoptimized />
      <h3 className={styles.detailTitle}>{name}</h3>
      {lead && <p className={styles.lead}>{lead}</p>}
      <dl className={styles.facts}>
        {facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
      </dl>
      <div className={styles.links}>
        {links.map((link, i) => (
          <ActionLink key={link.href} href={link.href} size="large" variant={i === 0 ? "primary" : "secondary"}>{link.label}</ActionLink>
        ))}
      </div>
    </div>
  );
}
