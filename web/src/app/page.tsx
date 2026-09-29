import Image from "next/image";
import Link from "next/link";
import { ActivityGallery } from "@/features/onboarding/ActivityGallery";
import { Reveal } from "@/features/onboarding/Reveal";
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

      <section className={styles.hero} aria-labelledby="hero-title">
        <Image
          className={styles.heroPhoto}
          src="/images/choir-group.jpg"
          alt="무대에 선 전남대학교 합창단 단원들"
          fill
          sizes="100vw"
          priority
        />
        <div className={styles.heroContent}>
          <h1 id="hero-title">전남대학교 합창단</h1>
          <a className={styles.heroLink} href="#about">합창단 소개 <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <section className={styles.about} id="about" aria-labelledby="about-title">
        <div className={styles.container}>
          <div className={styles.aboutGrid}>
            <Reveal>
              <Image className={styles.aboutMark} src="/images/choir-mark.png" alt="" width={210} height={162} />
            </Reveal>
            <Reveal delayed>
              <h2 id="about-title">
                <span className={styles.aboutLead}>합창으로 전하는</span>
                <span className={styles.aboutFinal}>
                  <strong>울림과 감동</strong><span className={styles.aboutTail}>의 이야기</span>
                </span>
              </h2>
            </Reveal>
          </div>
        </div>
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
