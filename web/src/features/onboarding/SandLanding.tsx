"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { ActionLink, BrandLogo } from "../../components/ui";
import { stagePhoto } from "./activityPhotos";
import { choirChannels } from "./choirProfile";
import { historyByYear, publicNews } from "./newsItems";
import { startSandStage } from "./sand/stage";
import { BRAND_MARK as MARK } from "../../lib/brandMark";
import styles from "./SandLanding.module.css";

// 공개 메인: 한 번 넘기면 한 장면씩, 모래 입자가 심벌·파형·음표·오선·사진·길로 모였다 흩어집니다.
// 장면 글은 처음부터 모두 문서에 있고, 자바스크립트가 없으면 세로로 쌓여 보입니다.

/** 오른쪽 목차. name은 화면 읽기 프로그램용, label은 화면에 보이는 글자입니다. */
const SCENES = [
  { name: "소개", label: "소개" },
  { name: "내 목소리", label: "01" },
  { name: "나", label: "02" },
  { name: "함께", label: "03" },
  { name: "우리", label: "04" },
  { name: "걸어온 길", label: "걸어온 길" },
  { name: "지원", label: "지원" },
];

/** 01~04: 꼬리표는 음악이 쌓이는 순서, 제목은 사람이 변하는 순서, 본문은 그 사이를 풉니다. */
const VALUES: { eyebrow: string; title: ReactNode; body: string }[] = [
  { eyebrow: "독창", title: <><strong>내 목소리</strong>를<br />알아가고,</>, body: "숨 쉬는 법부터 소리를 내는 법까지, 내 목소리가 어떤 결을 가졌는지 하나씩 알아갑니다." },
  { eyebrow: "성부", title: <><strong>나</strong>를<br />발견하고,</>, body: "내 목소리가 머무는 자리를 찾는 일은 몰랐던 나를 만나는 일이기도 합니다." },
  { eyebrow: "화음", title: <>함께<br />노래하며</>, body: "혼자서는 낼 수 없는 소리가 있습니다. 서로의 소리를 들으며 맞춰 가는 시간이 화음이 됩니다." },
  { eyebrow: "합창", title: <strong>우리가 됩니다.</strong>, body: "같은 악보를 들고 같은 무대에 서는 순간, 여러 목소리가 하나의 노래가 됩니다." },
];


const pad = (n: number) => String(n).padStart(2, "0");

export function SandLanding() {
  const rootRef = useRef<HTMLDivElement>(null);
  const markSrc = getImageProps({ src: MARK.src, alt: "", width: 540, height: Math.round(540 * MARK.height / MARK.width) }).props.src;
  const years = historyByYear(publicNews);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    return startSandStage(root, { mark: { src: markSrc, width: MARK.width, height: MARK.height } });
  }, [markSrc]);

  return (
    <div ref={rootRef} className={styles.landing} data-current="0">
      <div className={styles.stage} data-sand="stage">
        <canvas className={styles.canvas} data-sand="canvas" aria-hidden="true" />

        <header className={styles.header}>
          <Link href="/" className={styles.home} aria-label="전남대학교 합창단 처음으로" data-sand="home">
            <BrandLogo className={styles.headerLogo} alt="" />
          </Link>
          <ActionLink variant="secondary" href="/login" className={styles.login}>단원 로그인</ActionLink>
        </header>

        <nav className={styles.nav} aria-label="장면">
          {SCENES.map((scene, i) => (
            <button key={scene.name} type="button" data-sand-nav={i} aria-label={`${scene.name} 장면으로 이동`} aria-current={i === 0 ? "step" : undefined}>
              <span>{scene.label}</span><i aria-hidden="true" />
            </button>
          ))}
        </nav>

        {/* 소개 */}
        <section className={`${styles.scene} ${styles.centered}`} data-scene="0" data-sand-mark="0" data-active="" aria-labelledby="landing-title">
          <h1 className={styles.title} id="landing-title">합창으로 전하는<br /><strong>울림과 감동</strong>의 이야기</h1>
          <p className={styles.lead}>전남대학교 합창단은 교내 유일의 합창 동아리입니다.</p>
        </section>
        <button className={`${styles.scene} ${styles.cue}`} data-scene="0" data-active="" data-sand="cue" type="button">
          넘겨 보기<i aria-hidden="true" />
        </button>

        {/* 01~04 */}
        {VALUES.map((value, i) => (
          <section className={`${styles.scene} ${styles.copy}`} data-scene={i + 1} key={value.eyebrow} aria-labelledby={`landing-value-${i + 1}`}>
            <p className={styles.eyebrow}>{pad(i + 1)}<span>{value.eyebrow}</span></p>
            <h2 className={styles.title} id={`landing-value-${i + 1}`}>{value.title}</h2>
            <p className={styles.body}>{value.body}</p>
          </section>
        ))}
        {/* 사진 하나가 04의 오른쪽 자리와 05의 머리 자리를 오갑니다. 자리는 투명한 요소로 잡고 엔진이 사진을 옮깁니다. */}
        <div className={styles.photoAnchor} data-sand="photo-anchor" aria-hidden="true"><i /></div>
        <div className={styles.photo} data-sand="photo">
          <Image src={stagePhoto.src} alt={stagePhoto.alt} fill sizes="(max-width: 760px) 88vw, 900px" loading="eager" />
        </div>

        {/* 05 걸어온 길 */}
        <section className={`${styles.scene} ${styles.history}`} data-scene="5" aria-labelledby="landing-history-title">
          <div className={styles.banner} data-sand="banner" aria-hidden="true" />
          <div className={styles.historyBody}>
            <p className={styles.eyebrow}>05<span>기록</span></p>
            <h2 className={styles.title} id="landing-history-title">우리가 <strong>걸어온 길</strong></h2>
            <p className={styles.body}>창단식에서 시작해 중앙동아리가 되기까지, 우리가 함께 지나온 자리입니다.</p>
            <ol className={styles.years}>
              {years.map((year) => (
                <li className={styles.year} key={year.year}>
                  <i className={styles.dot} data-sand="dot" aria-hidden="true" />
                  <h3>{year.year}</h3>
                  <ul className={styles.events}>
                    {year.items.map((item) => (
                      <li key={item.id}>
                        <time dateTime={item.date}>{item.monthDay}</time>
                        <span>{item.title}{item.description && <small>{item.description}</small>}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
            <BrandLogo className={styles.footLogo} />
          </div>
        </section>

        {/* 지원 */}
        <section className={`${styles.scene} ${styles.centered} ${styles.join}`} data-scene="6" data-sand-mark="6" aria-labelledby="landing-join-title">
          <h2 className={styles.title} id="landing-join-title">함께 노래해요.</h2>
          <ActionLink size="large" className={styles.apply} href={choirChannels.application} target="_blank" rel="noopener noreferrer">
            지원서 작성하기 <span aria-hidden="true">↗</span>
          </ActionLink>
          <nav className={styles.channels} aria-label="공식 채널">
            <a href={choirChannels.instagram} target="_blank" rel="noopener noreferrer">인스타그램 ↗</a>
            <a href={choirChannels.youtube} target="_blank" rel="noopener noreferrer">유튜브 ↗</a>
          </nav>
        </section>
        <button className={`${styles.scene} ${styles.top}`} data-scene="6" data-sand="top" type="button">
          <i aria-hidden="true" />맨 위로
        </button>
      </div>
    </div>
  );
}
