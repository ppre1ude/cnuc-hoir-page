import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BrandLogo } from "@/components/ui";
import { greetings } from "@/features/concert/greetings";
import { hallPhoto, stagePhoto, stagePhotos } from "@/features/concert/stagePhotos";
import { Gallery } from "../concert/Gallery";
import { myeongjo } from "../fonts/myeongjo";
import { paperlogy } from "../fonts/paperlogy";
import { Letter } from "./Letter";
import concertStyles from "../concert/concert.module.css";
import styles from "./gallery.module.css";

// 이 페이지는 제2회 정기연주회의 기록입니다. 다음 연주회 안내로 바뀌는 concert.ts를 따라가지 않도록 값을 여기에 따로 적습니다.
const round = "제2회 정기연주회";
const work = "에게 보내는 편지";
const venue = "전남대학교 민주마루";

const title = `${round} 공연 사진`;
const description = `${venue}에서 올린 ${round} 무대를 사진으로 남겼습니다.`;

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title: `전남대학교 합창단 ${title}`, description, siteName: "전남대학교 합창단", type: "website", locale: "ko_KR" },
};

export default function GalleryPage() {
  return (
    <main className={`${paperlogy.variable} ${myeongjo.variable} ${styles.page}`}>
      {/* 객석: 불이 꺼진 자리에서 무대를 봅니다. */}
      <div className={styles.house}>
        <header className={styles.header}>
          <Link href="/" aria-label="전남대학교 합창단 처음으로"><BrandLogo className={styles.logo} alt="" priority /></Link>
        </header>
        {/* 첫 화면에 거는 사진은 객석에서 본 무대 전경입니다. */}
        <Image className={styles.hall} src={hallPhoto.src} width={hallPhoto.width} height={hallPhoto.height} alt={hallPhoto.alt} unoptimized priority />
      </div>

      {/* 표지: 프로그램북 표지를 옮긴 편지지입니다. 밀랍 봉인과 금빛 필기체는 표지에 쓴 그림 그대로입니다. */}
      <div className={`${concertStyles.letter} ${styles.cover}`}>
        <p className={styles.host}>전남대학교 합창단</p>
        <h1 className={styles.title} aria-label={`${round} _____${work}`}>
          <span className={styles.round}>{round}</span>
          <span className={styles.work}><span className={styles.blank} />{work}</span>
        </h1>
        <div className={styles.flourish} aria-hidden="true">
          <Image className={styles.script} src="/images/concert/autumn-script.svg" alt="" width={537} height={80} unoptimized />
          <Image className={styles.waxSeal} src="/images/concert/wax-seal.webp" alt="" width={252} height={240} />
        </div>
        <p className={styles.when}>
          <time dateTime="2026-11-20T19:00+09:00">2026. 11. 20.<sup>fri</sup> 7:00<sup>pm</sup></time>
          <span>{venue}</span>
        </p>
      </div>

      <section className={styles.letters} aria-label="축사와 인사말">
        {greetings.map((greeting) => {
          const photo = stagePhoto(greeting.photo);
          return (
            <article className={styles.greeting} key={greeting.heading}>
              <Image className={styles.print} src={photo.src} alt={greeting.photoAlt} width={photo.width} height={photo.height} unoptimized />
              <Letter greeting={greeting} />
            </article>
          );
        })}
      </section>

      <section className={styles.photos} aria-labelledby="photos-title">
        <h2 className={styles.photosTitle} id="photos-title">공연 사진 보기</h2>
        {/* 휴대폰은 네 칸, 넓은 화면은 여섯 칸이라 어느 쪽에서도 마지막 줄이 차는 36장을 먼저 보여 줍니다. */}
        <Gallery photos={stagePhotos} initial={36} />
      </section>

      <footer className={styles.foot}>
        <Link href="/concert">초대장 보기</Link>
        <Link href="/">합창단 홈페이지</Link>
      </footer>
    </main>
  );
}
