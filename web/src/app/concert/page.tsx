import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/ui";
import { concert, isConcertUpcoming } from "@/features/concert/concert";
import { stagePhotos } from "@/features/concert/stagePhotos";
import { stills } from "@/features/concert/stills";
import { choirChannels } from "@/features/onboarding/choirProfile";
import { myeongjo } from "../fonts/myeongjo";
import { paperlogy } from "../fonts/paperlogy";
import { Gallery } from "./Gallery";
import { Recipient } from "./Recipient";
import { ShareButton } from "./ShareButton";
import styles from "./concert.module.css";

// 공연이 끝난 뒤 문구가 바뀌도록 한 시간마다 다시 만듭니다.
export const revalidate = 3600;

const title = `${concert.round} <${concert.title}>`;
// 일시, 장소, 무료 입장은 공유 그림 안에 있어 설명에는 초대 문장만 둡니다.
const description = concert.invitation;

export const metadata: Metadata = {
  title,
  description,
  // 공유 카드 그림은 같은 폴더의 opengraph-image.jpg를 씁니다.
  openGraph: { title: `전남대학교 합창단 ${title}`, description, siteName: "전남대학교 합창단", type: "website", locale: "ko_KR" },
};

export default function ConcertPage() {
  const upcoming = isConcertUpcoming(new Date());
  return (
    <main className={`${paperlogy.variable} ${myeongjo.variable} ${styles.page}`}>
      <header className={styles.header}>
        <Link href="/" aria-label="전남대학교 합창단 처음으로"><BrandLogo className={styles.logo} alt="" priority /></Link>
      </header>

      {/* 포스터의 편지지: 우표 톱니 가장자리, 가는 테두리 선, 아래쪽 밀랍 봉인 */}
      <section className={styles.letter} aria-labelledby="concert-title">
        <p className={styles.host}><strong>전남대학교 합창단</strong>{concert.round}</p>
        <h1 className={styles.title} id="concert-title" aria-label={concert.title}>
          <Recipient className={styles.blank} caretClassName={styles.caret} />{concert.title.replace(/^_+/, "")}
        </h1>
        {!upcoming && <p className={styles.ended}>공연을 마쳤습니다. 함께해 주셔서 감사합니다.</p>}
        <dl className={styles.facts}>
          <div>
            <dt>일시</dt>
            <dd>{concert.dateLabel}<small>{concert.doors}</small></dd>
          </div>
          <div>
            <dt>장소</dt>
            <dd>
              {concert.venue}
              <small><a href={concert.mapUrl} target="_blank" rel="noopener noreferrer">지도에서 보기 ↗</a></small>
            </dd>
          </div>
          <div>
            <dt>입장</dt>
            <dd>{concert.admission}</dd>
          </div>
        </dl>
        <div className={styles.actions}>
          {upcoming && <ShareButton className={styles.share} title={title} text={description} />}
          <a className={styles.channel} href={choirChannels.instagram} target="_blank" rel="noopener noreferrer">인스타그램에서 소식 보기 ↗</a>
        </div>
        <div className={styles.seal} aria-hidden="true"><BrandLogo mark alt="" /></div>
      </section>

      <section aria-labelledby="stage-photos">
        <h2 className={styles.galleryTitle} id="stage-photos">공연 사진</h2>
        {/* 격자가 네 칸이라 마지막 줄이 비지 않게 여덟 줄만 먼저 보여 줍니다. */}
        <Gallery photos={stagePhotos} initial={32} />
      </section>

      <section aria-labelledby="practice-photos">
        <h2 className={styles.galleryTitle} id="practice-photos">연습 사진</h2>
        <Gallery photos={stills} />
      </section>

      <footer className={styles.credits}>
        <p><span>지휘</span>{concert.conductors}</p>
        <p><span>지도교수</span>{concert.advisor}</p>
        <p><span>주최 및 주관</span>전남대학교 합창단</p>
      </footer>
    </main>
  );
}
