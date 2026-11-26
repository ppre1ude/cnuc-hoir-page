import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo, List, PageHeader, Row, Section } from "../../components/ui";
import { pickStage, publicNews, stageYears } from "../../features/onboarding/newsItems";
import { PublicNav } from "../../features/onboarding/PublicNav";
import { paperlogy } from "../fonts/paperlogy";
import { StageDetail } from "./StageDetail";
import styles from "./stage.module.css";

export const metadata: Metadata = { title: "무대" };

// 합창단이 지나온 행사를 연도별로 봅니다. 페이지가 있는 행사만 골라 오른쪽에 본문을 열고, 나머지는 연도 안의 한 줄입니다.
export default async function StagePage({ searchParams }: { searchParams: Promise<{ event?: string | string[] }> }) {
  const { event } = await searchParams;
  const selected = pickStage(publicNews, event);
  return (
    <div className={`${paperlogy.variable} ${styles.page}`}>
      <header className={styles.header}>
        <Link href="/" aria-label="전남대학교 합창단 처음으로"><BrandLogo className={styles.logo} alt="" /></Link>
        <PublicNav current="stage" />
      </header>
      <main className={styles.main}>
        <PageHeader className={styles.heading} title="무대" />
        <div className={styles.board}>
          <div>
            {stageYears(publicNews).map(({ year, items }) => (
              <Section key={year} id={`year-${year}`} title={year}>
                <List as="ul">
                  {items.map((item) => (
                    <li key={item.id}>
                      <Row className={styles.event}>
                        {item.stage ? (
                          <Link className={styles.pick} href={`/stage?event=${item.id}`} scroll={false}
                            aria-current={item.id === selected?.id ? "true" : undefined}>{item.stage.name}</Link>
                        ) : <span>{item.title}</span>}
                        <span className={styles.date}>{item.monthDay}</span>
                      </Row>
                      {selected && item.id === selected.id && <StageDetail className={styles.inline} item={selected} />}
                    </li>
                  ))}
                </List>
              </Section>
            ))}
          </div>
          {selected && <aside className={styles.panel}><StageDetail item={selected} /></aside>}
        </div>
      </main>
    </div>
  );
}
