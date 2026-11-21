import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BrandLogo } from "@/components/ui";
import { concert } from "@/features/concert/concert";
import { stagePhotos } from "@/features/concert/stagePhotos";
import { Gallery } from "../concert/Gallery";
import { myeongjo } from "../fonts/myeongjo";
import { paperlogy } from "../fonts/paperlogy";
import styles from "./gallery.module.css";

const title = `${concert.round} 공연 사진`;
const description = `${concert.venue}에서 올린 ${concert.round} 무대를 사진으로 남겼습니다.`;

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title: `전남대학교 합창단 ${title}`, description, siteName: "전남대학교 합창단", type: "website", locale: "ko_KR" },
};

// 첫 화면에 거는 사진은 객석에서 본 무대 전경입니다. 그 사진을 내리면 첫 장을 씁니다.
const hall = stagePhotos.find((photo) => photo.src.endsWith("/195.webp")) ?? stagePhotos[0];

export default function GalleryPage() {
  return (
    <main className={`${paperlogy.variable} ${myeongjo.variable} ${styles.page}`}>
      {/* 객석: 불이 꺼진 자리에서 무대를 봅니다. */}
      <div className={styles.house}>
        <header className={styles.header}>
          <Link href="/" aria-label="전남대학교 합창단 처음으로"><BrandLogo className={styles.logo} alt="" priority /></Link>
        </header>
        <Image className={styles.hall} src={hall.src} width={hall.width} height={hall.height} unoptimized priority
          alt="객석에서 본 민주마루 무대. 나무 벽 앞에 합창단이 줄지어 서 있고 가운데에 그랜드피아노가 놓여 있습니다." />
      </div>

      {/* 피아노: 건반 뚜껑 안쪽의 금빛 글씨 자리에 공연 이름을 적고, 그 아래에 건반을 둡니다. */}
      <div className={styles.fallboard}>
        <h1 className={styles.title}>{concert.round}</h1>
        <p className={styles.work} aria-label={concert.title}><span className={styles.blank} />{concert.title.replace(/^_+/, "")}</p>
        <p className={styles.facts}>{concert.dateLabel}, {concert.venue}</p>
      </div>
      <div className={styles.keys} aria-hidden="true" />

      <section className={styles.photos} aria-labelledby="photos-title">
        <h2 className={styles.count} id="photos-title">공연 사진 {stagePhotos.length}장</h2>
        {/* 휴대폰은 네 칸, 넓은 화면은 여섯 칸이라 어느 쪽에서도 마지막 줄이 차는 36장을 먼저 보여 줍니다. */}
        <Gallery photos={stagePhotos} initial={36} />
      </section>

      <footer className={styles.foot}>
        <Link href="/concert">초대장 다시 보기</Link>
        <Link href="/">합창단 처음으로</Link>
      </footer>
    </main>
  );
}
