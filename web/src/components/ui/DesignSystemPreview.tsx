"use client";

import { useState } from "react";
import { ActionLink, BrandLogo, Button, Feedback, Input, PageHeader, Select, StatusBadge, Textarea } from "./index";
import styles from "./preview.module.css";

const swatches = [
  ["브랜드", "--color-brand"], ["주요 동작", "--color-primary"], ["본문", "--color-ink"],
  ["작은 정보", "--color-muted"], ["구분선", "--color-line"], ["선택 배경", "--color-selected"],
] as const;

export function DesignSystemPreview() {
  const [attending, setAttending] = useState(true);
  return <main className={styles.page}>
    <BrandLogo />
    <PageHeader title="디자인 시스템" actions={<ActionLink href="/" variant="secondary">메인 보기</ActionLink>} />
    <section className={styles.section}>
      <h2>팔레트</h2>
      <div className={styles.swatches}>{swatches.map(([label, token]) => <div key={token}>
        <div className={styles.swatch} style={{ background: `var(${token})` }} />
        <strong>{label}</strong><code>{token}</code>
      </div>)}</div>
    </section>
    <section className={styles.section}>
      <h2>글자</h2>
      <p className={styles.display}>합창으로 전하는<br /><strong>울림과 감동</strong>의 이야기</p>
      <p className={styles.title}>일정</p><p>본문 16px</p><label>입력 라벨 14px</label>
    </section>
    <section className={styles.section}>
      <h2>버튼</h2>
      <div className={styles.actions}>
        <Button variant="primary">저장</Button><Button>닫기</Button>
        <Button variant="danger">접근 해제</Button><Button variant="ghost">다시 시도</Button>
        <Button variant="primary" disabled>저장 중</Button>
      </div>
      <div className={styles.actions}>
        <Button size="small">작은 버튼</Button><Button>일반 버튼</Button><Button size="large" variant="primary">큰 버튼</Button>
      </div>
    </section>
    <section className={styles.section}>
      <h2>선택과 상태</h2>
      <div className={styles.actions}>
        <Button aria-pressed={attending} onClick={() => setAttending(true)}>참석</Button>
        <Button aria-pressed={!attending} onClick={() => setAttending(false)}>불참</Button>
        <StatusBadge tone="positive">승인</StatusBadge><StatusBadge>미응답</StatusBadge><StatusBadge tone="negative">접근 해제</StatusBadge>
      </div>
    </section>
    <section className={styles.section}>
      <h2>입력과 피드백</h2>
      <div className={styles.form}>
        <label htmlFor="preview-title">제목</label><Input id="preview-title" defaultValue="정기연습" />
        <label htmlFor="preview-type">단원 구분</label><Select id="preview-type"><option>활동 단원</option><option>OB</option></Select>
        <label htmlFor="preview-body">내용</label><Textarea id="preview-body" rows={3} />
        <label htmlFor="preview-email">이메일 오류 상태</label>
        <Input id="preview-email" aria-invalid="true" aria-describedby="preview-error" defaultValue="잘못된 이메일" />
        <Feedback tone="error" id="preview-error">이메일 주소를 확인해 주세요.</Feedback>
        <label htmlFor="preview-disabled">비활성 입력</label><Input id="preview-disabled" value="수정 불가" disabled />
        <Feedback>저장했습니다.</Feedback>
      </div>
    </section>
  </main>;
}
