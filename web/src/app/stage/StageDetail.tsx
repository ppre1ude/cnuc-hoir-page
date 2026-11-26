import Image from "next/image";
import { ActionLink } from "../../components/ui";
import type { DetailedItem } from "../../features/onboarding/newsItems";
import styles from "./stage.module.css";

/** 고른 행사의 본문. 데스크톱은 오른쪽 칸에, 휴대폰은 목록에서 고른 항목 바로 아래에 그립니다. 없는 칸은 그리지 않습니다. */
export function StageDetail({ item, className }: { item: DetailedItem; className?: string }) {
  const { photo, subtitle, lead, facts, links, program } = item.detail;
  return (
    <div className={[styles.detail, className].filter(Boolean).join(" ")}>
      {photo && <Image className={styles.photo} src={photo.src} width={photo.width} height={photo.height} alt={photo.alt} unoptimized />}
      <hgroup className={styles.titleGroup}>
        <h3 className={styles.detailTitle}>{item.title}</h3>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </hgroup>
      {lead && <p className={styles.lead}>{lead}</p>}
      {facts?.length ? (
        <dl className={styles.facts}>
          {facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
        </dl>
      ) : null}
      {links?.length ? (
        <div className={styles.links}>
          {links.map((link, i) => (
            <ActionLink key={link.href} href={link.href} size="large" variant={i === 0 ? "primary" : "secondary"}>{link.label}</ActionLink>
          ))}
        </div>
      ) : null}
      {program?.length ? (
        <div>
          <h4 className={styles.programTitle}>프로그램</h4>
          <div className={styles.parts}>
            {program.map((part) => (
              <div key={part.part} className={styles.part}>
                <h5>{part.part}</h5>
                <ol>
                  {part.pieces.map((piece) => (
                    <li key={piece.title}>{piece.title}{piece.note && <span className={styles.note}>{piece.note}</span>}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
