"use client";

import { useState } from "react";
import { List, Row, Section } from "../../components/ui";
import { isDetailed, type HistoryYear } from "../../features/onboarding/newsItems";
import { StageDetail } from "./StageDetail";
import styles from "./stage.module.css";

/** 왼쪽 연도 목록과 오른쪽 본문. 행사를 누르면 주소는 그대로 두고 본문만 바꿉니다. */
export function StageBoard({ years, initialId }: { years: HistoryYear[]; initialId?: string }) {
  const [selectedId, setSelectedId] = useState(initialId);
  const selected = years.flatMap((year) => year.items).filter(isDetailed).find((item) => item.id === selectedId);
  return (
    <div className={styles.board}>
      <div>
        {years.map(({ year, items }) => (
          <Section key={year} id={`year-${year}`} title={year}>
            <List as="ul">
              {items.map((item) => (
                <li key={item.id}>
                  <Row className={styles.event}>
                    {item.detail ? (
                      <button type="button" className={styles.pick} onClick={() => setSelectedId(item.id)}
                        aria-current={item.id === selected?.id ? "true" : undefined}>{item.title}</button>
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
  );
}
