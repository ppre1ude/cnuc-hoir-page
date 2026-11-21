"use client";

import { useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import Image from "next/image";
import type { Still } from "@/features/concert/stills";
import styles from "./concert.module.css";

/** 사진을 격자로 보여 주고, 누르면 크게 띄웁니다. 크게 본 상태에서는 좌우 화살표, 방향키, 옆으로 밀기로 넘깁니다.
 *  initial을 주면 격자에는 그만큼만 먼저 보이고, 더 보기를 누를 때마다 그만큼씩 더 펼칩니다. 크게 보기는 처음부터 전체를 넘깁니다. */
export function Gallery({ photos, initial = photos.length }: { photos: Still[]; initial?: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const touchX = useRef(0);
  const [index, setIndex] = useState<number | null>(null);
  const [shown, setShown] = useState(initial);
  const photo = index === null ? null : photos[index];

  function open(i: number) {
    setIndex(i);
    dialog.current?.showModal();
  }
  function move(step: number) {
    setIndex((i) => (i === null ? i : (i + step + photos.length) % photos.length));
  }
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
  }
  function onTouchEnd(event: TouchEvent) {
    const moved = event.changedTouches[0].clientX - touchX.current;
    if (Math.abs(moved) > 48) move(moved < 0 ? 1 : -1);
  }

  return (
    <>
      <ul className={styles.gallery}>
        {photos.slice(0, shown).map((item, i) => (
          <li key={item.src}>
            <button type="button" onClick={() => open(i)} aria-label={`크게 보기: ${item.alt}`}>
              {item.thumb
                ? <Image src={item.thumb} alt="" width={480} height={480} unoptimized />
                : <Image src={item.src} alt="" width={item.width} height={item.height} sizes="(max-width: 760px) 33vw, 220px" />}
            </button>
          </li>
        ))}
      </ul>
      {shown < photos.length && (
        <button type="button" className={styles.more} onClick={() => setShown(shown + initial)}>사진 더 보기</button>
      )}

      {/* Esc와 뒤로 가기는 dialog가 처리합니다. 사진 바깥의 어두운 곳을 눌러도 닫힙니다. */}
      <dialog ref={dialog} className={styles.viewer} aria-label="사진 크게 보기" onClose={() => setIndex(null)} onKeyDown={onKeyDown}
        onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}
        onTouchStart={(event) => { touchX.current = event.touches[0].clientX; }} onTouchEnd={onTouchEnd}>
        {photo && index !== null && (
          <>
            <Image key={photo.src} className={styles.viewerPhoto} src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} sizes="100vw" unoptimized={Boolean(photo.thumb)} />
            <p className={styles.viewerCount} aria-live="polite">{index + 1} / {photos.length}</p>
            <button type="button" className={styles.viewerClose} onClick={() => dialog.current?.close()} aria-label="닫기">×</button>
            <button type="button" className={styles.viewerPrev} onClick={() => move(-1)} aria-label="이전 사진">‹</button>
            <button type="button" className={styles.viewerNext} onClick={() => move(1)} aria-label="다음 사진">›</button>
          </>
        )}
      </dialog>
    </>
  );
}
