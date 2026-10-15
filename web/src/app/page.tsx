import type { Metadata } from "next";
import Link from "next/link";
import { ActionLink, BrandLogo } from "../components/ui";
import { ActivityGallery } from "@/features/onboarding/ActivityGallery";
import { activityPhotos } from "@/features/onboarding/activityPhotos";
import { ChoirHistory } from "@/features/onboarding/ChoirHistory";
import { HeroScore } from "@/features/onboarding/HeroScore";
import { HeroEmphasis } from "@/features/onboarding/HeroEmphasis";
import { RouteJourney } from "@/features/onboarding/RouteJourney";
import { PublicNews } from "@/features/onboarding/PublicNews";
import { publicNews } from "@/features/onboarding/newsItems";
import { choirChannels, choirMilestones } from "@/features/onboarding/choirProfile";
import styles from "./page.module.css";

export const metadata: Metadata = {
  description: "합창으로 전하는 울림과 감동의 이야기. 전남대학교 합창단의 공연과 활동, 단원 참여 안내를 만나보세요.",
};

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="전남대학교 합창단 홈">
          <BrandLogo className={styles.brandLogo} alt="" priority />
        </Link>
        <ActionLink variant="secondary" className={`${styles.action} ${styles.login}`} href="/login">단원 로그인</ActionLink>
      </header>

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroContent}>
          <BrandLogo mark className={styles.heroMark} alt="" priority />
          <HeroScore />
          <h1 id="hero-title">합창으로 전하는<br /><HeroEmphasis />의 이야기</h1>
        </div>
      </section>

      <RouteJourney description="전남대학교 합창단은 교내 유일의 합창 동아리입니다.">
        <div className={styles.callToAction} id="participate">
          <h2 className={styles.callToActionTitle} id="participate-title">함께 노래해요.</h2>
          <ActionLink size="large" className={`${styles.action} ${styles.inverse}`} href={choirChannels.application} target="_blank" rel="noopener noreferrer" aria-describedby="participate-title">지원서 작성하기 <span aria-hidden="true">↗</span></ActionLink>
        </div>
      </RouteJourney>

      <section className={styles.activity} id="activity" aria-labelledby="activity-title">
        <div className={styles.container}>
          <div className={styles.activityHeading}>
            <h2 id="activity-title">소식</h2>
            <a className={styles.activityLink} href={choirChannels.instagram} target="_blank" rel="noopener noreferrer">인스타그램 ↗</a>
          </div>
          <PublicNews items={publicNews} />
          <ActivityGallery photos={activityPhotos} />
        </div>
      </section>

      <section className={styles.history} aria-labelledby="history-title">
        <div className={styles.container}>
          <details className={styles.historyDisclosure}>
            <summary><h2 id="history-title">연혁</h2><span className={styles.historyToggle} aria-hidden="true" /></summary>
            <div className={styles.historyContent}><ChoirHistory milestones={choirMilestones} /></div>
          </details>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerMain}>
            <BrandLogo className={styles.footerLogo} />
            <nav className={styles.channelLinks} aria-label="공식 채널">
              <a href={choirChannels.instagram} target="_blank" rel="noopener noreferrer">인스타그램 ↗</a>
              <a href={choirChannels.youtube} target="_blank" rel="noopener noreferrer">유튜브 ↗</a>
            </nav>
          </div>
        </div>
      </footer>
    </main>
  );
}
