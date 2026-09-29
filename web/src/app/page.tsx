import Image from "next/image";
import Link from "next/link";
import { ActivityGallery } from "@/features/onboarding/ActivityGallery";
import { activityPhotos } from "@/features/onboarding/activityPhotos";
import styles from "./page.module.css";

const instagramUrl = "https://www.instagram.com/cnuc.hoir/";

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="전남대학교 합창단 홈">
          <Image
            className={styles.brandLogo}
            src="/images/choir-logo-horizontal.png"
            alt=""
            width={280}
            height={61}
            priority
          />
        </Link>
        <nav className={styles.nav} aria-label="주요 메뉴">
          <a href="#about">합창단 소개</a>
          <a href="#activity">공연·활동</a>
          <a href="#participate">함께하기</a>
        </nav>
        <Link className={styles.login} href="/login">단원 로그인</Link>
      </header>

      <section className={styles.hero} id="about" aria-labelledby="hero-title">
        <div className={styles.heroContent}>
          <Image className={styles.heroMark} src="/images/choir-mark.png" alt="" width={168} height={130} priority />
          <p className={styles.heroName}>전남대학교 합창단</p>
          <h1 id="hero-title">합창으로 전하는<br /><strong>울림과 감동</strong>의 이야기</h1>
          <div className={styles.heroActions}>
            <a className={styles.heroPrimary} href="#activity">공연·활동 보기 <span aria-hidden="true">↗</span></a>
            <a className={styles.heroSecondary} href="#participate">함께하기 <span aria-hidden="true">↗</span></a>
          </div>
        </div>
        <Image className={styles.heroPhoto} src="/images/choir-group.jpg"
          alt="무대에 모인 전남대학교 합창단 단원들" width={5360} height={3573}
          sizes="(max-width: 760px) 100vw, 90vw" priority />
      </section>

      <section className={styles.activity} id="activity" aria-labelledby="activity-title">
        <div className={styles.container}>
          <div className={styles.activityHeading}>
            <h2 id="activity-title">공연·활동</h2>
            <a className={styles.activityLink} href={instagramUrl} target="_blank" rel="noopener noreferrer">인스타그램에서 더 보기 ↗</a>
          </div>
          <ActivityGallery photos={activityPhotos} />
        </div>
      </section>

      <section className={styles.participate} id="participate" aria-labelledby="participate-title">
        <div className={styles.container}>
          <div className={styles.participateGrid}>
            <div>
              <h2 id="participate-title">함께 노래하고 싶다면</h2>
              <a className={styles.instagramButton} href={instagramUrl} target="_blank" rel="noopener noreferrer">공식 인스타그램 <span aria-hidden="true">↗</span></a>
            </div>
            <Image className={styles.participateMark} src="/images/choir-mark.png" alt="" width={350} height={270} />
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerMain}>
            <Image className={styles.footerLogo} src="/images/choir-logo-horizontal.png" alt="전남대학교 합창단" width={280} height={61} />
            <div className={styles.memberLinks}>
              <span>단원 공간</span>
              <Link href="/login">로그인</Link>
              <Link href="/join">단원 계정 가입 신청</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
