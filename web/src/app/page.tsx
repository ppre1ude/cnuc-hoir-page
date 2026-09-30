import Image from "next/image";
import Link from "next/link";
import { ActionLink, BrandLogo } from "../components/ui";
import { ActivityGallery } from "@/features/onboarding/ActivityGallery";
import { activityPhotos } from "@/features/onboarding/activityPhotos";
import { ChoirHistory } from "@/features/onboarding/ChoirHistory";
import { Reveal } from "@/features/onboarding/Reveal";
import { choirChannels, choirMilestones } from "@/features/onboarding/choirProfile";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="전남대학교 합창단 홈">
          <BrandLogo className={styles.brandLogo} alt="" priority />
        </Link>
        <ActionLink variant="secondary" className={styles.login} href="/login">단원 로그인</ActionLink>
      </header>

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroContent}>
          <BrandLogo mark className={styles.heroMark} alt="" priority />
          <p className={styles.heroAffiliation}>전남대학교 중앙동아리</p>
          <h1 id="hero-title">합창으로 전하는<br /><strong>울림과 감동</strong>의 이야기</h1>
          <div className={styles.heroActions}>
            <ActionLink size="large" href="#activity">공연·활동 보기 <span aria-hidden="true">↗</span></ActionLink>
            <ActionLink size="large" variant="secondary" href="#participate">함께하기 <span aria-hidden="true">↗</span></ActionLink>
          </div>
        </div>
        <Image className={styles.heroPhoto} src="/images/choir-group.jpg"
          alt="무대에 모인 전남대학교 합창단 단원들" width={5360} height={3573}
          sizes="(max-width: 760px) 100vw, 90vw" priority />
      </section>

      <section className={styles.introduction} aria-label="합창단 소개">
        <div className={styles.container}>
          <Reveal><p className={styles.introductionLine}><strong>내 목소리</strong>를 알아가고,</p></Reveal>
          <Reveal delayed><p className={styles.introductionLine}><strong>나</strong>를 발견하고,</p></Reveal>
          <Reveal delayed><p className={styles.introductionLine}>함께 노래하며<br /><strong>우리가 됩니다.</strong></p></Reveal>
          <Reveal><p className={styles.introductionIdentity}>전남대학교 중앙동아리, 전남대학교 합창단</p></Reveal>
        </div>
      </section>

      <section className={styles.activity} id="activity" aria-labelledby="activity-title">
        <div className={styles.container}>
          <div className={styles.activityHeading}>
            <h2 id="activity-title">공연·활동</h2>
            <a className={styles.activityLink} href={choirChannels.instagram} target="_blank" rel="noopener noreferrer">인스타그램에서 더 보기 ↗</a>
          </div>
          <ActivityGallery photos={activityPhotos} />
        </div>
      </section>

      <section className={styles.participate} id="participate" aria-labelledby="participate-title">
        <div className={styles.container}>
          <div className={styles.participateGrid}>
            <div>
              <h2 id="participate-title">함께 노래하고 싶다면</h2>
              <div className={styles.channelActions}>
                <ActionLink size="large" className={styles.channelButton} href={choirChannels.instagram} target="_blank" rel="noopener noreferrer">공식 인스타그램 <span aria-hidden="true">↗</span></ActionLink>
                <ActionLink size="large" variant="secondary" className={styles.channelButton} href={choirChannels.youtube} target="_blank" rel="noopener noreferrer">공식 유튜브 <span aria-hidden="true">↗</span></ActionLink>
              </div>
            </div>
            <BrandLogo mark className={styles.participateMark} alt="" />
          </div>
        </div>
      </section>

      <section className={styles.history} aria-labelledby="history-title">
        <div className={styles.container}>
          <h2 id="history-title">연혁</h2>
          <ChoirHistory milestones={choirMilestones} />
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerMain}>
            <BrandLogo className={styles.footerLogo} />
            <nav className={styles.channelInfo} aria-label="공식 채널">
              <span>공식 채널</span>
              <div className={styles.channelLinks}>
                <a href={choirChannels.youtube} target="_blank" rel="noopener noreferrer">유튜브 ↗</a>
                <a href={choirChannels.instagram} target="_blank" rel="noopener noreferrer">인스타그램 ↗</a>
              </div>
            </nav>
            <div className={styles.memberLinks}>
              <span>단원 공간</span>
              <Link href="/login">로그인</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
