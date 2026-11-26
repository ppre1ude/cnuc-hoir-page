import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo, PageHeader } from "../../components/ui";
import { newestDetailed, publicNews, stageYears } from "../../features/onboarding/newsItems";
import { PublicNav } from "../../features/onboarding/PublicNav";
import { paperlogy } from "../fonts/paperlogy";
import { StageBoard } from "./StageBoard";
import styles from "./stage.module.css";

export const metadata: Metadata = { title: "무대" };

// 합창단이 지나온 행사를 연도별로 봅니다. 세부 내용이 있는 행사를 고르면 오른쪽에 본문이 열리고, 나머지는 연도 안의 한 줄입니다.
export default function StagePage() {
  return (
    <div className={`${paperlogy.variable} ${styles.page}`}>
      <header className={styles.header}>
        <Link href="/" aria-label="전남대학교 합창단 처음으로"><BrandLogo className={styles.logo} alt="" /></Link>
        <PublicNav current="stage" />
      </header>
      <main className={styles.main}>
        <PageHeader className={styles.heading} title="무대" />
        <StageBoard years={stageYears(publicNews)} initialId={newestDetailed(publicNews)?.id} />
      </main>
    </div>
  );
}
